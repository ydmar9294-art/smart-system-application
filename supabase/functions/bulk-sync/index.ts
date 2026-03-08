/**
 * Bulk Sync Edge Function
 * Accepts batched offline operations from distributors.
 * Processes sequentially respecting dependency ordering.
 * Returns per-operation results for partial success/failure.
 * Includes idempotency checking to prevent duplicate operations.
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
  status: 'synced' | 'failed' | 'deferred' | 'duplicate';
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

    // Validate token using getClaims (signing-keys compatible)
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

    // --- Idempotency check ---
    // Collect all idempotency keys and check against audit_logs
    const idempotencyKeys = operations
      .map(op => op.idempotencyKey)
      .filter(Boolean);

    const processedKeys = new Set<string>();
    if (idempotencyKeys.length > 0) {
      const { data: existingLogs } = await supabase
        .from('audit_logs')
        .select('entity_id')
        .eq('action', 'BULK_SYNC_OP')
        .in('entity_id', idempotencyKeys);

      if (existingLogs) {
        for (const log of existingLogs) {
          if (log.entity_id) processedKeys.add(log.entity_id);
        }
      }
    }

    // Track ID mappings within this batch (local → server)
    const customerIdMap = new Map<string, string>();
    const saleIdMap = new Map<string, string>();
    const results: SyncResult[] = [];

    for (const op of operations) {
      // Skip already-processed operations (idempotency)
      if (op.idempotencyKey && processedKeys.has(op.idempotencyKey)) {
        results.push({ id: op.id, status: 'duplicate' });
        continue;
      }

      try {
        const result = await processOperation(supabase, op, customerIdMap, saleIdMap);
        results.push(result);

        // Record idempotency key on success
        if (result.status === 'synced' && op.idempotencyKey) {
          await supabase.from('audit_logs').insert({
            action: 'BULK_SYNC_OP',
            entity_type: op.type,
            entity_id: op.idempotencyKey,
            user_id: userId,
            details: { serverId: result.serverId },
          }).then(() => {});  // fire-and-forget
        }
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
    const duplicateCount = results.filter(r => r.status === 'duplicate').length;

    console.log(`[bulk-sync] user=${userId} total=${operations.length} synced=${syncedCount} failed=${failedCount} duplicates=${duplicateCount}`);

    return new Response(JSON.stringify({
      results,
      summary: { total: operations.length, synced: syncedCount, failed: failedCount, duplicates: duplicateCount },
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
        p_discount_type: (op.payload.discountType as string) || null,
        p_discount_percentage: (op.payload.discountPercentage as number) || 0,
        p_discount_value: (op.payload.discountValue as number) || 0,
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
