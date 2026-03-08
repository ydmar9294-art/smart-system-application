import React, { useState, useEffect, useMemo } from 'react';
import { logger } from '@/lib/logger';
import { useTranslation } from 'react-i18next';
import { Wallet, ChevronDown, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CURRENCY } from '@/constants';

interface Collection {
  id: string;
  sale_id: string;
  amount: number;
  notes: string | null;
  is_reversed: boolean;
  reverse_reason: string | null;
  created_at: string;
  customer_name?: string;
}

const CollectionsTab: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showReversed, setShowReversed] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => { loadCollections(); }, []);

  const loadCollections = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('collections')
        .select('id, sale_id, amount, notes, is_reversed, reverse_reason, created_at, sales!collections_sale_id_fkey(customer_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      
      const mapped = (data || []).map((c: any) => ({
        id: c.id,
        sale_id: c.sale_id,
        amount: c.amount,
        notes: c.notes,
        is_reversed: c.is_reversed,
        reverse_reason: c.reverse_reason,
        created_at: c.created_at,
        customer_name: c.sales?.customer_name || t('common.unspecified')
      }));
      setCollections(mapped);
    } catch (error) { logger.error('Error loading collections', 'CollectionsTab'); }
    finally { setLoading(false); }
  };

  const filteredCollections = useMemo(() => collections.filter(c => {
    if (!showReversed && c.is_reversed) return false;
    if (dateFrom && new Date(c.created_at) < new Date(dateFrom)) return false;
    if (dateTo) { const to = new Date(dateTo); to.setHours(23,59,59); if (new Date(c.created_at) > to) return false; }
    return true;
  }), [collections, showReversed, dateFrom, dateTo]);

  const totalAmount = useMemo(() => 
    filteredCollections.filter(c => !c.is_reversed).reduce((sum, c) => sum + Number(c.amount), 0),
    [filteredCollections]
  );

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-emerald-500/10 rounded-2xl p-4 text-center">
          <p className="text-[9px] text-muted-foreground font-bold">{t('accountant.totalCollections')}</p>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{totalAmount.toLocaleString(locale)}</p>
          <p className="text-[10px] text-muted-foreground">{CURRENCY}</p>
        </div>
        <div className="bg-muted rounded-2xl p-4 text-center">
          <p className="text-[9px] text-muted-foreground font-bold">{t('common.operationCount')}</p>
          <p className="text-xl font-black text-foreground">{filteredCollections.filter(c => !c.is_reversed).length}</p>
        </div>
      </div>

      {/* Filters */}
      <button onClick={() => setShowFilters(!showFilters)}
        className="flex items-center gap-2 text-xs text-muted-foreground font-bold">
        <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        {t('common.filterOptions')}
      </button>
      {showFilters && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="bg-muted rounded-xl px-3 py-2 text-sm font-medium text-foreground" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="bg-muted rounded-xl px-3 py-2 text-sm font-medium text-foreground" />
          </div>
          <label className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2 cursor-pointer">
            <input type="checkbox" checked={showReversed} onChange={(e) => setShowReversed(e.target.checked)} className="w-4 h-4" />
            <span className="text-xs font-bold text-foreground">{t('common.showCancelled')}</span>
          </label>
        </div>
      )}

      {/* Collections List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
        </div>
      ) : filteredCollections.length === 0 ? (
        <div className="text-center py-12">
          <Wallet className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-bold">{t('accountant.noCollections')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredCollections.map((coll) => (
            <div key={coll.id} className={`bg-card p-4 rounded-2xl shadow-sm ${coll.is_reversed ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="font-bold text-foreground text-sm">{coll.customer_name}</p>
                </div>
                {coll.is_reversed ? (
                  <span className="bg-destructive/10 text-destructive px-2 py-0.5 rounded-lg text-[10px] font-bold">{t('accountant.cancelled')}</span>
                ) : (
                  <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-lg text-[10px] font-bold">{t('accountant.done')}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <p className="font-black text-lg text-emerald-600 dark:text-emerald-400">{Number(coll.amount).toLocaleString(locale)} {CURRENCY}</p>
                <p className="text-xs text-muted-foreground">{new Date(coll.created_at).toLocaleDateString(locale)}</p>
              </div>
              {coll.notes && <p className="text-xs text-muted-foreground mt-1">{coll.notes}</p>}
              {coll.is_reversed && coll.reverse_reason && (
                <p className="text-xs text-destructive mt-1">{t('common.cancelledReason')}: {coll.reverse_reason}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CollectionsTab;
