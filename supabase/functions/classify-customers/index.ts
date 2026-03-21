/**
 * classify-customers Edge Function
 * 
 * Calculates ABC classification for customers based on sales revenue:
 * - A: Top 20% by revenue (highest value customers)
 * - B: Next 30% 
 * - C: Bottom 50%
 * 
 * Also generates weekly visit plans:
 * - A customers: 3 visits/week
 * - B customers: 2 visits/week
 * - C customers: 1 visit/week
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightIfNeeded } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;
  const headers = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Authenticate caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
    }

    // Get user's org
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, role, employee_type')
      .eq('id', user.id)
      .single();

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: 'No organization' }), { status: 400, headers });
    }

    // Only owner, sales_manager, or developer can classify
    const isAuthorized = profile.role === 'DEVELOPER' || profile.role === 'OWNER' ||
      (profile.role === 'EMPLOYEE' && profile.employee_type === 'SALES_MANAGER');
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers });
    }

    const orgId = profile.organization_id;
    const body = await req.json().catch(() => ({}));
    const generateVisits = body.generate_visits !== false;
    const weekStartDate = body.week_start || getNextMonday();

    // 1. Get all customers with their total sales revenue
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name')
      .eq('organization_id', orgId);

    if (!customers || customers.length === 0) {
      return new Response(JSON.stringify({ classified: 0, message: 'No customers found' }), { headers });
    }

    // Get sales totals per customer (non-voided sales)
    const { data: salesData } = await supabase
      .from('sales')
      .select('customer_id, grand_total')
      .eq('organization_id', orgId)
      .eq('is_voided', false);

    // Aggregate revenue per customer
    const revenueMap = new Map<string, number>();
    for (const sale of (salesData || [])) {
      const current = revenueMap.get(sale.customer_id) || 0;
      revenueMap.set(sale.customer_id, current + Number(sale.grand_total));
    }

    // Sort customers by revenue descending
    const sorted = customers
      .map(c => ({ id: c.id, name: c.name, revenue: revenueMap.get(c.id) || 0 }))
      .sort((a, b) => b.revenue - a.revenue);

    // Classify: A = top 20%, B = next 30%, C = bottom 50%
    const totalCount = sorted.length;
    const aThreshold = Math.max(1, Math.ceil(totalCount * 0.2));
    const bThreshold = Math.max(aThreshold + 1, Math.ceil(totalCount * 0.5));

    const classMap: Record<string, string[]> = { A: [], B: [], C: [] };
    for (let i = 0; i < sorted.length; i++) {
      let cls = 'C';
      if (i < aThreshold) cls = 'A';
      else if (i < bThreshold) cls = 'B';
      classMap[cls].push(sorted[i].id);
    }

    // 2. Batch UPDATE classifications (3 queries instead of N)
    for (const [cls, ids] of Object.entries(classMap)) {
      if (ids.length > 0) {
        await supabase
          .from('customers')
          .update({ classification: cls })
          .in('id', ids);
      }
    }

    const updates = sorted.map((s, i) => ({
      id: s.id,
      name: s.name,
      classification: i < aThreshold ? 'A' : i < bThreshold ? 'B' : 'C',
    }));

    // 3. Generate visit plans if requested
    let visitsCreated = 0;
    if (generateVisits) {
      // Get distributors (FIELD_AGENTs) in the org
      const { data: distributors } = await supabase
        .from('profiles')
        .select('id')
        .eq('organization_id', orgId)
        .eq('role', 'EMPLOYEE')
        .eq('employee_type', 'FIELD_AGENT')
        .eq('is_active', true);

      if (distributors && distributors.length > 0) {
        // Delete existing future plans for this week to regenerate
        await supabase
          .from('visit_plans')
          .delete()
          .eq('organization_id', orgId)
          .gte('planned_date', weekStartDate)
          .eq('status', 'planned');

        // Frequency map
        const freqMap: Record<string, number> = { A: 3, B: 2, C: 1 };

        const plans: any[] = [];
        const weekDays = getWeekDays(weekStartDate);

        for (let dIdx = 0; dIdx < distributors.length; dIdx++) {
          const distId = distributors[dIdx].id;
          const myCustomers = updates.filter((_, i) => i % distributors.length === dIdx);

          for (const customer of myCustomers) {
            const visits = freqMap[customer.classification] || 1;
            for (let v = 0; v < visits && v < weekDays.length; v++) {
              const dayIndex = Math.floor((v * weekDays.length) / visits);
              plans.push({
                organization_id: orgId,
                distributor_id: distId,
                customer_id: customer.id,
                customer_name: customer.name,
                planned_date: weekDays[dayIndex],
                status: 'planned',
              });
            }
          }
        }

        if (plans.length > 0) {
          for (let i = 0; i < plans.length; i += 100) {
            const batch = plans.slice(i, i + 100);
            const { error: insertErr } = await supabase.from('visit_plans').insert(batch);
            if (!insertErr) visitsCreated += batch.length;
          }
        }
      }
    }

    return new Response(JSON.stringify({
      classified: updates.length,
      a_count: classMap.A.length,
      b_count: classMap.B.length,
      c_count: classMap.C.length,
      visits_created: visitsCreated,
    }), { headers });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
});

function getNextMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 1 : (8 - day);
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function getWeekDays(mondayStr: string): string[] {
  const monday = new Date(mondayStr);
  const days: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}
