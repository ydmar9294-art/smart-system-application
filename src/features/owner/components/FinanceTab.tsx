import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/store/AppContext';
import { CURRENCY } from '@/constants';
import { 
  TrendingUp, TrendingDown, DollarSign, CreditCard, AlertTriangle, 
  Package, ArrowUpRight, ArrowDownRight, BarChart3, PieChart,
  FileText, Users, Wallet, Clock, Percent
} from 'lucide-react';

export const FinanceTab: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
  const { sales, payments, products, customers } = useApp();

  const discountAnalytics = useMemo(() => {
    const activeSales = sales.filter(s => !s.isVoided);
    const totalDiscounts = activeSales.reduce((s, d) => s + Number(d.discountValue || 0), 0);
    const cashDiscounts = activeSales.filter(d => d.paymentType === 'CASH').reduce((s, d) => s + Number(d.discountValue || 0), 0);
    const creditDiscounts = activeSales.filter(d => d.paymentType === 'CREDIT').reduce((s, d) => s + Number(d.discountValue || 0), 0);
    
    const customerMap: Record<string, number> = {};
    activeSales.forEach(d => {
      if (Number(d.discountValue || 0) > 0) {
        customerMap[d.customerName] = (customerMap[d.customerName] || 0) + Number(d.discountValue || 0);
      }
    });
    const topCustomers = Object.entries(customerMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, total]) => ({ name, total }));

    return { totalDiscounts, cashDiscounts, creditDiscounts, topCustomers };
  }, [sales]);

  const stats = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    const dayOfWeek = now.getDay();
    const daysFromSaturday = dayOfWeek === 6 ? 0 : dayOfWeek + 1;
    weekStart.setDate(now.getDate() - daysFromSaturday);
    weekStart.setHours(0, 0, 0, 0);
    
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const thisWeekSales = sales.filter(s => s.timestamp >= weekStart.getTime() && !s.isVoided);
    const thisWeekRevenue = thisWeekSales.reduce((sum, s) => sum + s.grandTotal, 0);
    
    const lastWeekSales = sales.filter(s => s.timestamp >= lastWeekStart.getTime() && s.timestamp < weekStart.getTime() && !s.isVoided);
    const lastWeekRevenue = lastWeekSales.reduce((sum, s) => sum + s.grandTotal, 0);
    
    const revenueChange = lastWeekRevenue > 0 ? ((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100 : 0;

    const thisWeekCollections = payments.filter(p => p.timestamp >= weekStart.getTime() && !p.isReversed);
    const totalCollections = thisWeekCollections.reduce((sum, p) => sum + p.amount, 0);
    
    const lastWeekCollections = payments.filter(p => p.timestamp >= lastWeekStart.getTime() && p.timestamp < weekStart.getTime() && !p.isReversed);
    const lastCollections = lastWeekCollections.reduce((sum, p) => sum + p.amount, 0);
    const collectionsChange = lastCollections > 0 ? ((totalCollections - lastCollections) / lastCollections) * 100 : 0;

    const totalDebts = customers.reduce((sum, c) => sum + c.balance, 0);

    const thisWeekReturns = sales.filter(s => s.timestamp >= weekStart.getTime() && s.isVoided);
    const totalReturns = thisWeekReturns.reduce((sum, s) => sum + s.grandTotal, 0);

    const productSalesMap: { [key: string]: number } = {};
    thisWeekSales.forEach(sale => {
      productSalesMap[sale.customerName] = (productSalesMap[sale.customerName] || 0) + sale.grandTotal;
    });
    
    const topProducts = Object.entries(productSalesMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));

    return {
      thisWeekRevenue, lastWeekRevenue, revenueChange,
      totalCollections, collectionsChange, totalDebts, totalReturns,
      topProducts, thisWeekSalesCount: thisWeekSales.length, lastWeekSalesCount: lastWeekSales.length
    };
  }, [sales, payments, customers, products]);

  const COLORS = ['hsl(221, 83%, 53%)', 'hsl(142, 76%, 36%)', 'hsl(48, 96%, 53%)', 'hsl(0, 84%, 60%)', 'hsl(262, 83%, 58%)'];

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="grid grid-cols-2 gap-2">
        <FinanceKpiCard label={t('finance.weeklySales')} value={stats.thisWeekRevenue} change={stats.revenueChange} icon={<DollarSign size={16} />} color="primary" />
        <FinanceKpiCard label={t('finance.collections')} value={stats.totalCollections} change={stats.collectionsChange} icon={<CreditCard size={16} />} color="success" />
        <FinanceKpiCard label={t('finance.totalDebts')} value={stats.totalDebts} icon={<AlertTriangle size={16} />} color="destructive" negative />
        <FinanceKpiCard label={t('finance.returns')} value={stats.totalReturns} icon={<Package size={16} />} color="warning" />
      </div>

      <div className="bg-card p-4 rounded-[2rem] border shadow-sm">
        <h3 className="font-black text-foreground mb-3 flex items-center gap-2 text-sm">
          <Percent size={16} className="text-amber-600 dark:text-amber-400" />
          {t('finance.discountAnalytics')}
        </h3>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-amber-500/10 p-3 rounded-xl text-center">
            <p className="text-lg font-black text-amber-600 dark:text-amber-400">{discountAnalytics.totalDiscounts.toLocaleString()}</p>
            <p className="text-[8px] text-muted-foreground font-bold">{t('finance.totalDiscounts')}</p>
          </div>
          <div className="bg-emerald-500/10 p-3 rounded-xl text-center">
            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{discountAnalytics.cashDiscounts.toLocaleString()}</p>
            <p className="text-[8px] text-muted-foreground font-bold">{t('finance.cashDiscounts')}</p>
          </div>
          <div className="bg-blue-500/10 p-3 rounded-xl text-center">
            <p className="text-lg font-black text-blue-600 dark:text-blue-400">{discountAnalytics.creditDiscounts.toLocaleString()}</p>
            <p className="text-[8px] text-muted-foreground font-bold">{t('finance.creditDiscounts')}</p>
          </div>
        </div>

        {discountAnalytics.topCustomers.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-muted-foreground mb-2">{t('finance.topDiscountCustomers')}</p>
            {discountAnalytics.topCustomers.map((c, i) => (
              <div key={c.name} className="flex items-center justify-between bg-muted p-2.5 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="font-bold text-xs truncate max-w-[120px]">{c.name}</span>
                </div>
                <span className="font-black text-amber-600 dark:text-amber-400 text-xs">{c.total.toLocaleString()} {CURRENCY}</span>
              </div>
            ))}
          </div>
        )}

        {discountAnalytics.totalDiscounts > 0 && (
          <div className="mt-3 bg-primary/5 p-3 rounded-xl border border-primary/10">
            <p className="text-[10px] font-bold text-primary mb-1">{t('finance.smartRecommendation')}</p>
            <p className="text-[10px] text-muted-foreground">
              {discountAnalytics.cashDiscounts > discountAnalytics.creditDiscounts
                ? t('finance.cashDiscountsHighInsight')
                : t('finance.creditDiscountsHighInsight')}
              {discountAnalytics.topCustomers.length > 0 && discountAnalytics.topCustomers[0].total > discountAnalytics.totalDiscounts * 0.3
                ? t('finance.customerHighDiscountWarning', { name: discountAnalytics.topCustomers[0].name })
                : ''}
            </p>
          </div>
        )}
      </div>

      <div className="bg-card p-4 rounded-[2rem] border shadow-sm">
        <h3 className="font-black text-foreground mb-3 flex items-center gap-2 text-sm">
          <BarChart3 size={16} className="text-primary" />
          {t('finance.weeklyComparison')}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <ComparisonCard label={t('finance.sales')} thisWeek={stats.thisWeekRevenue} lastWeek={stats.lastWeekRevenue} />
          <ComparisonCard label={t('finance.invoiceCount')} thisWeek={stats.thisWeekSalesCount} lastWeek={stats.lastWeekSalesCount} isCurrency={false} />
        </div>
      </div>

      <div className="bg-card p-4 rounded-[2rem] border shadow-sm">
        <h3 className="font-black text-foreground mb-3 flex items-center gap-2 text-sm">
          <Clock size={16} className="text-primary" />
          {t('finance.systemSummary')}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-blue-500/10 p-3 rounded-xl text-center">
            <FileText className="w-5 h-5 mx-auto text-blue-600 dark:text-blue-400 mb-1" />
            <p className="text-lg font-black text-foreground">{stats.thisWeekSalesCount}</p>
            <p className="text-[8px] text-muted-foreground font-bold">{t('finance.weekInvoices')}</p>
          </div>
          <div className="bg-emerald-500/10 p-3 rounded-xl text-center">
            <Wallet className="w-5 h-5 mx-auto text-emerald-600 dark:text-emerald-400 mb-1" />
            <p className="text-lg font-black text-foreground">{payments.filter(p => !p.isReversed).length}</p>
            <p className="text-[8px] text-muted-foreground font-bold">{t('finance.collectionOps')}</p>
          </div>
          <div className="bg-orange-500/10 p-3 rounded-xl text-center">
            <Users className="w-5 h-5 mx-auto text-orange-600 dark:text-orange-400 mb-1" />
            <p className="text-lg font-black text-foreground">{customers.filter(c => c.balance > 0).length}</p>
            <p className="text-[8px] text-muted-foreground font-bold">{t('finance.debtCustomers')}</p>
          </div>
          <div className="bg-red-500/10 p-3 rounded-xl text-center">
            <Package className="w-5 h-5 mx-auto text-red-600 dark:text-red-400 mb-1" />
            <p className="text-lg font-black text-foreground">{products.filter(p => p.stock <= p.minStock).length}</p>
            <p className="text-[8px] text-muted-foreground font-bold">{t('finance.lowStockProducts')}</p>
          </div>
        </div>
      </div>

      {stats.topProducts.length > 0 && (
        <div className="bg-card p-4 rounded-[2rem] border shadow-sm">
          <h3 className="font-black text-foreground mb-3 flex items-center gap-2 text-sm">
            <PieChart size={16} className="text-primary" />
            {t('finance.topCustomersByVolume')}
          </h3>
          <div className="space-y-1.5">
            {stats.topProducts.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between bg-muted p-2.5 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="font-bold text-xs truncate max-w-[120px]">{item.name}</span>
                </div>
                <span className="font-black text-primary text-xs">{item.value.toLocaleString()} {CURRENCY}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const FinanceKpiCard: React.FC<{
  label: string; value: number; change?: number;
  icon: React.ReactNode; color: 'primary' | 'success' | 'destructive' | 'warning'; negative?: boolean;
}> = ({ label, value, change, icon, color, negative }) => {
  const colorClasses = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    destructive: 'bg-destructive/10 text-destructive',
    warning: 'bg-warning/10 text-warning'
  };

  return (
    <div className="bg-card p-3 rounded-[1.5rem] border shadow-sm">
      <div className={`p-2 rounded-lg w-fit mb-2 ${colorClasses[color]}`}>{icon}</div>
      <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider block mb-0.5">{label}</span>
      <p className={`text-lg font-black leading-none ${negative ? 'text-destructive' : 'text-foreground'}`}>
        {value.toLocaleString()} <span className="text-[9px] font-medium opacity-30">{CURRENCY}</span>
      </p>
      {change !== undefined && (
        <div className={`flex items-center gap-0.5 mt-1.5 text-[10px] font-bold ${change >= 0 ? 'text-success' : 'text-destructive'}`}>
          {change >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {Math.abs(change).toFixed(1)}%
        </div>
      )}
    </div>
  );
};

const ComparisonCard: React.FC<{
  label: string; thisWeek: number; lastWeek: number; isCurrency?: boolean;
}> = ({ label, thisWeek, lastWeek, isCurrency = true }) => {
  const { t } = useTranslation();
  const change = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : 0;
  const isPositive = change >= 0;

  return (
    <div className="bg-muted p-3 rounded-xl">
      <p className="text-[9px] font-black text-muted-foreground uppercase mb-1.5">{label}</p>
      <div className="space-y-0.5">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-muted-foreground">{t('finance.thisWeek')}</span>
          <span className="font-black text-foreground text-xs">
            {thisWeek.toLocaleString()} {isCurrency && <span className="text-[9px] opacity-30">{CURRENCY}</span>}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-muted-foreground">{t('finance.lastWeek')}</span>
          <span className="font-bold text-muted-foreground text-xs">
            {lastWeek.toLocaleString()} {isCurrency && <span className="text-[9px] opacity-30">{CURRENCY}</span>}
          </span>
        </div>
        <div className={`flex items-center justify-end gap-0.5 pt-0.5 text-[10px] font-black ${isPositive ? 'text-success' : 'text-destructive'}`}>
          {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(change).toFixed(1)}%
        </div>
      </div>
    </div>
  );
};
