/**
 * Bulk Sync Edge Function
 * Accepts batched offline operations from distributors.
 * Processes sequentially respecting dependency ordering.
 * Returns per-operation results for partial success/failure.
 * Includes idempotency checking to prevent duplicate operations.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCorsPreflightIfNeeded } from '../_shared/cors.ts'

interface SyncOperation {
  id: string;
  type: 'ADD_CUSTOMER' | 'CREATE_SALE' | 'ADD_COLLECTION' | 'CREATE_RETURN' | 'TRANSFER_TO_WAREHOUSE' | 'GPS_LOG' | 'ROUTE_VISIT';
  payload: Record<string, unknown>;
  idempotencyKey: string;
  /** Client-side HMAC signature for integrity verification */
  _signature?: string;
}

interface SyncResult {
  id: string;
  status: 'synced' | 'failed' | 'deferred' | 'duplicate';
  serverId?: string;
  error?: string;
}

Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreflightIfNeeded(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

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

    // Service-role client for audit/idempotency logging (bypasses RLS)
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Full server-side user validation
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;

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

    // --- Handle tampered action reports ---
    if (body.reportTampered === true) {
      await serviceClient.from('audit_logs').insert({
        action: 'TAMPERED_ACTION_REJECTED',
        entity_type: body.actionType || 'UNKNOWN',
        entity_id: body.actionId || null,
        user_id: userId,
        details: {
          reason: body.reason,
          idempotencyKey: body.idempotencyKey,
          reportedAt: body.timestamp,
        },
      });
      console.warn(`[bulk-sync] TAMPERED ACTION uid=${userId.substring(0, 8)}… type=${body.actionType} reason=${body.reason}`);
      return new Response(JSON.stringify({ logged: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // --- Reject unsigned operations and audit log them ---
    const validOperations: SyncOperation[] = [];
    const rejectedResults: SyncResult[] = [];
    
    for (const op of operations) {
      if (!op._signature) {
        rejectedResults.push({ id: op.id, status: 'failed', error: 'Missing client-side HMAC signature' });
        // Audit log unsigned operation
        await serviceClient.from('audit_logs').insert({
          action: 'UNSIGNED_BULK_OP_REJECTED',
          entity_type: op.type,
          entity_id: op.idempotencyKey,
          user_id: userId,
          details: { operationId: op.id },
        });
      } else {
        validOperations.push(op);
      }
    }

    // --- Idempotency check (only for valid operations) ---
    const idempotencyKeys = validOperations
      .map(op => op.idempotencyKey)
      .filter(Boolean);

    const processedKeys = new Set<string>();
    if (idempotencyKeys.length > 0) {
      const { data: existingLogs } = await serviceClient
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

    // --- Batch GPS_LOG operations for efficiency ---
    const gpsOps: SyncOperation[] = [];
    const nonGpsOps: SyncOperation[] = [];
    for (const op of validOperations) {
      if (op.idempotencyKey && processedKeys.has(op.idempotencyKey)) {
        results.push({ id: op.id, status: 'duplicate' });
        continue;
      }
      if (op.type === 'GPS_LOG') {
        gpsOps.push(op);
      } else {
        nonGpsOps.push(op);
      }
    }

    // Batch insert all GPS logs in one query
    if (gpsOps.length > 0) {
      const gpsRows = gpsOps.map(op => ({
        user_id: userId,
        latitude: op.payload.latitude as number,
        longitude: op.payload.longitude as number,
        accuracy: (op.payload.accuracy as number) || null,
        organization_id: op.payload.organizationId as string,
        visit_type: (op.payload.visitType as string) || 'route_point',
        recorded_at: (op.payload.recordedAt as string) || new Date().toISOString(),
        is_synced: true,
        synced_at: new Date().toISOString(),
      }));

      const { error: gpsErr } = await supabase.from('distributor_locations').insert(gpsRows);
      
      for (const op of gpsOps) {
        if (gpsErr) {
          results.push({ id: op.id, status: 'failed', error: gpsErr.message });
        } else {
          results.push({ id: op.id, status: 'synced' });
          if (op.idempotencyKey) {
            // Batch audit logs for GPS
            await serviceClient.from('audit_logs').insert({
              action: 'BULK_SYNC_OP',
              entity_type: 'GPS_LOG',
              entity_id: op.idempotencyKey,
              user_id: userId,
              details: {},
            });
          }
        }
      }
    }

    // Process remaining operations sequentially
    for (const op of nonGpsOps) {
      try {
        const result = await processOperation(supabase, op, customerIdMap, saleIdMap, userId);
        results.push(result);

        if (result.status === 'synced' && op.idempotencyKey) {
          await serviceClient.from('audit_logs').insert({
            action: 'BULK_SYNC_OP',
            entity_type: op.type,
            entity_id: op.idempotencyKey,
            user_id: userId,
            details: { serverId: result.serverId },
          });
        }
      } catch (err) {
        results.push({
          id: op.id,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const syncedCount = results.filter(r => r.status === 'synced').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const duplicateCount = results.filter(r => r.status === 'duplicate').length;

    // Structured log (no sensitive data)
    console.info(`[bulk-sync] uid=${userId.substring(0, 8)}… ops=${operations.length} ok=${syncedCount} err=${failedCount} dup=${duplicateCount}`);

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
      status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});

async function processOperation(
  supabase: ReturnType<typeof createClient>,
  op: SyncOperation,
  customerIdMap: Map<string, string>,
  saleIdMap: Map<string, string>,
  userId: string,
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

    case 'GPS_LOG': {
      const { error } = await supabase.from('distributor_locations').insert({
        user_id: userId,
        latitude: op.payload.latitude as number,
        longitude: op.payload.longitude as number,
        accuracy: (op.payload.accuracy as number) || null,
        organization_id: op.payload.organizationId as string,
        visit_type: (op.payload.visitType as string) || 'route_point',
        recorded_at: (op.payload.recordedAt as string) || new Date().toISOString(),
        is_synced: true,
        synced_at: new Date().toISOString(),
      });
      if (error) return { id: op.id, status: 'failed', error: error.message };
      return { id: op.id, status: 'synced' };
    }

    case 'ROUTE_VISIT': {
      const { error } = await supabase.from('route_stops').update({
        status: op.payload.status as string,
        notes: (op.payload.notes as string) || null,
        visited_at: (op.payload.visitedAt as string) || new Date().toISOString(),
      }).eq('id', op.payload.stopId as string);
      if (error) return { id: op.id, status: 'failed', error: error.message };
      return { id: op.id, status: 'synced' };
    }

    default:
      return { id: op.id, status: 'failed', error: `Unknown operation type: ${op.type}` };
  }
}
