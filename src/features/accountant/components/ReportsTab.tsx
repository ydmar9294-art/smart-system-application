import React, { useState, useMemo } from 'react';
import { logger } from '@/lib/logger';
import { useTranslation } from 'react-i18next';
import { 
  BarChart3, TrendingUp, TrendingDown, DollarSign,
  ShoppingCart, Wallet, Package, Loader2, Percent, Calendar
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { useFinancialSummary } from '../hooks/useAccountantData';
import { CURRENCY } from '@/constants';
import { Skeleton } from '@/components/ui/skeleton';

type PeriodType = 'all' | 'today' | 'week' | 'month' | 'custom';

const ReportsTab: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
  const { sales, customers, products } = useApp();
  const { data: summary, isLoading } = useFinancialSummary();
  const [period, setPeriod] = useState<PeriodType>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Period filter helper
  const getDateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case 'today': {
        const start = new Date(now); start.setHours(0, 0, 0, 0);
        return { start: start.getTime(), end: now.getTime() };
      }
      case 'week': {
        const start = new Date(now); start.setDate(start.getDate() - 7); start.setHours(0, 0, 0, 0);
        return { start: start.getTime(), end: now.getTime() };
      }
      case 'month': {
        const start = new Date(now); start.setDate(start.getDate() - 30); start.setHours(0, 0, 0, 0);
        return { start: start.getTime(), end: now.getTime() };
      }
      case 'custom': {
        const start = customFrom ? new Date(customFrom).getTime() : 0;
        const endDate = customTo ? new Date(customTo) : now;
        endDate.setHours(23, 59, 59);
        return { start, end: endDate.getTime() };
      }
      default:
        return { start: 0, end: Infinity };
    }
  }, [period, customFrom, customTo]);

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      if (s.isVoided) return false;
      if (getDateRange.start > 0 && s.timestamp < getDateRange.start) return false;
      if (getDateRange.end < Infinity && s.timestamp > getDateRange.end) return false;
      return true;
    });
  }, [sales, getDateRange]);

  // Extract from RPC summary (these are org-wide, not period-filtered)
  const purchasesTotal = summary ? Number(summary.purchases_total) : 0;
  const salesReturnsTotal = summary ? Number(summary.sales_returns_total) : 0;
  const purchaseReturnsTotal = summary ? Number(summary.purchase_returns_total) : 0;
  const collectionsTotal = summary ? Number(summary.collections_total) : 0;
  const totalDiscounts = summary ? Number(summary.total_discounts) : 0;
  const distributorInventory = summary?.distributor_inventory || [];

  const totalSalesCost = useMemo(() => {
    return filteredSales.reduce((sum, sale) => {
      return sum + sale.items.reduce((itemSum, item) => {
        const product = products.find(p => p.id === item.productId);
        const costPrice = product ? product.costPrice : 0;
        return itemSum + (costPrice * item.quantity);
      }, 0);
    }, 0);
  }, [filteredSales, products]);

  const totalSales = useMemo(() => 
    filteredSales.reduce((sum, s) => sum + Number(s.grandTotal), 0),
    [filteredSales]
  );

  const netSales = totalSales - salesReturnsTotal;
  const netPurchases = purchasesTotal - purchaseReturnsTotal;
  const totalDebt = useMemo(() => 
    customers.reduce((sum, c) => sum + Math.max(0, Number(c.balance)), 0),
    [customers]
  );

  const mainWarehouseValue = useMemo(() => 
    products.filter(p => !p.isDeleted).reduce((s, p) => s + (p.costPrice * p.stock), 0),
    [products]
  );

  const distWarehouseValue = useMemo(() => 
    distributorInventory.reduce((s, item) => {
      const product = products.find(p => p.id === item.product_id);
      return s + (product ? product.costPrice * item.quantity : 0);
    }, 0),
    [distributorInventory, products]
  );

  const totalCurrentInventoryValue = mainWarehouseValue + distWarehouseValue;
  const profitOrLoss = totalSalesCost + totalCurrentInventoryValue - purchasesTotal;
  const grossProfit = totalSales - totalSalesCost;
  const profitMargin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Period Selector */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {([
          { v: 'all', l: t('common.all') },
          { v: 'today', l: t('common.today') },
          { v: 'week', l: t('reports.thisWeek') },
          { v: 'month', l: t('reports.thisMonth') },
          { v: 'custom', l: t('reports.custom') },
        ] as const).map(p => (
          <button key={p.v} onClick={() => setPeriod(p.v)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              period === p.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
            {p.l}
          </button>
        ))}
      </div>

      {period === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            className="bg-muted rounded-xl px-3 py-2 text-xs font-medium text-foreground border-none" />
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            className="bg-muted rounded-xl px-3 py-2 text-xs font-medium text-foreground border-none" />
        </div>
      )}

      {/* Net Sales & Purchases */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-emerald-500/10 p-4 rounded-2xl">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[9px] text-muted-foreground font-bold">{t('reports.netSales')}</span>
          </div>
          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{netSales.toLocaleString(locale)}</p>
          <p className="text-[9px] text-muted-foreground">{totalSales.toLocaleString()} - {salesReturnsTotal.toLocaleString()}</p>
        </div>
        <div className="bg-blue-500/10 p-4 rounded-2xl">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-[9px] text-muted-foreground font-bold">{t('reports.netPurchases')}</span>
          </div>
          <p className="text-lg font-black text-blue-600 dark:text-blue-400">{netPurchases.toLocaleString(locale)}</p>
          <p className="text-[9px] text-muted-foreground">{purchasesTotal.toLocaleString()} - {purchaseReturnsTotal.toLocaleString()}</p>
        </div>
      </div>

      {/* Gross Profit & Margin (NEW) */}
      <div className="grid grid-cols-2 gap-2">
        <div className={`p-4 rounded-2xl ${grossProfit >= 0 ? 'bg-emerald-500/10' : 'bg-destructive/10'}`}>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[9px] text-muted-foreground font-bold">{t('reports.grossProfit')}</span>
          </div>
          <p className={`text-lg font-black ${grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
            {grossProfit.toLocaleString(locale)}
          </p>
        </div>
        <div className={`p-4 rounded-2xl ${profitMargin >= 15 ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
          <div className="flex items-center gap-2 mb-1">
            <Percent className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-[9px] text-muted-foreground font-bold">{t('reports.profitMarginLabel')}</span>
          </div>
          <p className={`text-lg font-black ${profitMargin >= 15 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {profitMargin.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Discounts */}
      <div className="bg-amber-500/10 p-4 rounded-2xl">
        <div className="flex items-center gap-2 mb-1">
          <Percent className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className="text-[9px] text-muted-foreground font-bold">{t('reports.totalDiscounts')}</span>
        </div>
        <p className="text-lg font-black text-amber-600 dark:text-amber-400">{totalDiscounts.toLocaleString(locale)}</p>
        <p className="text-[9px] text-muted-foreground">
          {t('reports.revenueImpact')}: -{totalSales > 0 ? ((totalDiscounts / (totalSales + totalDiscounts)) * 100).toFixed(1) : 0}%
        </p>
      </div>

      {/* Profit/Loss */}
      <div className={`p-5 rounded-2xl text-center ${profitOrLoss >= 0 ? 'bg-emerald-500/10' : 'bg-destructive/10'}`}>
        <DollarSign className={`w-8 h-8 mx-auto mb-2 ${profitOrLoss >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`} />
        <p className="text-xs text-muted-foreground font-bold mb-1">{t('reports.profitLoss')}</p>
        <p className={`text-2xl font-black ${profitOrLoss >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
          {profitOrLoss.toLocaleString(locale)} {CURRENCY}
        </p>
        <p className="text-[9px] text-muted-foreground mt-2">
          {t('reports.salesCost')} ({totalSalesCost.toLocaleString()}) + {t('reports.inventoryValue')} ({totalCurrentInventoryValue.toLocaleString()}) − {t('reports.purchases')} ({purchasesTotal.toLocaleString()})
        </p>
      </div>

      {/* Collections & Debts */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-card p-3 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="text-[9px] text-muted-foreground font-bold">{t('reports.collections')}</span>
          </div>
          <p className="text-lg font-black text-purple-600 dark:text-purple-400">{collectionsTotal.toLocaleString(locale)}</p>
        </div>
        <div className="bg-card p-3 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-destructive" />
            <span className="text-[9px] text-muted-foreground font-bold">{t('reports.debts')}</span>
          </div>
          <p className="text-lg font-black text-destructive">{totalDebt.toLocaleString(locale)}</p>
        </div>
      </div>

      {/* Inventory */}
      <div className="bg-card p-4 rounded-2xl shadow-sm space-y-2">
        <h3 className="font-bold text-sm flex items-center gap-2 text-foreground mb-3">
          <Package className="w-4 h-4" /> {t('reports.currentInventoryValue')}
        </h3>
        <div className="flex items-center justify-between p-2.5 bg-muted rounded-xl text-sm">
          <span className="text-muted-foreground">{t('reports.mainWarehouse')}</span>
          <span className="font-bold text-foreground">{mainWarehouseValue.toLocaleString(locale)}</span>
        </div>
        <div className="flex items-center justify-between p-2.5 bg-muted rounded-xl text-sm">
          <span className="text-muted-foreground">{t('reports.distributorWarehouses')}</span>
          <span className="font-bold text-foreground">{distWarehouseValue.toLocaleString(locale)}</span>
        </div>
        <div className="flex items-center justify-between p-3 bg-primary/10 rounded-xl">
          <span className="font-black">{t('common.total')}</span>
          <span className="font-black text-lg text-primary">{totalCurrentInventoryValue.toLocaleString(locale)} {CURRENCY}</span>
        </div>
      </div>

      {/* Financial Summary Table */}
      <div className="bg-card p-4 rounded-2xl shadow-sm space-y-2">
        <h3 className="font-bold text-sm flex items-center gap-2 text-foreground mb-3">
          <BarChart3 className="w-4 h-4" /> {t('reports.financialSummary')}
        </h3>
        <div className="flex items-center justify-between p-2.5 bg-muted rounded-xl text-sm">
          <span className="text-muted-foreground">{t('reports.totalSales')}</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">+{totalSales.toLocaleString(locale)}</span>
        </div>
        <div className="flex items-center justify-between p-2.5 bg-muted rounded-xl text-sm">
          <span className="text-muted-foreground">{t('reports.salesCostLabel')}</span>
          <span className="font-bold text-foreground">{totalSalesCost.toLocaleString(locale)}</span>
        </div>
        <div className="flex items-center justify-between p-2.5 bg-emerald-500/10 rounded-xl text-sm">
          <span className="text-muted-foreground">{t('reports.grossProfit')}</span>
          <span className={`font-bold ${grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
            {grossProfit.toLocaleString(locale)}
          </span>
        </div>
        <div className="flex items-center justify-between p-2.5 bg-amber-500/10 rounded-xl text-sm">
          <span className="text-muted-foreground">{t('reports.totalDiscounts')}</span>
          <span className="font-bold text-amber-600 dark:text-amber-400">-{totalDiscounts.toLocaleString(locale)}</span>
        </div>
        <div className="flex items-center justify-between p-2.5 bg-muted rounded-xl text-sm">
          <span className="text-muted-foreground">{t('reports.salesReturns')}</span>
          <span className="font-bold text-warning">-{salesReturnsTotal.toLocaleString(locale)}</span>
        </div>
        <div className="flex items-center justify-between p-2.5 bg-muted rounded-xl text-sm">
          <span className="text-muted-foreground">{t('reports.totalPurchases')}</span>
          <span className="font-bold text-blue-600 dark:text-blue-400">-{purchasesTotal.toLocaleString(locale)}</span>
        </div>
        <div className="flex items-center justify-between p-2.5 bg-muted rounded-xl text-sm">
          <span className="text-muted-foreground">{t('reports.purchaseReturns')}</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">+{purchaseReturnsTotal.toLocaleString(locale)}</span>
        </div>
        <div className={`flex items-center justify-between p-3 rounded-xl ${profitOrLoss >= 0 ? 'bg-emerald-500/20' : 'bg-destructive/20'}`}>
          <span className="font-black">{t('reports.profitLoss')}</span>
          <span className={`font-black text-lg ${profitOrLoss >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
            {profitOrLoss.toLocaleString(locale)} {CURRENCY}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ReportsTab;
