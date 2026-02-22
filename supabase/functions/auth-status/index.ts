/**
 * Unified Auth Status Endpoint
 * Single call returns: user profile, role, permissions, org, license, config
 * 
 * Includes automatic developer role assignment via allowlist check
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

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const token = authHeader.replace('Bearer ', '')

    // Parallel: rate limit check + JWT validation
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const ipHash = await hashIdentifier(clientIp)
    
    const [rateResult, claimsResult] = await Promise.all([
      serviceClient.rpc('check_endpoint_rate_limit', {
        p_identifier: ipHash,
        p_endpoint: 'auth-status',
        p_max_requests: 60,
        p_window_seconds: 60
      }),
      userClient.auth.getClaims(token)
    ])
    
    if (rateResult.data && !rateResult.data.allowed) {
      return new Response(
        JSON.stringify({ authenticated: false, reason: 'RATE_LIMITED' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: claimsData, error: claimsError } = claimsResult

    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ authenticated: false, reason: 'INVALID_TOKEN' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = claimsData.claims.sub as string
    const userEmail = claimsData.claims.email as string
    const userFullName = (claimsData.claims as any).user_metadata?.full_name || ''

    // Auto-assign developer role if email is in allowlist (server-side only, idempotent)
    // This runs BEFORE profile lookup so the profile will have the correct role
    await serviceClient.rpc('check_and_assign_developer_role', {
      p_user_id: userId,
      p_email: userEmail,
      p_full_name: userFullName
    })

    // Single query: profile + org join
    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select(`
        id, full_name, email, role, employee_type, organization_id, license_key, is_active,
        organizations!profiles_organization_id_fkey(id, name)
      `)
      .eq('id', userId)
      .maybeSingle()

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

    const org = (profile as any).organizations
    const orgName = org?.name || null

    // Block deactivated employees
    if ((profile as any).is_active === false) {
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