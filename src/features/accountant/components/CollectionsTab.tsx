import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet, ChevronDown, Loader2 } from 'lucide-react';
import { CollectionListItem } from '@/components/ui/MemoizedListItems';
import { CURRENCY } from '@/constants';
import { useAuth } from '@/store/AuthContext';
import { usePaymentsPaginatedQuery } from '@/hooks/queries';
import { InfiniteScrollTrigger } from '@/components/ui/InfiniteScrollList';

const CollectionsTab: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
  const { organization, role } = useAuth();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showReversed, setShowReversed] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const {
    data: collections,
    isLoading: loading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    totalLoaded,
  } = usePaymentsPaginatedQuery(organization?.id, role);

  const filteredCollections = useMemo(() => (collections || []).filter(c => {
    if (!showReversed && c.isReversed) return false;
    if (dateFrom && new Date(c.timestamp) < new Date(dateFrom)) return false;
    if (dateTo) { const to = new Date(dateTo); to.setHours(23,59,59); if (new Date(c.timestamp) > to) return false; }
    return true;
  }), [collections, showReversed, dateFrom, dateTo]);

  const totalAmount = useMemo(() => 
    filteredCollections.filter(c => !c.isReversed).reduce((sum, c) => sum + Number(c.amount), 0),
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
          <p className="text-xl font-black text-foreground">{filteredCollections.filter(c => !c.isReversed).length}</p>
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
            <CollectionListItem key={coll.id} coll={coll} locale={locale} t={t} />
          ))}
          
          {/* Infinite scroll trigger */}
          <InfiniteScrollTrigger
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={!!hasNextPage}
            fetchNextPage={fetchNextPage}
            totalLoaded={totalLoaded}
          />
        </div>
      )}
    </div>
  );
};

export default CollectionsTab;
