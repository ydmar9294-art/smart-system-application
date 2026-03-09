import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingCart, Search, Package, ChevronDown } from 'lucide-react';
import { VirtualList } from '@/components/ui/VirtualList';
import { CURRENCY } from '@/constants';
import { useAuth } from '@/store/AuthContext';
import { usePurchasesPaginatedQuery } from '@/hooks/queries';
import { InfiniteScrollTrigger } from '@/components/ui/InfiniteScrollList';

const PurchasesTab: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
  const { organization, role } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const {
    data: purchases,
    isLoading: loading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    totalLoaded,
  } = usePurchasesPaginatedQuery(organization?.id, role);

  const filteredPurchases = useMemo(() => (purchases || []).filter(p => {
    if (searchTerm && !p.product_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        (!p.supplier_name || !p.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()))) return false;
    const ts = typeof p.created_at === 'number' ? p.created_at : new Date(p.created_at).getTime();
    if (dateFrom && ts < new Date(dateFrom).getTime()) return false;
    if (dateTo) { const to = new Date(dateTo); to.setHours(23,59,59); if (ts > to.getTime()) return false; }
    return true;
  }), [purchases, searchTerm, dateFrom, dateTo]);

  const totalAmount = filteredPurchases.reduce((sum, p) => sum + Number(p.total_price), 0);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input type="text" placeholder={t('accountant.searchByProductOrSupplier')} value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-muted border-none rounded-xl px-12 py-3 font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground" />
      </div>

      <button onClick={() => setShowFilters(!showFilters)}
        className="flex items-center gap-2 text-xs text-muted-foreground font-bold">
        <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        {t('common.filterByDate')}
      </button>
      {showFilters && (
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="bg-muted rounded-xl px-3 py-2 text-sm font-medium text-foreground" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="bg-muted rounded-xl px-3 py-2 text-sm font-medium text-foreground" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-blue-500/10 rounded-2xl p-4 text-center">
          <p className="text-[9px] text-muted-foreground font-bold">{t('accountant.totalPurchases')}</p>
          <p className="text-xl font-black text-blue-600 dark:text-blue-400">{totalAmount.toLocaleString(locale)}</p>
          <p className="text-[10px] text-muted-foreground">{CURRENCY}</p>
        </div>
        <div className="bg-muted rounded-2xl p-4 text-center">
          <p className="text-[9px] text-muted-foreground font-bold">{t('common.operationCount')}</p>
          <p className="text-xl font-black text-foreground">{filteredPurchases.length}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
        </div>
      ) : filteredPurchases.length === 0 ? (
        <div className="text-center py-12">
          <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-bold">{t('accountant.noPurchases')}</p>
        </div>
      ) : (
        <>
          {filteredPurchases.length > 30 ? (
            <VirtualList
              items={filteredPurchases}
              itemHeight={88}
              overscan={5}
              containerHeight={480}
              className="rounded-2xl"
              onEndReached={hasNextPage ? fetchNextPage : undefined}
              renderItem={(purchase) => (
                <div className="px-1 pb-2">
                  <div className="bg-card p-4 rounded-2xl shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                          <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="font-bold text-foreground">{purchase.product_name}</p>
                          <p className="text-xs text-muted-foreground">{purchase.supplier_name || t('common.noSupplier')}</p>
                        </div>
                      </div>
                      <p className="font-black text-blue-600 dark:text-blue-400">{Number(purchase.total_price).toLocaleString(locale)}</p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{purchase.quantity} × {Number(purchase.unit_price).toLocaleString(locale)}</span>
                      <span>{new Date(purchase.created_at).toLocaleDateString(locale)}</span>
                    </div>
                  </div>
                </div>
              )}
            />
          ) : (
            <div className="space-y-2">
              {filteredPurchases.map((purchase) => (
                <div key={purchase.id} className="bg-card p-4 rounded-2xl shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                        <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{purchase.product_name}</p>
                        <p className="text-xs text-muted-foreground">{purchase.supplier_name || t('common.noSupplier')}</p>
                      </div>
                    </div>
                    <p className="font-black text-blue-600 dark:text-blue-400">{Number(purchase.total_price).toLocaleString(locale)}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{purchase.quantity} × {Number(purchase.unit_price).toLocaleString(locale)}</span>
                    <span>{new Date(purchase.created_at).toLocaleDateString(locale)}</span>
                  </div>
                </div>
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

export default PurchasesTab;
