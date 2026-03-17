/**
 * check-alerts Edge Function
 * 
 * Scans for alert conditions and creates notifications:
 * 1. Low stock (stock <= min_stock)
 * 2. Collection delays (credit sale > 7 days without payment)
 * 3. Missed visits (visit_plans with status=planned and date passed)
 * 4. Low distributor inventory (quantity < 5)
 * 
 * Deduplication: won't create same alert type for same entity within 24h.
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

    // Optional auth for manual trigger; cron calls without auth
    const authHeader = req.headers.get('Authorization');
    let orgFilter: string | null = null;

    if (authHeader && !authHeader.includes(Deno.env.get('SUPABASE_ANON_KEY') || '___')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .single();
        orgFilter = profile?.organization_id || null;
      }
    }

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    let totalAlerts = 0;

    // Helper: check if notification already sent recently
    async function wasRecentlySent(userId: string, type: string, entityId: string): Promise<boolean> {
      const { data } = await supabase
        .from('user_notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('type', type)
        .gte('created_at', twentyFourHoursAgo)
        .like('description', `%${entityId.substring(0, 8)}%`)
        .limit(1);
      return (data?.length || 0) > 0;
    }

    // Helper: send notification
    async function sendNotification(userId: string, title: string, description: string, type: string) {
      const { error } = await supabase.from('user_notifications').insert({
        user_id: userId,
        title,
        description,
        type,
      });
      if (!error) totalAlerts++;
    }

    // Get all orgs to process (or just one if org-filtered)
    let orgs: { id: string }[] = [];
    if (orgFilter) {
      orgs = [{ id: orgFilter }];
    } else {
      const { data } = await supabase.from('organizations').select('id');
      orgs = data || [];
    }

    for (const org of orgs) {
      // Get org members by role
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, role, employee_type')
        .eq('organization_id', org.id)
        .eq('is_active', true);

      if (!profiles || profiles.length === 0) continue;

      const owners = profiles.filter(p => p.role === 'OWNER');
      const warehouseKeepers = profiles.filter(p => p.employee_type === 'WAREHOUSE_KEEPER');
      const accountants = profiles.filter(p => p.employee_type === 'ACCOUNTANT');
      const salesManagers = profiles.filter(p => p.employee_type === 'SALES_MANAGER');
      const fieldAgents = profiles.filter(p => p.employee_type === 'FIELD_AGENT');

      // ── 1. Low Stock Alerts ──
      const { data: lowStockProducts } = await supabase
        .from('products')
        .select('id, name, stock, min_stock')
        .eq('organization_id', org.id)
        .eq('is_deleted', false);

      for (const p of (lowStockProducts || [])) {
        if (p.stock <= p.min_stock) {
          const isOut = p.stock === 0;
          const title = isOut ? 'نفاد المخزون' : 'مخزون منخفض';
          const desc = isOut
            ? `${p.name} — نفد تماماً [${p.id.substring(0, 8)}]`
            : `${p.name} — متبقي ${p.stock} (الحد الأدنى: ${p.min_stock}) [${p.id.substring(0, 8)}]`;
          const type = isOut ? 'error' : 'warning';

          for (const recipient of [...owners, ...warehouseKeepers]) {
            if (!(await wasRecentlySent(recipient.id, type, p.id))) {
              await sendNotification(recipient.id, title, desc, type);
            }
          }
        }
      }

      // ── 2. Collection Delay Alerts ──
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: dueSales } = await supabase
        .from('sales')
        .select('id, customer_name, remaining, created_at')
        .eq('organization_id', org.id)
        .eq('is_voided', false)
        .eq('payment_type', 'CREDIT')
        .gt('remaining', 0)
        .lt('created_at', sevenDaysAgo);

      for (const sale of (dueSales || [])) {
        const desc = `${sale.customer_name} — ${Number(sale.remaining).toLocaleString()} ل.س متأخرة [${sale.id.substring(0, 8)}]`;
        for (const recipient of [...owners, ...accountants]) {
          if (!(await wasRecentlySent(recipient.id, 'due_invoice', sale.id))) {
            await sendNotification(recipient.id, 'تأخر تحصيل', desc, 'due_invoice');
          }
        }
      }

      // ── 3. Missed Visit Alerts ──
      const today = now.toISOString().split('T')[0];
      const { data: missedVisits } = await supabase
        .from('visit_plans')
        .select('id, distributor_id, customer_name, planned_date')
        .eq('organization_id', org.id)
        .eq('status', 'planned')
        .lt('planned_date', today);

      for (const visit of (missedVisits || [])) {
        // Update status to missed
        await supabase
          .from('visit_plans')
          .update({ status: 'missed' })
          .eq('id', visit.id);

        const desc = `${visit.customer_name} — ${visit.planned_date} [${visit.id.substring(0, 8)}]`;
        for (const recipient of salesManagers) {
          if (!(await wasRecentlySent(recipient.id, 'missed_visit', visit.id))) {
            await sendNotification(recipient.id, 'زيارة مفقودة', desc, 'missed_visit');
          }
        }
      }

      // ── 4. Low Distributor Inventory ──
      const { data: lowDistInv } = await supabase
        .from('distributor_inventory')
        .select('id, distributor_id, product_name, quantity')
        .eq('organization_id', org.id)
        .lt('quantity', 5);

      for (const item of (lowDistInv || [])) {
        if (item.quantity > 0) {
          const desc = `${item.product_name} — متبقي ${item.quantity} فقط [${item.id.substring(0, 8)}]`;
          const agent = fieldAgents.find(f => f.id === item.distributor_id);
          if (agent && !(await wasRecentlySent(agent.id, 'warning', item.id))) {
            await sendNotification(agent.id, 'مخزون مندوب منخفض', desc, 'warning');
          }
        }
      }
    }

    return new Response(JSON.stringify({ alerts_sent: totalAlerts }), { headers });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
});
