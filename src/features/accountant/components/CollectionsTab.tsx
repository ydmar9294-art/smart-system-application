import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet, ChevronDown, ArrowDownCircle, ArrowUpCircle, Scale } from 'lucide-react';
import { CollectionListItem } from '@/components/ui/MemoizedListItems';
import { VirtualList } from '@/components/ui/VirtualList';
import { CURRENCY } from '@/constants';
import { useAuth } from '@/store/AuthContext';
import { usePaymentsPaginatedQuery } from '@/hooks/queries';
import { InfiniteScrollTrigger } from '@/components/ui/InfiniteScrollList';

type DirectionFilter = 'ALL' | 'IN' | 'OUT';

const CollectionsTab: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
  const { organization, role } = useAuth();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showReversed, setShowReversed] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('ALL');

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
    if (directionFilter !== 'ALL') {
      const dir = c.direction === 'OUT' ? 'OUT' : 'IN';
      if (dir !== directionFilter) return false;
    }
    return true;
  }), [collections, showReversed, dateFrom, dateTo, directionFilter]);

  const totals = useMemo(() => {
    let received = 0, paidOut = 0;
    for (const c of filteredCollections) {
      if (c.isReversed) continue;
      if (c.direction === 'OUT') paidOut += Number(c.amount);
      else received += Number(c.amount);
    }
    return { received, paidOut, net: received - paidOut, count: filteredCollections.filter(c => !c.isReversed).length };
  }, [filteredCollections]);

  return (
    <div className="space-y-3">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-emerald-500/10 rounded-2xl p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <ArrowDownCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <p className="text-[9px] text-muted-foreground font-bold">{t('accountant.totalReceived')}</p>
          </div>
          <p className="text-base font-black text-emerald-600 dark:text-emerald-400">{totals.received.toLocaleString(locale)}</p>
          <p className="text-[9px] text-muted-foreground">{CURRENCY}</p>
        </div>
        <div className="bg-orange-500/10 rounded-2xl p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <ArrowUpCircle className="w-3 h-3 text-orange-600 dark:text-orange-400" />
            <p className="text-[9px] text-muted-foreground font-bold">{t('accountant.totalPaidOut')}</p>
          </div>
          <p className="text-base font-black text-orange-600 dark:text-orange-400">{totals.paidOut.toLocaleString(locale)}</p>
          <p className="text-[9px] text-muted-foreground">{CURRENCY}</p>
        </div>
        <div className="bg-primary/10 rounded-2xl p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Scale className="w-3 h-3 text-primary" />
            <p className="text-[9px] text-muted-foreground font-bold">{t('accountant.netCollections')}</p>
          </div>
          <p className={`text-base font-black ${totals.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}>
            {totals.net.toLocaleString(locale)}
          </p>
          <p className="text-[9px] text-muted-foreground">{CURRENCY}</p>
        </div>
      </div>

      {/* Direction filter chips */}
      <div className="flex gap-2">
        {([
          { v: 'ALL' as const, label: t('accountant.allTypes') },
          { v: 'IN' as const, label: t('accountant.receiptType') },
          { v: 'OUT' as const, label: t('accountant.paymentType') },
        ]).map(opt => (
          <button
            key={opt.v}
            onClick={() => setDirectionFilter(opt.v)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              directionFilter === opt.v
                ? opt.v === 'OUT'
                  ? 'bg-orange-500 text-white'
                  : opt.v === 'IN'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
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
        <>
          {filteredCollections.length > 30 ? (
            <VirtualList
              items={filteredCollections}
              itemHeight={88}
              overscan={5}
              containerHeight={480}
              className="rounded-2xl"
              onEndReached={hasNextPage ? fetchNextPage : undefined}
              renderItem={(coll) => (
                <div className="px-1 pb-2">
                  <CollectionListItem key={coll.id} coll={coll} locale={locale} t={t} />
                </div>
              )}
            />
          ) : (
            <div className="space-y-2">
              {filteredCollections.map((coll) => (
                <CollectionListItem key={coll.id} coll={coll} locale={locale} t={t} />
              ))}
            </div>
          )}
          <InfiniteScrollTrigger
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={!!hasNextPage}
            fetchNextPage={fetchNextPage}
            totalLoaded={totalLoaded}
          />
        </>
      )}
    </div>
  );
};

export default CollectionsTab;
