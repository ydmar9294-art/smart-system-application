/**
 * Device Check Edge Function
 * Manages single-active-device policy per user.
 * 
 * Actions:
 *   register  — Register/activate a device after login
 *   verify    — Verify a device is still active (called on every API request or reconnect)
 * 
 * All device mutations use the service role client for security.
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

    // Determine action from URL or body
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'verify'

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
 * Register a device after successful login.
 * Deactivates any previously active device for this user.
 */
async function handleRegister(userId: string, deviceId: string, deviceName: string) {
  // 1. Find current active device for this user
  const { data: activeDevice } = await serviceClient
    .from('devices')
    .select('id, device_id, device_name')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  // Case B: Same device — just update last_seen
  if (activeDevice && activeDevice.device_id === deviceId) {
    await serviceClient
      .from('devices')
      .update({ last_seen: new Date().toISOString(), device_name: deviceName })
      .eq('id', activeDevice.id)

    return jsonResponse({ success: true, status: 'SAME_DEVICE' })
  }

  const oldDeviceId = activeDevice?.device_id || null

  // Case C: Different device is active — deactivate old
  if (activeDevice) {
    await serviceClient
      .from('devices')
      .update({ is_active: false })
      .eq('id', activeDevice.id)
  }

  // Upsert new device record (may already exist from a previous session)
  const { error: upsertError } = await serviceClient
    .from('devices')
    .upsert(
      {
        user_id: userId,
        device_id: deviceId,
        device_name: deviceName,
        is_active: true,
        last_seen: new Date().toISOString(),
        replaced_device_id: oldDeviceId,
      },
      { onConflict: 'user_id', ignoreDuplicates: false }
    )

  // If upsert fails due to unique constraint race, retry with explicit insert
  if (upsertError) {
    // Deactivate all for this user, then insert fresh
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
        replaced_device_id: oldDeviceId,
      })
  }

  // Audit log if device was replaced
  if (oldDeviceId && oldDeviceId !== deviceId) {
    await serviceClient.from('audit_logs').insert({
      user_id: userId,
      action: 'DEVICE_REPLACED',
      entity_type: 'device',
      entity_id: null,
      details: {
        old_device_id: oldDeviceId,
        old_device_name: activeDevice?.device_name || 'Unknown',
        new_device_id: deviceId,
        new_device_name: deviceName,
      },
    })

    return jsonResponse({
      success: true,
      status: 'DEVICE_REPLACED',
      replaced_device_id: oldDeviceId,
    })
  }

  // Case A: No previous device
  return jsonResponse({ success: true, status: 'NEW_DEVICE' })
}

/**
 * Verify that the given device is still the active device for this user.
 * Called on reconnect and periodically.
 */
async function handleVerify(userId: string, deviceId: string) {
  const { data: activeDevice } = await serviceClient
    .from('devices')
    .select('device_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (!activeDevice) {
    // No device registered — allow (first-time or migration)
    return jsonResponse({ success: true, active: true, status: 'NO_DEVICE_REGISTERED' })
  }

  if (activeDevice.device_id === deviceId) {
    // Update last_seen
    await serviceClient
      .from('devices')
      .update({ last_seen: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_active', true)

    return jsonResponse({ success: true, active: true, status: 'DEVICE_ACTIVE' })
  }

  // Device is NOT the active one
  return jsonResponse({
    success: true,
    active: false,
    status: 'DEVICE_REVOKED',
    message: 'تم تسجيل الدخول من جهاز آخر',
  })
}
