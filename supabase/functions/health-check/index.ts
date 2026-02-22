/**
 * Health Check Endpoint
 * Monitors application health: database connectivity, edge function status, and key metrics
 * Used for monitoring and alerting systems
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check authentication - only developers can see full health
    const authHeader = req.headers.get('Authorization')
    let isAuthorized = false

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabase.auth.getUser(token)
      if (user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'DEVELOPER')
          .maybeSingle()
        isAuthorized = !!roleData
      }
    }

    // 1. Database connectivity check
    const dbStart = Date.now()
    const { error: dbError } = await supabase.from('organizations').select('id').limit(1)
    const dbLatency = Date.now() - dbStart
    const dbHealthy = !dbError

    // 2. Auth service check
    const authStart = Date.now()
    const { error: authError } = await supabase.auth.getSession()
    const authLatency = Date.now() - authStart
    const authHealthy = !authError

    // Basic health response for unauthenticated requests
    const totalLatency = Date.now() - startTime
    const overallHealthy = dbHealthy && authHealthy

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({
          status: overallHealthy ? 'healthy' : 'degraded',
          timestamp: new Date().toISOString(),
          latency_ms: totalLatency
        }),
        { status: overallHealthy ? 200 : 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Full health report for developers
    // 3. Count key metrics
    const [
      { count: orgCount },
      { count: userCount },
      { count: saleCount },
      { count: auditCount },
      { count: recentErrors }
    ] = await Promise.all([
      supabase.from('organizations').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('sales').select('*', { count: 'exact', head: true }),
      supabase.from('audit_logs').select('*', { count: 'exact', head: true }),
      supabase.from('audit_logs').select('*', { count: 'exact', head: true })
        .eq('severity', 'error')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    ])

    return new Response(
      JSON.stringify({
        status: overallHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        latency_ms: totalLatency,
        checks: {
          database: { healthy: dbHealthy, latency_ms: dbLatency },
          auth: { healthy: authHealthy, latency_ms: authLatency }
        },
        metrics: {
          organizations: orgCount || 0,
          users: userCount || 0,
          total_sales: saleCount || 0,
          total_audit_logs: auditCount || 0,
          errors_last_24h: recentErrors || 0
        },
        environment: {
          region: Deno.env.get('DENO_REGION') || 'unknown',
          deployment_id: Deno.env.get('DENO_DEPLOYMENT_ID') || 'unknown'
        }
      }),
      { status: overallHealthy ? 200 : 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[health-check] Error:', error)
    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        latency_ms: Date.now() - startTime
      }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
