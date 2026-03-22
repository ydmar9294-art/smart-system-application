/**
 * Unified Auth Status Endpoint
 * Single call returns: user profile, role, permissions, org, license, config
 * 
 * Optimized: fetches profile first, only checks developer allowlist
 * when profile has no role yet (new user) or role is already DEVELOPER.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

async function hashIdentifier(str: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = performance.now()

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ authenticated: false, reason: 'NO_TOKEN' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate JWT explicitly (verify_jwt=false in config)
    const token = authHeader.replace('Bearer ', '')

    // Rate limit check
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const ipHash = await hashIdentifier(clientIp)
    
    const rateResult = await serviceClient.rpc('check_endpoint_rate_limit', {
      p_identifier: ipHash,
      p_endpoint: 'auth-status',
      p_max_requests: 60,
      p_window_seconds: 60
    })
    
    if (rateResult.data && !rateResult.data.allowed) {
      return new Response(
        JSON.stringify({ authenticated: false, reason: 'RATE_LIMITED' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // SECURITY: Explicit token validation via getUser
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: { user: validatedUser }, error: userError } = await userClient.auth.getUser(token)

    if (userError || !validatedUser) {
      return new Response(
        JSON.stringify({ authenticated: false, reason: 'INVALID_TOKEN' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = validatedUser.id
    const userEmail = validatedUser.email || ''
    const userFullName = validatedUser.user_metadata?.full_name || ''

    // Fetch profile FIRST (before developer check)
    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select(`
        id, full_name, email, role, employee_type, organization_id, license_key, is_active,
        organizations!profiles_organization_id_fkey(id, name)
      `)
      .eq('id', userId)
      .maybeSingle()

    // Only check developer allowlist if:
    // 1. No profile exists (new user), OR
    // 2. Profile exists but role is default 'EMPLOYEE' (might be a developer not yet assigned)
    const needsDeveloperCheck = !profile || profile.role === 'EMPLOYEE'
    if (needsDeveloperCheck) {
      await serviceClient.rpc('check_and_assign_developer_role', {
        p_user_id: userId,
        p_email: userEmail,
        p_full_name: userFullName
      })

      // If we just assigned developer role, re-fetch profile
      if (!profile) {
        const { data: freshProfile } = await serviceClient
          .from('profiles')
          .select(`
            id, full_name, email, role, employee_type, organization_id, license_key, is_active,
            organizations!profiles_organization_id_fkey(id, name)
          `)
          .eq('id', userId)
          .maybeSingle()

        if (!freshProfile) {
          return new Response(
            JSON.stringify({ 
              authenticated: true,
              needs_activation: true,
              user_id: userId,
              email: userEmail,
              full_name: ''
            }),
            { 
              status: 200, 
              headers: { 
                ...corsHeaders, 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store'
              } 
            }
          )
        }

        // Use the fresh profile for the rest of the flow
        return await buildProfileResponse(freshProfile, userId, startTime)
      }
    }

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ 
          authenticated: true,
          needs_activation: true,
          user_id: userId,
          email: userEmail,
          full_name: ''
        }),
        { 
          status: 200, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          } 
        }
      )
    }

    return await buildProfileResponse(profile, userId, startTime)

  } catch (error) {
    console.error('[auth-status] Error:', error)
    return new Response(
      JSON.stringify({ 
        authenticated: false, 
        reason: 'SERVER_ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/** Build the final response from a resolved profile */
async function buildProfileResponse(profile: any, userId: string, startTime: number) {
  const org = profile.organizations
  const orgName = org?.name || null

  // Block deactivated employees
  if (profile.is_active === false) {
    return new Response(
      JSON.stringify({
        authenticated: true,
        access_denied: true,
        reason: 'DEACTIVATED',
        message: 'تم تعطيل حسابك. تواصل مع مديرك لإعادة التفعيل.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
    )
  }

  // Developer — no license check needed
  if (profile.role === 'DEVELOPER') {
    const elapsed = Math.round(performance.now() - startTime)
    return new Response(
      JSON.stringify({
        authenticated: true,
        needs_activation: false,
        access_denied: false,
        user_id: userId,
        role: profile.role,
        employee_type: profile.employee_type,
        organization_id: profile.organization_id,
        organization_name: orgName,
        license_status: null,
        full_name: profile.full_name,
        email: profile.email,
        _timing_ms: elapsed
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'private, s-maxage=60, max-age=60, stale-while-revalidate=120'
        } 
      }
    )
  }

  // Non-developer: resolve license
  let licenseKey = profile.license_key
  let licensePromise: Promise<any> | null = null
  
  if (licenseKey) {
    licensePromise = serviceClient
      .from('developer_licenses')
      .select('status, "expiryDate"')
      .eq('licenseKey', licenseKey)
      .single()
  } else if (profile.organization_id) {
    licensePromise = serviceClient
      .from('profiles')
      .select('license_key')
      .eq('organization_id', profile.organization_id)
      .eq('role', 'OWNER')
      .maybeSingle()
      .then(async ({ data: ownerProfile }) => {
        if (!ownerProfile?.license_key) return { data: null }
        return serviceClient
          .from('developer_licenses')
          .select('status, "expiryDate"')
          .eq('licenseKey', ownerProfile.license_key)
          .single()
      })
  }

  let licenseStatus: string | null = null
  let expiryDate: string | null = null
  
  if (licensePromise) {
    const licenseResult = await licensePromise
    const license = licenseResult?.data
    licenseStatus = license?.status || null
    expiryDate = license?.expiryDate || null
  }

  const elapsed = Math.round(performance.now() - startTime)

  return new Response(
    JSON.stringify({
      authenticated: true,
      needs_activation: false,
      access_denied: false,
      user_id: userId,
      role: profile.role,
      employee_type: profile.employee_type,
      organization_id: profile.organization_id,
      organization_name: orgName,
      license_status: licenseStatus,
      expiry_date: expiryDate,
      full_name: profile.full_name,
      email: profile.email,
      _timing_ms: elapsed
    }),
    { 
      status: 200, 
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'private, s-maxage=30, max-age=30, stale-while-revalidate=60'
      } 
    }
  )
}
