/**
 * Pending Deliveries Panel (Distributor)
 * Shows deliveries reserved from the main warehouse and awaiting this
 * distributor's confirmation. Confirming moves the stock into his warehouse,
 * rejecting returns it to the main warehouse. Online-only by design.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Truck, Check, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { extractErrorMessage } from '@/lib/errorHandler';
import { logger } from '@/lib/logger';

interface PendingItem {
  product_name: string;
  quantity: number;
  pack_quantity: number;
  piece_quantity: number;
}

interface PendingDelivery {
  id: string;
  created_at: string;
  notes: string | null;
  items: PendingItem[];
}

interface Props {
  isOnline: boolean;
  onChanged?: () => void;
}

const PendingDeliveriesPanel: React.FC<Props> = ({ isOnline, onChanged }) => {
  const [deliveries, setDeliveries] = useState<PendingDelivery[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isOnline) return;
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) return;

      const { data, error: err } = await supabase
        .from('deliveries')
        .select('id, created_at, notes, delivery_items(product_name, quantity, pack_quantity, piece_quantity)')
        .eq('distributor_id', uid)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20);

      if (err) throw err;
      setDeliveries((data || []).map((d: any) => ({
        id: d.id,
        created_at: d.created_at,
        notes: d.notes,
        items: d.delivery_items || [],
      })));
    } catch (e) {
      logger.error('Failed to load pending deliveries', 'PendingDeliveries');
    }
  }, [isOnline]);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, accept: boolean) => {
    setBusyId(id);
    setError(null);
    try {
      const { error: err } = accept
        ? await supabase.rpc('confirm_delivery_rpc', { p_delivery_id: id })
        : await supabase.rpc('reject_delivery_rpc', { p_delivery_id: id, p_reason: 'رفض الاستلام من الموزع' });
      if (err) throw err;
      setDeliveries(prev => prev.filter(d => d.id !== id));
      onChanged?.();
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  if (!isOnline || deliveries.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="font-black text-sm flex items-center gap-2 text-amber-600 dark:text-amber-400">
        <Truck className="w-4 h-4" />
        تسليمات بانتظار استلامك ({deliveries.length})
      </h3>

      {error && (
        <div className="bg-destructive/10 text-destructive text-xs font-bold p-3 rounded-2xl">{error}</div>
      )}

      {deliveries.map(d => (
        <div key={d.id} className="bg-card border border-amber-500/30 rounded-[1.5rem] p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-muted-foreground font-bold">
              {new Date(d.created_at).toLocaleString('ar-EG')}
            </span>
            <span className="badge badge-warning text-[9px]">قيد الاستلام</span>
          </div>

          <div className="space-y-1">
            {d.items.map((it, i) => (
              <div key={i} className="flex justify-between text-xs font-bold">
                <span>{it.product_name}</span>
                <span className="text-primary">
                  {it.pack_quantity > 0 ? `${it.pack_quantity} طرد ` : ''}
                  {it.piece_quantity > 0 ? `${it.piece_quantity} قطعة` : ''}
                  {it.pack_quantity === 0 && it.piece_quantity === 0 ? `${it.quantity} قطعة` : ''}
                </span>
              </div>
            ))}
          </div>

          {d.notes && <p className="text-[11px] text-muted-foreground">{d.notes}</p>}

          <div className="flex gap-2">
            <button
              disabled={busyId === d.id}
              onClick={() => act(d.id, true)}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 text-white font-black py-3 rounded-2xl active:scale-95 transition-transform disabled:opacity-50"
            >
              {busyId === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              تأكيد الاستلام
            </button>
            <button
              disabled={busyId === d.id}
              onClick={() => act(d.id, false)}
              className="flex-1 flex items-center justify-center gap-2 bg-destructive/10 text-destructive font-black py-3 rounded-2xl active:scale-95 transition-transform disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              رفض
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default React.memo(PendingDeliveriesPanel);
