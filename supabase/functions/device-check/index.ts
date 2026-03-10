/**
 * Device Check Edge Function
 * Manages single-active-device policy per user (WhatsApp-style).
 * 
 * Actions:
 *   pre-check — Check if user has an active session on another device (before confirming login).
 *   register  — Register/activate a device after login. Deactivates ALL other devices.
 *   verify    — Verify a device is still active.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-id, x-device-name, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function validateUser(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.replace('Bearer ', '')
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error } = await userClient.auth.getUser(token)
  if (error || !user) return null
  return user
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const user = await validateUser(req)
    if (!user) {
      return jsonResponse({ success: false, reason: 'UNAUTHORIZED' }, 401)
    }

    const userId = user.id
    const deviceId = req.headers.get('x-device-id')
    const deviceName = req.headers.get('x-device-name') || 'Unknown'

    if (!deviceId) {
      return jsonResponse({ success: false, reason: 'MISSING_DEVICE_ID' }, 400)
    }

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'verify'

    if (action === 'pre-check') {
      return await handlePreCheck(userId, deviceId)
    }

    if (action === 'register') {
      return await handleRegister(userId, deviceId, deviceName)
    }

    if (action === 'verify') {
      return await handleVerify(userId, deviceId)
    }

    return jsonResponse({ success: false, reason: 'INVALID_ACTION' }, 400)
  } catch (error) {
    console.error('[device-check] Error:', error)
    return jsonResponse({ success: false, reason: 'SERVER_ERROR' }, 500)
  }
})

/**
 * Pre-check: Does this user have an active session on ANOTHER device?
 * Called after successful auth but BEFORE registering the device,
 * so the client can show a warning dialog.
 */
async function handlePreCheck(userId: string, deviceId: string) {
  const { data: activeDevices } = await serviceClient
    .from('devices')
    .select('device_id, device_name, last_seen')
    .eq('user_id', userId)
    .eq('is_active', true)
    .neq('device_id', deviceId)

  const hasActiveSession = (activeDevices && activeDevices.length > 0) || false

  if (hasActiveSession) {
    return jsonResponse({
      success: true,
      has_active_session: true,
      active_devices: activeDevices!.map(d => ({
        device_name: d.device_name,
        last_seen: d.last_seen,
      })),
    })
  }

  return jsonResponse({
    success: true,
    has_active_session: false,
  })
}

/**
 * Register a device after successful login.
 * Deactivates ALL other devices for this user, then upserts the new one as active.
 * The deactivation triggers Realtime UPDATE events so old devices detect revocation instantly.
 */
async function handleRegister(userId: string, deviceId: string, deviceName: string) {
  // 1. Find all currently active devices for this user (excluding this device)
  const { data: activeDevices } = await serviceClient
    .from('devices')
    .select('id, device_id, device_name')
    .eq('user_id', userId)
    .eq('is_active', true)
    .neq('device_id', deviceId)

  const replacedDevices = activeDevices || []
  const hadOtherDevice = replacedDevices.length > 0

  // 2. Deactivate ALL other devices for this user (this triggers Realtime → old device gets notified)
  if (hadOtherDevice) {
    await serviceClient
      .from('devices')
      .update({ is_active: false })
      .eq('user_id', userId)
      .neq('device_id', deviceId)
  }

  // 3. Upsert this device as active (unique on user_id + device_id)
  const { error: upsertError } = await serviceClient
    .from('devices')
    .upsert(
      {
        user_id: userId,
        device_id: deviceId,
        device_name: deviceName,
        is_active: true,
        last_seen: new Date().toISOString(),
        replaced_device_id: replacedDevices[0]?.device_id || null,
      },
      { onConflict: 'user_id,device_id' }
    )

  if (upsertError) {
    console.error('[device-check] Upsert failed, using fallback:', upsertError)
    // Fallback: deactivate all, insert fresh
    await serviceClient
      .from('devices')
      .update({ is_active: false })
      .eq('user_id', userId)

    await serviceClient
      .from('devices')
      .insert({
        user_id: userId,
        device_id: deviceId,
        device_name: deviceName,
        is_active: true,
        last_seen: new Date().toISOString(),
        replaced_device_id: replacedDevices[0]?.device_id || null,
      })
  }

  // 4. Audit log if device was replaced
  if (hadOtherDevice) {
    await serviceClient.from('audit_logs').insert({
      user_id: userId,
      action: 'DEVICE_REPLACED',
      entity_type: 'device',
      entity_id: null,
      details: {
        replaced_devices: replacedDevices.map(d => ({
          device_id: d.device_id,
          device_name: d.device_name,
        })),
        new_device_id: deviceId,
        new_device_name: deviceName,
      },
    })

    return jsonResponse({
      success: true,
      status: 'DEVICE_REPLACED',
      replaced_device_id: replacedDevices[0]?.device_id,
      replaced_device_name: replacedDevices[0]?.device_name,
      message: 'تم تسجيل الخروج من جميع الأجهزة السابقة',
    })
  }

  // Check if same device re-registering
  return jsonResponse({ success: true, status: 'DEVICE_REGISTERED' })
}

/**
 * Verify that the given device is still the active device for this user.
 */
async function handleVerify(userId: string, deviceId: string) {
  const { data: activeDevice } = await serviceClient
    .from('devices')
    .select('device_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (!activeDevice) {
    return jsonResponse({ success: true, active: true, status: 'NO_DEVICE_REGISTERED' })
  }

  if (activeDevice.device_id === deviceId) {
    await serviceClient
      .from('devices')
      .update({ last_seen: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('device_id', deviceId)

    return jsonResponse({ success: true, active: true, status: 'DEVICE_ACTIVE' })
  }

  return jsonResponse({
    success: true,
    active: false,
    status: 'DEVICE_REVOKED',
    message: 'تم تسجيل الدخول من جهاز آخر',
  })
}
