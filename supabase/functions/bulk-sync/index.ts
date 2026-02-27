/**
 * Bulk Sync Edge Function
 * Accepts batched offline operations from distributors.
 * Processes sequentially respecting dependency ordering.
 * Returns per-operation results for partial success/failure.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface SyncOperation {
  id: string;
  type: 'ADD_CUSTOMER' | 'CREATE_SALE' | 'ADD_COLLECTION' | 'CREATE_RETURN' | 'TRANSFER_TO_WAREHOUSE';
  payload: Record<string, unknown>;
  idempotencyKey: string;
}

interface SyncResult {
  id: string;
  status: 'synced' | 'failed' | 'deferred';
  serverId?: string;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claims.claims.sub as string;

    // Rate limit: 10 bulk-sync calls per minute per user
    const { data: rlData } = await supabase.rpc('check_endpoint_rate_limit', {
      p_identifier: userId,
      p_endpoint: 'bulk-sync',
      p_max_requests: 10,
      p_window_seconds: 60,
    });
    if (rlData && !rlData.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limited' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const operations: SyncOperation[] = body.operations;

    if (!Array.isArray(operations) || operations.length === 0) {
      return new Response(JSON.stringify({ error: 'No operations provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cap at 100 operations per batch
    if (operations.length > 100) {
      return new Response(JSON.stringify({ error: 'Max 100 operations per batch' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Track ID mappings within this batch (local → server)
    const customerIdMap = new Map<string, string>();
    const saleIdMap = new Map<string, string>();
    const results: SyncResult[] = [];

    for (const op of operations) {
      try {
        const result = await processOperation(supabase, op, customerIdMap, saleIdMap);
        results.push(result);
      } catch (err) {
        results.push({
          id: op.id,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Write audit summary
    const syncedCount = results.filter(r => r.status === 'synced').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    console.log(`[bulk-sync] user=${userId} total=${operations.length} synced=${syncedCount} failed=${failedCount}`);

    return new Response(JSON.stringify({
      results,
      summary: { total: operations.length, synced: syncedCount, failed: failedCount },
      idMappings: {
        customers: Object.fromEntries(customerIdMap),
        sales: Object.fromEntries(saleIdMap),
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[bulk-sync] Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processOperation(
  supabase: ReturnType<typeof createClient>,
  op: SyncOperation,
  customerIdMap: Map<string, string>,
  saleIdMap: Map<string, string>,
): Promise<SyncResult> {
  switch (op.type) {
    case 'ADD_CUSTOMER': {
      const { data, error } = await supabase.from('customers').insert({
        name: op.payload.name as string,
        phone: op.payload.phone as string || null,
        location: op.payload.location as string || null,
        organization_id: op.payload.organizationId as string,
        created_by: op.payload.createdBy as string,
      }).select('id').single();

      if (error) return { id: op.id, status: 'failed', error: error.message };
      
      if (data?.id && op.payload.localId) {
        customerIdMap.set(op.payload.localId as string, data.id);
      }
      return { id: op.id, status: 'synced', serverId: data?.id };
    }

    case 'CREATE_SALE': {
      let customerId = op.payload.customerId as string;
      // Resolve within-batch customer mapping
      if (customerId.startsWith('local_')) {
        const mapped = customerIdMap.get(customerId);
        if (!mapped) return { id: op.id, status: 'deferred', error: 'Customer not yet synced' };
        customerId = mapped;
      }

      const { data, error } = await supabase.rpc('create_distributor_sale_rpc', {
        p_customer_id: customerId,
        p_items: op.payload.items,
        p_payment_type: (op.payload.paymentType as string) || 'CASH',
      });

      if (error) return { id: op.id, status: 'failed', error: error.message };
      
      if (data && op.payload.localSaleId) {
        saleIdMap.set(op.payload.localSaleId as string, data as string);
      }
      return { id: op.id, status: 'synced', serverId: data as string };
    }

    case 'ADD_COLLECTION': {
      let saleId = op.payload.saleId as string;
      if (saleId.startsWith('local_')) {
        const mapped = saleIdMap.get(saleId);
        if (!mapped) return { id: op.id, status: 'deferred', error: 'Sale not yet synced' };
        saleId = mapped;
      }

      const { error } = await supabase.rpc('add_collection_rpc', {
        p_sale_id: saleId,
        p_amount: op.payload.amount as number,
        p_notes: (op.payload.notes as string) || null,
      });

      if (error) return { id: op.id, status: 'failed', error: error.message };
      return { id: op.id, status: 'synced' };
    }

    case 'CREATE_RETURN': {
      let saleId = op.payload.saleId as string;
      if (saleId.startsWith('local_')) {
        const mapped = saleIdMap.get(saleId);
        if (!mapped) return { id: op.id, status: 'deferred', error: 'Sale not yet synced' };
        saleId = mapped;
      }

      const { error } = await supabase.rpc('create_distributor_return_rpc', {
        p_sale_id: saleId,
        p_items: op.payload.items,
        p_reason: (op.payload.reason as string) || null,
      });

      if (error) return { id: op.id, status: 'failed', error: error.message };
      return { id: op.id, status: 'synced' };
    }

    case 'TRANSFER_TO_WAREHOUSE': {
      const { error } = await supabase.rpc('transfer_to_main_warehouse_rpc', {
        p_items: op.payload.items,
      });

      if (error) return { id: op.id, status: 'failed', error: error.message };
      return { id: op.id, status: 'synced' };
    }

    default:
      return { id: op.id, status: 'failed', error: `Unknown operation type: ${op.type}` };
  }
}
