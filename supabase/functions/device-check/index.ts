/**
 * Device Check Edge Function v2
 * Manages single-active-device policy per user (WhatsApp-style).
 * 
 * Actions:
 *   pre-check  — Check if user has an active session on another device.
 *   register   — Register/activate a device after login. Deactivates ALL other devices.
 *   verify     — Verify a device is still active.
 *   heartbeat  — Update last_active timestamp (lightweight, 30s interval).
 *   logout     — Mark device as inactive and log security event.
 * 
 * Security Features:
 *   - IP address capture on all actions
 *   - Platform & app version tracking
 *   - Security event logging (login, logout, session_revoked)
 *   - Race condition protection via single-row active constraint
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-id, x-device-name, x-device-platform, x-app-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || req.headers.get('cf-connecting-ip')
    || 'unknown'
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

/** Log a security event (non-blocking) */
async function logSecurityEvent(
  userId: string,
  eventType: string,
  deviceId: string | null,
  deviceName: string | null,
  platform: string | null,
  ipAddress: string,
  details: Record<string, unknown> = {}
) {
  try {
    await serviceClient.from('security_events').insert({
      user_id: userId,
      event_type: eventType,
      device_id: deviceId,
      device_name: deviceName,
      platform: platform,
      ip_address: ipAddress,
      details,
    })
  } catch (err) {
    console.error('[device-check] Failed to log security event:', err)
  }
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
    const platform = req.headers.get('x-device-platform') || 'web'
    const appVersion = req.headers.get('x-app-version') || '1.0.0'
    const ipAddress = getClientIp(req)

    if (!deviceId) {
      return jsonResponse({ success: false, reason: 'MISSING_DEVICE_ID' }, 400)
    }

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'verify'

    switch (action) {
      case 'pre-check':
        return await handlePreCheck(userId, deviceId)
      case 'register':
        return await handleRegister(userId, deviceId, deviceName, platform, appVersion, ipAddress)
      case 'verify':
        return await handleVerify(userId, deviceId, ipAddress)
      case 'heartbeat':
        return await handleHeartbeat(userId, deviceId)
      case 'logout':
        return await handleLogout(userId, deviceId, platform, ipAddress)
      default:
        return jsonResponse({ success: false, reason: 'INVALID_ACTION' }, 400)
    }
  } catch (error) {
    console.error('[device-check] Error:', error)
    return jsonResponse({ success: false, reason: 'SERVER_ERROR' }, 500)
  }
})

/**
 * Pre-check: Does this user have an active session on ANOTHER device?
 * Only considers devices seen in the last 24h as "really active" — older rows
 * are treated as abandoned (e.g. stale OAuth/test sessions on a fresh account)
 * and ignored to avoid false "logged in elsewhere" warnings.
 */
async function handlePreCheck(userId: string, deviceId: string) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: activeDevices } = await serviceClient
    .from('devices')
    .select('device_id, device_name, last_seen, platform')
    .eq('user_id', userId)
    .eq('is_active', true)
    .neq('device_id', deviceId)
    .gte('last_seen', cutoff)

  const hasActiveSession = (activeDevices && activeDevices.length > 0) || false

  if (hasActiveSession) {
    return jsonResponse({
      success: true,
      has_active_session: true,
      active_devices: activeDevices!.map(d => ({
        device_name: d.device_name,
        last_seen: d.last_seen,
        platform: d.platform,
      })),
    })
  }

  return jsonResponse({ success: true, has_active_session: false })
}

/**
 * Register a device after successful login.
 * Deactivates ALL other devices → triggers Realtime → old devices get notified.
 */
