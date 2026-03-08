/**
 * API Gateway Edge Function
 * Centralized auth validation, rate limiting, tenant scoping, and routing.
 * Acts as a BFF layer for all client requests.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCorsPreflightIfNeeded } from '../_shared/cors.ts'

interface UserContext {
  userId: string;
  email: string;
  role: string;
  organizationId: string | null;
  employeeType: string | null;
}

Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreflightIfNeeded(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);
  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  try {
    // === Public endpoints (no auth required) ===
    if (action === 'health') {
      return json({ status: 'ok', timestamp: new Date().toISOString() }, 200, corsHeaders);
    }

    // === Auth required from here ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401, corsHeaders);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Full server-side user validation (checks user exists, not banned, token not revoked)
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return json({ error: 'Invalid token' }, 401, corsHeaders);
    }

    const userId = user.id;

    // Rate limit per user: 120 requests/minute for general gateway
    const { data: rlData } = await supabase.rpc('check_endpoint_rate_limit', {
      p_identifier: userId,
      p_endpoint: `gateway-${action || 'default'}`,
      p_max_requests: 120,
      p_window_seconds: 60,
    });
    if (rlData && !rlData.allowed) {
      return json({ error: 'Rate limited', retryAfter: 60 }, 429, corsHeaders);
    }

    // Load user context (role, org, type)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, organization_id, employee_type, email, is_active')
      .eq('id', userId)
      .single();

    if (!profile) {
      return json({ error: 'Profile not found' }, 403, corsHeaders);
    }

    if (!profile.is_active) {
      return json({ error: 'Account deactivated' }, 403, corsHeaders);
    }

    const ctx: UserContext = {
      userId,
      email: profile.email || '',
      role: profile.role,
      organizationId: profile.organization_id,
      employeeType: profile.employee_type,
    };

    // === Route actions ===
    switch (action) {
      case 'whoami':
        return json({ 
          userId: ctx.userId,
          role: ctx.role,
          organizationId: ctx.organizationId,
          employeeType: ctx.employeeType,
        }, 200, corsHeaders);

      case 'tenant-info': {
        if (!ctx.organizationId) return json({ error: 'No organization' }, 403, corsHeaders);
        
        const { data: org } = await supabase
          .from('organizations')
          .select('id, name, created_at')
          .eq('id', ctx.organizationId)
          .single();
        
        const { data: license } = await supabase
          .from('developer_licenses')
          .select('id, status, type, max_employees, expiryDate')
          .eq('organization_id', ctx.organizationId)
          .limit(1)
          .single();

        return json({ organization: org, license }, 200, corsHeaders);
      }

      case 'audit-log': {
        if (ctx.role !== 'OWNER' && ctx.role !== 'DEVELOPER') {
          return json({ error: 'Insufficient permissions' }, 403, corsHeaders);
        }

        const body = await req.json().catch(() => ({}));
        const limit = Math.min(Number(body.limit) || 50, 200);
        const offset = Number(body.offset) || 0;

        let query = supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (ctx.role !== 'DEVELOPER' && ctx.organizationId) {
          query = query.eq('organization_id', ctx.organizationId);
        }

        if (body.action) query = query.eq('action', body.action);
        if (body.entity_type) query = query.eq('entity_type', body.entity_type);

        const { data, error } = await query;
        if (error) return json({ error: error.message }, 500, corsHeaders);
        return json({ logs: data, count: data?.length || 0 }, 200, corsHeaders);
      }

      case 'tenant-stats': {
        if (ctx.role !== 'DEVELOPER') {
          return json({ error: 'Developer only' }, 403, corsHeaders);
        }

        const { data, error } = await supabase.rpc('get_organization_stats_rpc');
        if (error) return json({ error: error.message }, 500, corsHeaders);
        return json({ stats: data }, 200, corsHeaders);
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400, corsHeaders);
    }

  } catch (err) {
    console.error('[api-gateway] Error:', err);
    return json({ error: 'Internal server error' }, 500, getCorsHeaders(req));
  }
});

function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
