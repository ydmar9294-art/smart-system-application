/**
 * API Gateway Edge Function
 * Centralized auth validation, rate limiting, tenant scoping, and routing.
 * Acts as a BFF layer for all client requests.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface UserContext {
  userId: string;
  email: string;
  role: string;
  organizationId: string | null;
  employeeType: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  try {
    // === Public endpoints (no auth required) ===
    if (action === 'health') {
      return json({ status: 'ok', timestamp: new Date().toISOString() });
    }

    // === Auth required from here ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return json({ error: 'Invalid token' }, 401);
    }

    const userId = claims.claims.sub as string;

    // Rate limit per user: 120 requests/minute for general gateway
    const { data: rlData } = await supabase.rpc('check_endpoint_rate_limit', {
      p_identifier: userId,
      p_endpoint: `gateway-${action || 'default'}`,
      p_max_requests: 120,
      p_window_seconds: 60,
    });
    if (rlData && !rlData.allowed) {
      return json({ error: 'Rate limited', retryAfter: 60 }, 429);
    }

    // Load user context (role, org, type)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, organization_id, employee_type, email, is_active')
      .eq('id', userId)
      .single();

    if (!profile) {
      return json({ error: 'Profile not found' }, 403);
    }

    if (!profile.is_active) {
      return json({ error: 'Account deactivated' }, 403);
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
        });

      case 'tenant-info': {
        if (!ctx.organizationId) return json({ error: 'No organization' }, 403);
        
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

        return json({ organization: org, license });
      }

      case 'audit-log': {
        // Only owners and developers can view audit logs
        if (ctx.role !== 'OWNER' && ctx.role !== 'DEVELOPER') {
          return json({ error: 'Insufficient permissions' }, 403);
        }

        const body = await req.json().catch(() => ({}));
        const limit = Math.min(Number(body.limit) || 50, 200);
        const offset = Number(body.offset) || 0;

        let query = supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        // Scope to org unless developer
        if (ctx.role !== 'DEVELOPER' && ctx.organizationId) {
          query = query.eq('organization_id', ctx.organizationId);
        }

        if (body.action) query = query.eq('action', body.action);
        if (body.entity_type) query = query.eq('entity_type', body.entity_type);

        const { data, error } = await query;
        if (error) return json({ error: error.message }, 500);
        return json({ logs: data, count: data?.length || 0 });
      }

      case 'tenant-stats': {
        if (ctx.role !== 'DEVELOPER') {
          return json({ error: 'Developer only' }, 403);
        }

        const { data, error } = await supabase.rpc('get_organization_stats_rpc');
        if (error) return json({ error: error.message }, 500);
        return json({ stats: data });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }

  } catch (err) {
    console.error('[api-gateway] Error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