async function handleRegister(
  userId: string,
  deviceId: string,
  deviceName: string,
  platform: string,
  appVersion: string,
  ipAddress: string
) {
  // 0. Fetch organization_id from profile for audit logging
  const { data: profileData } = await serviceClient
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .maybeSingle()
  const orgId = profileData?.organization_id || null

  // 1. Find all currently active devices for this user (excluding this device)
  const { data: activeDevices } = await serviceClient
    .from('devices')
    .select('id, device_id, device_name, platform')
    .eq('user_id', userId)
    .eq('is_active', true)
    .neq('device_id', deviceId)

  const replacedDevices = activeDevices || []
  const hadOtherDevice = replacedDevices.length > 0

  // 2. Deactivate ALL other devices (triggers Realtime → old device gets notified)
  if (hadOtherDevice) {
    await serviceClient
      .from('devices')
      .update({ is_active: false })
      .eq('user_id', userId)
      .neq('device_id', deviceId)

    // Log revocation events for each replaced device
    for (const d of replacedDevices) {
      logSecurityEvent(userId, 'session_revoked', d.device_id, d.device_name, d.platform, ipAddress, {
        revoked_by_device: deviceId,
        revoked_by_name: deviceName,
      })
    }
  }

  // 3. Upsert this device as active (unique on user_id + device_id)
  const { error: upsertError } = await serviceClient
    .from('devices')
    .upsert(
      {
        user_id: userId,
        device_id: deviceId,
        device_name: deviceName,
        platform,
        app_version: appVersion,
        ip_address: ipAddress,
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
        platform,
        app_version: appVersion,
        ip_address: ipAddress,
        is_active: true,
        last_seen: new Date().toISOString(),
        replaced_device_id: replacedDevices[0]?.device_id || null,
      })
  }

  // 4. Log login security event
  logSecurityEvent(userId, 'login', deviceId, deviceName, platform, ipAddress, {
    app_version: appVersion,
    replaced_count: replacedDevices.length,
  })

  // 5. Audit log with organization_id
  if (hadOtherDevice) {
    await serviceClient.from('audit_logs').insert({
      user_id: userId,
      organization_id: orgId,
      action: 'DEVICE_REPLACED',
      entity_type: 'device',
      entity_id: null,
      details: {
        replaced_devices: replacedDevices.map(d => ({
          device_id: d.device_id,
          device_name: d.device_name,
          platform: d.platform,
        })),
        new_device_id: deviceId,
        new_device_name: deviceName,
        new_platform: platform,
        ip_address: ipAddress,
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

  return jsonResponse({ success: true, status: 'DEVICE_REGISTERED' })
}

/**
 * Verify that the given device is still the active device for this user.
 * Also serves as API-level session validation.
 */
async function handleVerify(userId: string, deviceId: string, ipAddress: string) {
  const { data: activeDevice } = await serviceClient
    .from('devices')
    .select('device_id, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (!activeDevice) {
    return jsonResponse({ success: true, active: true, status: 'NO_DEVICE_REGISTERED' })
  }

  if (activeDevice.device_id === deviceId) {
    // Update last_seen and IP
    await serviceClient
      .from('devices')
      .update({ last_seen: new Date().toISOString(), ip_address: ipAddress })
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

/**
 * Heartbeat — lightweight last_active update (called every 30s).
 * Also validates session is still active (stolen token protection).
 */
async function handleHeartbeat(userId: string, deviceId: string) {
  const { data, error } = await serviceClient
    .from('devices')
    .update({ last_seen: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .eq('is_active', true)
    .select('device_id')
    .maybeSingle()

  if (error || !data) {
    // Device is no longer active — session was revoked
    return jsonResponse({
      success: true,
      active: false,
      status: 'SESSION_INVALID',
      message: 'تم تسجيل الدخول من جهاز آخر',
    })
  }

  return jsonResponse({ success: true, active: true, status: 'HEARTBEAT_OK' })
}

/**
 * Logout — mark device inactive and log security event.
 */
async function handleLogout(userId: string, deviceId: string, platform: string, ipAddress: string) {
  await serviceClient
    .from('devices')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('device_id', deviceId)

  // Log security event
  logSecurityEvent(userId, 'logout', deviceId, null, platform, ipAddress)

  return jsonResponse({ success: true, status: 'LOGGED_OUT' })
}
