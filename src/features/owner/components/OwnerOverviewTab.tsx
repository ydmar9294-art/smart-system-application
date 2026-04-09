import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/store/AppContext';
import { CURRENCY } from '@/constants';
import { PaymentType, EmployeeType } from '@/types';
import {
  DollarSign, CreditCard, AlertTriangle, Package, TrendingUp,
  TrendingDown, ArrowUpRight, ArrowDownRight, FileText, Wallet,
  Users, Banknote, ShoppingCart, Truck, Bell, Clock, Activity
} from 'lucide-react';

export const OwnerOverviewTab: React.FC = () => {
  const { t } = useTranslation();
  const {
    sales = [], payments = [], products = [], customers = [],
    users = [], deliveries = [], purchases = [], distributorInventory = []
  } = useApp();

  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now).setHours(0, 0, 0, 0);
    const yesterdayStart = todayStart - 86400000;

    // Today
    const todaySales = sales.filter(s => s.timestamp >= todayStart && !s.isVoided);
    const todayRevenue = todaySales.reduce((s, i) => s + i.grandTotal, 0);
    const todayCash = todaySales.filter(s => s.paymentType === PaymentType.CASH).reduce((s, i) => s + i.grandTotal, 0);
    const todayCredit = todaySales.filter(s => s.paymentType === PaymentType.CREDIT).reduce((s, i) => s + i.grandTotal, 0);
    const todayCollections = payments.filter(p => p.timestamp >= todayStart && !p.isReversed).reduce((s, i) => s + i.amount, 0);

    // Yesterday for comparison
    const yesterdaySales = sales.filter(s => s.timestamp >= yesterdayStart && s.timestamp < todayStart && !s.isVoided);
    const yesterdayRevenue = yesterdaySales.reduce((s, i) => s + i.grandTotal, 0);
    const revenueChange = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0;

    // Debts
    const totalDebts = customers.reduce((s, c) => s + Math.max(0, c.balance), 0);
    const debtCustomers = customers.filter(c => c.balance > 0);

    // Inventory
    const warehouseValue = products.filter(p => !p.isDeleted).reduce((s, p) => s + (p.stock * p.costPrice), 0);
    const distInvValue = (distributorInventory as any[]).reduce((s: number, di: any) => {
      const prod = products.find(p => p.id === di.product_id);
      return s + (di.quantity * (prod?.costPrice || 0));
    }, 0);
    const lowStockProducts = products.filter(p => p.stock <= p.minStock && !p.isDeleted);
    const outOfStock = products.filter(p => p.stock === 0 && !p.isDeleted);

    // Team
    const activeEmployees = users.filter(u => u.role === 'EMPLOYEE' && u.isActive !== false);
    const fieldAgents = activeEmployees.filter(u => u.employeeType === EmployeeType.FIELD_AGENT);

    // Recent
    const recentSales = [...sales].filter(s => !s.isVoided).sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
    const recentCollections = [...payments].filter(p => !p.isReversed).sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);

    // Top debtors
    const topDebtors = [...debtCustomers].sort((a, b) => b.balance - a.balance).slice(0, 5);

    return {
      todayRevenue, todayCash, todayCredit, todayCollections, revenueChange,
      totalDebts, debtCustomers: debtCustomers.length,
      warehouseValue, distInvValue, totalInventoryValue: warehouseValue + distInvValue,
      lowStockProducts, outOfStock,
      todayInvoiceCount: todaySales.length,
      activeEmployees: activeEmployees.length, fieldAgents: fieldAgents.length,
      recentSales, recentCollections, topDebtors,
      totalProducts: products.filter(p => !p.isDeleted).length,
      totalCustomers: customers.length,
    };
  }, [sales, payments, products, customers, users, deliveries, purchases, distributorInventory]);

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Executive KPIs */}
      <div className="grid grid-cols-2 gap-2">
        <KpiCard
          label={t('owner.todaySales')}
          value={stats.todayRevenue}
          change={stats.revenueChange}
          icon={<DollarSign size={16} />}
          colorClass="bg-primary/10 text-primary"
        />
        <KpiCard
          label={t('finance.collections')}
          value={stats.todayCollections}
          icon={<Wallet size={16} />}
          colorClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
        <KpiCard
          label={t('finance.totalDebts')}
          value={stats.totalDebts}
          icon={<AlertTriangle size={16} />}
          colorClass="bg-destructive/10 text-destructive"
          negative
        />
        <KpiCard
          label={t('overview.inventoryValue')}
          value={stats.totalInventoryValue}
          icon={<Package size={16} />}
          colorClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        />
        <KpiCard
          label={t('salesManager.invoiceCount')}
          value={stats.todayInvoiceCount}
          icon={<FileText size={16} />}
          isCurrency={false}
          colorClass="bg-purple-500/10 text-purple-600 dark:text-purple-400"
        />
        <KpiCard
          label={t('warehouse.lowStockProducts')}
          value={stats.lowStockProducts.length}
          icon={<AlertTriangle size={16} />}
          isCurrency={false}
          colorClass={stats.lowStockProducts.length > 0 ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-600'}
        />
      </div>

      {/* Daily Money Flow */}
      <div className="bg-card p-4 rounded-[2rem] border shadow-sm">
        <h3 className="font-black text-foreground mb-3 flex items-center gap-2 text-sm">
          <Activity size={16} className="text-primary" />
          {t('overview.dailyMoneyFlow')}
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-emerald-500/10 p-3 rounded-xl text-center">
            <Banknote className="w-4 h-4 mx-auto text-emerald-600 dark:text-emerald-400 mb-1" />
            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{stats.todayCash.toLocaleString()}</p>
            <p className="text-[8px] text-muted-foreground font-bold">{t('owner.cashLabel')}</p>
          </div>
          <div className="bg-amber-500/10 p-3 rounded-xl text-center">
            <CreditCard className="w-4 h-4 mx-auto text-amber-600 dark:text-amber-400 mb-1" />
            <p className="text-sm font-black text-amber-600 dark:text-amber-400">{stats.todayCredit.toLocaleString()}</p>
            <p className="text-[8px] text-muted-foreground font-bold">{t('owner.creditLabel')}</p>
          </div>
          <div className="bg-blue-500/10 p-3 rounded-xl text-center">
            <Wallet className="w-4 h-4 mx-auto text-blue-600 dark:text-blue-400 mb-1" />
            <p className="text-sm font-black text-blue-600 dark:text-blue-400">{stats.todayCollections.toLocaleString()}</p>
            <p className="text-[8px] text-muted-foreground font-bold">{t('finance.collections')}</p>
          </div>
        </div>
      </div>

      {/* Smart Alerts */}
      {(stats.outOfStock.length > 0 || stats.lowStockProducts.length > 0 || stats.topDebtors.length > 0) && (
        <div className="bg-card p-4 rounded-[2rem] border shadow-sm">
          <h3 className="font-black text-foreground mb-3 flex items-center gap-2 text-sm">
            <Bell size={16} className="text-warning" />
            {t('overview.smartAlerts')}
          </h3>
          <div className="space-y-2">
            {stats.outOfStock.length > 0 && (
              <div className="bg-destructive/10 p-3 rounded-xl flex items-center gap-2">
                <Package size={14} className="text-destructive shrink-0" />
                <p className="text-xs font-bold text-destructive">
                  {stats.outOfStock.length} {t('overview.outOfStockAlert')}
                </p>
              </div>
            )}
            {stats.lowStockProducts.length > 0 && (
              <div className="bg-warning/10 p-3 rounded-xl flex items-center gap-2">
                <AlertTriangle size={14} className="text-warning shrink-0" />
                <p className="text-xs font-bold text-warning">
                  {stats.lowStockProducts.length} {t('overview.lowStockAlert')}
                </p>
              </div>
            )}
            {stats.topDebtors.length > 0 && stats.totalDebts > 0 && (
              <div className="bg-orange-500/10 p-3 rounded-xl flex items-center gap-2">
                <Users size={14} className="text-orange-600 dark:text-orange-400 shrink-0" />
                <p className="text-xs font-bold text-orange-600 dark:text-orange-400">
                  {stats.debtCustomers} {t('overview.debtCustomersAlert')} — {stats.totalDebts.toLocaleString()} {CURRENCY}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top Debtors */}
      {stats.topDebtors.length > 0 && (
        <div className="bg-card p-4 rounded-[2rem] border shadow-sm">
          <h3 className="font-black text-foreground mb-3 flex items-center gap-2 text-sm">
            <Users size={16} className="text-destructive" />
            {t('overview.topDebtors')}
          </h3>
          <div className="space-y-1.5">
            {stats.topDebtors.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between bg-muted p-2.5 rounded-xl">
                <span className="font-bold text-xs truncate max-w-[140px]">{c.name}</span>
                <span className="font-black text-destructive text-xs">{c.balance.toLocaleString()} {CURRENCY}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Invoices */}
      {stats.recentSales.length > 0 && (
        <div className="bg-card p-4 rounded-[2rem] border shadow-sm">
          <h3 className="font-black text-foreground mb-3 flex items-center gap-2 text-sm">
            <FileText size={16} className="text-primary" />
            {t('overview.recentInvoices')}
          </h3>
          <div className="space-y-1.5">
            {stats.recentSales.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between bg-muted p-2.5 rounded-xl">
                <div>
                  <span className="font-bold text-xs block truncate max-w-[140px]">{s.customerName}</span>
                  <span className="text-[9px] text-muted-foreground">
                    {new Date(s.timestamp).toLocaleDateString('ar-EG')}
                  </span>
                </div>
                <div className="text-end">
                  <span className="font-black text-primary text-xs block">{s.grandTotal.toLocaleString()} {CURRENCY}</span>
                  <span className={`text-[9px] font-bold ${s.paymentType === PaymentType.CASH ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {s.paymentType === PaymentType.CASH ? t('owner.cashLabel') : t('owner.creditLabel')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Collections */}
      {stats.recentCollections.length > 0 && (
        <div className="bg-card p-4 rounded-[2rem] border shadow-sm">
          <h3 className="font-black text-foreground mb-3 flex items-center gap-2 text-sm">
            <Wallet size={16} className="text-emerald-600 dark:text-emerald-400" />
            {t('overview.recentCollections')}
          </h3>
          <div className="space-y-1.5">
            {stats.recentCollections.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between bg-muted p-2.5 rounded-xl">
                <div>
                  <span className="font-bold text-xs block truncate max-w-[140px]">{p.customerName || '—'}</span>
                  <span className="text-[9px] text-muted-foreground">
                    {new Date(p.timestamp).toLocaleDateString('ar-EG')}
                  </span>
                </div>
                <span className="font-black text-emerald-600 dark:text-emerald-400 text-xs">{p.amount.toLocaleString()} {CURRENCY}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System Summary */}
      <div className="bg-card p-4 rounded-[2rem] border shadow-sm">
        <h3 className="font-black text-foreground mb-3 flex items-center gap-2 text-sm">
          <Clock size={16} className="text-primary" />
          {t('overview.systemSummary')}
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-primary/5 p-3 rounded-xl text-center">
            <Package className="w-5 h-5 mx-auto text-primary mb-1" />
            <p className="text-lg font-black text-foreground">{stats.totalProducts}</p>
            <p className="text-[8px] text-muted-foreground font-bold">{t('owner.totalProducts')}</p>
          </div>
          <div className="bg-purple-500/5 p-3 rounded-xl text-center">
            <Users className="w-5 h-5 mx-auto text-purple-600 dark:text-purple-400 mb-1" />
            <p className="text-lg font-black text-foreground">{stats.totalCustomers}</p>
            <p className="text-[8px] text-muted-foreground font-bold">{t('owner.totalCustomers')}</p>
          </div>
          <div className="bg-blue-500/5 p-3 rounded-xl text-center">
            <Users className="w-5 h-5 mx-auto text-blue-600 dark:text-blue-400 mb-1" />
            <p className="text-lg font-black text-foreground">{stats.activeEmployees}</p>
            <p className="text-[8px] text-muted-foreground font-bold">{t('owner.totalEmployees')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

/* KPI Card Component */
const KpiCard: React.FC<{
  label: string; value: number; change?: number;
  icon: React.ReactNode; colorClass: string;
  negative?: boolean; isCurrency?: boolean;
}> = ({ label, value, change, icon, colorClass, negative, isCurrency = true }) => (
  <div className="bg-card p-3 rounded-[1.5rem] border shadow-sm">
    <div className={`p-2 rounded-lg w-fit mb-2 ${colorClass}`}>{icon}</div>
    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider block mb-0.5">{label}</span>
    <p className={`text-lg font-black leading-none ${negative ? 'text-destructive' : 'text-foreground'}`}>
      {value.toLocaleString()}
      {isCurrency && <span className="text-[9px] font-medium opacity-30 ms-1">{CURRENCY}</span>}
    </p>
    {change !== undefined && change !== 0 && (
      <div className={`flex items-center gap-0.5 mt-1.5 text-[10px] font-bold ${change >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
        {change >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
        {Math.abs(change).toFixed(1)}%
      </div>
    )}
  </div>
);

export default OwnerOverviewTab;
