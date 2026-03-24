import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw, Search, ChevronDown } from 'lucide-react';
import { CURRENCY } from '@/constants';
import { usePurchaseReturnsQuery } from '../hooks/useAccountantData';
import { Skeleton } from '@/components/ui/skeleton';
import { VirtualList } from '@/components/ui/VirtualList';

const PurchaseReturnsTab: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
  const { data: returns = [], isLoading } = usePurchaseReturnsQuery();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filteredReturns = useMemo(() => returns.filter(r => {
    if (searchTerm && r.supplier_name && !r.supplier_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (dateFrom && new Date(r.created_at) < new Date(dateFrom)) return false;
    if (dateTo) { const to = new Date(dateTo); to.setHours(23, 59, 59); if (new Date(r.created_at) > to) return false; }
    return true;
  }), [returns, searchTerm, dateFrom, dateTo]);

  const totalAmount = useMemo(() => 
    filteredReturns.reduce((sum, r) => sum + Number(r.total_amount), 0),
    [filteredReturns]
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input type="text" placeholder={t('accountant.searchBySupplier')} value={searchTerm}
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

      <div className="bg-destructive/10 rounded-2xl p-4 text-center">
        <p className="text-[9px] text-muted-foreground font-bold">{t('accountant.totalPurchaseReturns')}</p>
        <p className="text-xl font-black text-destructive">{totalAmount.toLocaleString(locale)} {CURRENCY}</p>
        <p className="text-xs text-muted-foreground mt-1">{filteredReturns.length} {t('common.returnOperation')}</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : filteredReturns.length === 0 ? (
        <div className="text-center py-12">
          <RotateCcw className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-bold">{t('accountant.noPurchaseReturns')}</p>
        </div>
      ) : filteredReturns.length > 30 ? (
        <VirtualList
          items={filteredReturns}
          itemHeight={80}
          overscan={5}
          containerHeight={480}
          className="rounded-2xl"
          renderItem={(ret) => (
            <div className="px-1 pb-2">
              <PurchaseReturnCard ret={ret} locale={locale} t={t} />
            </div>
          )}
        />
      ) : (
        <div className="space-y-2">
          {filteredReturns.map((ret) => (
            <PurchaseReturnCard key={ret.id} ret={ret} locale={locale} t={t} />
          ))}
        </div>
      )}
    </div>
  );
};

const PurchaseReturnCard = React.memo(({ ret, locale, t }: { ret: any; locale: string; t: any }) => (
  <div className="bg-card p-4 rounded-2xl shadow-sm">
    <div className="flex items-start justify-between mb-1">
      <div>
        <p className="font-bold text-foreground">{ret.supplier_name || t('common.noSupplier')}</p>
        <p className="text-xs text-muted-foreground">{new Date(ret.created_at).toLocaleDateString(locale)}</p>
      </div>
      <p className="font-black text-destructive">{Number(ret.total_amount).toLocaleString(locale)} {CURRENCY}</p>
    </div>
    {ret.reason && <p className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-lg mt-2">{ret.reason}</p>}
  </div>
));

PurchaseReturnCard.displayName = 'PurchaseReturnCard';

export default PurchaseReturnsTab;
