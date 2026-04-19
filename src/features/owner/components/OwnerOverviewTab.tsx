import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/store/AppContext';
import { CURRENCY } from '@/constants';
import { PaymentType, EmployeeType } from '@/types';
import {
  DollarSign, CreditCard, AlertTriangle, Package,
  ArrowUpRight, ArrowDownRight, FileText, Wallet,
  Users, Banknote, Bell, Clock, Activity,
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

    const todaySales = sales.filter(s => s.timestamp >= todayStart && !s.isVoided);
    const todayRevenue = todaySales.reduce((s, i) => s + i.grandTotal, 0);
    const todayCash = todaySales.filter(s => s.paymentType === PaymentType.CASH).reduce((s, i) => s + i.grandTotal, 0);
    const todayCredit = todaySales.filter(s => s.paymentType === PaymentType.CREDIT).reduce((s, i) => s + i.grandTotal, 0);
    const todayCollections = payments.filter(p => p.timestamp >= todayStart && !p.isReversed).reduce((s, i) => s + i.amount, 0);

    const yesterdaySales = sales.filter(s => s.timestamp >= yesterdayStart && s.timestamp < todayStart && !s.isVoided);
    const yesterdayRevenue = yesterdaySales.reduce((s, i) => s + i.grandTotal, 0);
    const revenueChange = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0;

    const totalDebts = customers.reduce((s, c) => s + Math.max(0, c.balance), 0);
    const debtCustomers = customers.filter(c => c.balance > 0);

    const warehouseValue = products.filter(p => !p.isDeleted).reduce((s, p) => s + (p.stock * p.costPrice), 0);
    const distInvValue = (distributorInventory as any[]).reduce((s: number, di: any) => {
      const prod = products.find(p => p.id === di.product_id);
      return s + (di.quantity * (prod?.costPrice || 0));
    }, 0);
    const lowStockProducts = products.filter(p => p.stock <= p.minStock && !p.isDeleted);
    const outOfStock = products.filter(p => p.stock === 0 && !p.isDeleted);

    const activeEmployees = users.filter(u => u.role === 'EMPLOYEE' && u.isActive !== false);
    const fieldAgents = activeEmployees.filter(u => u.employeeType === EmployeeType.FIELD_AGENT);

    const recentSales = [...sales].filter(s => !s.isVoided).sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
    const recentCollections = [...payments].filter(p => !p.isReversed).sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
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
      {/* Hero — Today Revenue */}
      <HeroCard
        label={t('owner.todaySales')}
        value={stats.todayRevenue}
        change={stats.revenueChange}
        cash={stats.todayCash}
        credit={stats.todayCredit}
        invoices={stats.todayInvoiceCount}
        cashLabel={t('owner.cashLabel')}
        creditLabel={t('owner.creditLabel')}
        invoicesLabel={t('salesManager.invoiceCount')}
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <KpiCard
          label={t('finance.collections')}
          value={stats.todayCollections}
          icon={<Wallet size={18} />}
          tone="emerald"
        />
        <KpiCard
          label={t('finance.totalDebts')}
          value={stats.totalDebts}
          icon={<AlertTriangle size={18} />}
          tone="rose"
          negative
        />
        <KpiCard
          label={t('overview.inventoryValue')}
          value={stats.totalInventoryValue}
          icon={<Package size={18} />}
          tone="blue"
        />
        <KpiCard
          label={t('warehouse.lowStockProducts')}
          value={stats.lowStockProducts.length}
          icon={<AlertTriangle size={18} />}
          isCurrency={false}
          tone={stats.lowStockProducts.length > 0 ? 'amber' : 'emerald'}
        />
      </div>

      {/* Daily Money Flow */}
      <SectionCard icon={<Activity size={16} />} iconColor="text-primary" title={t('overview.dailyMoneyFlow')}>
        <div className="grid grid-cols-3 gap-2">
          <FlowCell tone="emerald" icon={<Banknote className="w-4 h-4" />} value={stats.todayCash} label={t('owner.cashLabel')} />
          <FlowCell tone="amber"   icon={<CreditCard className="w-4 h-4" />} value={stats.todayCredit} label={t('owner.creditLabel')} />
          <FlowCell tone="blue"    icon={<Wallet className="w-4 h-4" />} value={stats.todayCollections} label={t('finance.collections')} />
        </div>
      </SectionCard>

      {/* Smart Alerts */}
      {(stats.outOfStock.length > 0 || stats.lowStockProducts.length > 0 || stats.topDebtors.length > 0) && (
        <SectionCard icon={<Bell size={16} />} iconColor="text-warning" title={t('overview.smartAlerts')}>
          <div className="space-y-1.5">
            {stats.outOfStock.length > 0 && (
              <AlertRow tone="destructive" icon={<Package size={14} />} text={`${stats.outOfStock.length} ${t('overview.outOfStockAlert')}`} />
            )}
            {stats.lowStockProducts.length > 0 && (
              <AlertRow tone="warning" icon={<AlertTriangle size={14} />} text={`${stats.lowStockProducts.length} ${t('overview.lowStockAlert')}`} />
            )}
            {stats.topDebtors.length > 0 && stats.totalDebts > 0 && (
              <AlertRow tone="orange" icon={<Users size={14} />} text={`${stats.debtCustomers} ${t('overview.debtCustomersAlert')} — ${stats.totalDebts.toLocaleString()} ${CURRENCY}`} />
            )}
          </div>
        </SectionCard>
      )}

      {/* Top Debtors */}
      {stats.topDebtors.length > 0 && (
        <SectionCard icon={<Users size={16} />} iconColor="text-destructive" title={t('overview.topDebtors')}>
          <ListGroup>
            {stats.topDebtors.map((c: any, i: number) => (
              <ListRow
                key={c.id}
                isLast={i === stats.topDebtors.length - 1}
                left={<span className="font-bold text-[13px] text-foreground truncate">{c.name}</span>}
                right={<span className="font-black text-destructive text-[13px]">{c.balance.toLocaleString()} <span className="opacity-50 text-[10px] font-medium">{CURRENCY}</span></span>}
              />
            ))}
          </ListGroup>
        </SectionCard>
      )}

      {/* Recent Invoices */}
      {stats.recentSales.length > 0 && (
        <SectionCard icon={<FileText size={16} />} iconColor="text-primary" title={t('overview.recentInvoices')}>
          <ListGroup>
            {stats.recentSales.map((s: any, i: number) => (
              <ListRow
                key={s.id}
                isLast={i === stats.recentSales.length - 1}
                left={
                  <div className="min-w-0">
                    <p className="font-bold text-[13px] text-foreground truncate">{s.customerName}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(s.timestamp).toLocaleDateString('ar-EG')}</p>
                  </div>
                }
                right={
                  <div className="text-end">
                    <p className="font-black text-foreground text-[13px]">{s.grandTotal.toLocaleString()} <span className="opacity-40 text-[10px] font-medium">{CURRENCY}</span></p>
                    <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold ${s.paymentType === PaymentType.CASH ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                      {s.paymentType === PaymentType.CASH ? t('owner.cashLabel') : t('owner.creditLabel')}
                    </span>
                  </div>
                }
              />
            ))}
          </ListGroup>
        </SectionCard>
      )}

      {/* Recent Collections */}
      {stats.recentCollections.length > 0 && (
        <SectionCard icon={<Wallet size={16} />} iconColor="text-emerald-600 dark:text-emerald-400" title={t('overview.recentCollections')}>
          <ListGroup>
            {stats.recentCollections.map((p: any, i: number) => (
              <ListRow
                key={p.id}
                isLast={i === stats.recentCollections.length - 1}
                left={
                  <div className="min-w-0">
                    <p className="font-bold text-[13px] text-foreground truncate">{p.customerName || '—'}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(p.timestamp).toLocaleDateString('ar-EG')}</p>
                  </div>
                }
                right={<span className="font-black text-emerald-600 dark:text-emerald-400 text-[13px]">{p.amount.toLocaleString()} <span className="opacity-50 text-[10px] font-medium">{CURRENCY}</span></span>}
              />
            ))}
          </ListGroup>
        </SectionCard>
      )}

      {/* System Summary */}
      <SectionCard icon={<Clock size={16} />} iconColor="text-primary" title={t('overview.systemSummary')}>
        <div className="grid grid-cols-3 gap-2">
          <SummaryCell tone="primary"  icon={<Package className="w-5 h-5" />} value={stats.totalProducts} label={t('owner.totalProducts')} />
          <SummaryCell tone="purple"   icon={<Users className="w-5 h-5" />}  value={stats.totalCustomers} label={t('owner.totalCustomers')} />
          <SummaryCell tone="blue"     icon={<Users className="w-5 h-5" />}  value={stats.activeEmployees} label={t('owner.totalEmployees')} />
        </div>
      </SectionCard>
    </div>
  );
};

/* ====================== Building blocks ====================== */

const glassCard: React.CSSProperties = {
  background: 'var(--card-glass-bg)',
  backdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturation))',
  WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturation))',
  border: '1px solid var(--card-glass-border)',
  boxShadow: 'var(--glass-shadow), var(--glass-highlight)',
};

const HeroCard: React.FC<{
  label: string; value: number; change: number;
  cash: number; credit: number; invoices: number;
  cashLabel: string; creditLabel: string; invoicesLabel: string;
}> = ({ label, value, change, cash, credit, invoices, cashLabel, creditLabel, invoicesLabel }) => (
  <div
    className="relative overflow-hidden rounded-3xl p-4"
    style={{
      ...glassCard,
      background: 'linear-gradient(135deg, hsl(var(--primary) / 0.08) 0%, var(--card-glass-bg) 60%)',
    }}
  >
    {/* decorative orb */}
    <div
      aria-hidden
      className="absolute -top-16 -end-16 w-40 h-40 rounded-full pointer-events-none"
      style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.18), transparent 70%)' }}
    />
    <div className="relative">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))',
              boxShadow: '0 4px 14px -4px hsl(var(--primary) / 0.5)',
            }}
          >
            <DollarSign className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        {change !== 0 && (
          <div
            className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-black ${
              change >= 0 ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-destructive/15 text-destructive'
            }`}
          >
            {change >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>

      <p className="text-[28px] leading-none font-black text-foreground tracking-tight mt-2">
        {value.toLocaleString()}
        <span className="text-[12px] font-medium text-muted-foreground ms-1.5">{CURRENCY}</span>
      </p>

      <div className="grid grid-cols-3 gap-1.5 mt-4">
        <HeroChip tone="emerald" label={cashLabel} value={cash} />
        <HeroChip tone="amber"   label={creditLabel} value={credit} />
        <HeroChip tone="blue"    label={invoicesLabel} value={invoices} isCurrency={false} />
      </div>
    </div>
  </div>
);

const HeroChip: React.FC<{ tone: 'emerald' | 'amber' | 'blue'; label: string; value: number; isCurrency?: boolean }> = ({ tone, label, value, isCurrency = true }) => {
  const map = {
    emerald: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10',
    amber:   'text-amber-700 dark:text-amber-400 bg-amber-500/10',
    blue:    'text-blue-700 dark:text-blue-400 bg-blue-500/10',
  } as const;
  return (
    <div className={`rounded-2xl p-2 text-center ${map[tone]}`}>
      <p className="text-[14px] font-black leading-none">{value.toLocaleString()}{isCurrency && <span className="text-[8px] opacity-60 ms-0.5">{CURRENCY}</span>}</p>
      <p className="text-[9px] font-bold opacity-80 mt-1">{label}</p>
    </div>
  );
};

const KpiCard: React.FC<{
  label: string; value: number;
  icon: React.ReactNode;
  tone: 'emerald' | 'rose' | 'blue' | 'amber';
  negative?: boolean; isCurrency?: boolean;
}> = ({ label, value, icon, tone, negative, isCurrency = true }) => {
  const map = {
    emerald: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/12',
    rose:    'text-destructive bg-destructive/12',
    blue:    'text-blue-700 dark:text-blue-400 bg-blue-500/12',
    amber:   'text-amber-700 dark:text-amber-400 bg-amber-500/12',
  } as const;
  return (
    <div className="rounded-3xl p-3.5" style={glassCard}>
      <div className={`w-9 h-9 rounded-2xl flex items-center justify-center mb-2.5 ${map[tone]}`}>{icon}</div>
      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mb-1 truncate">{label}</p>
      <p className={`text-[18px] leading-none font-black tracking-tight ${negative ? 'text-destructive' : 'text-foreground'}`}>
        {value.toLocaleString()}
        {isCurrency && <span className="text-[9px] font-medium text-muted-foreground ms-1">{CURRENCY}</span>}
      </p>
    </div>
  );
};

const SectionCard: React.FC<{ icon: React.ReactNode; iconColor: string; title: string; children: React.ReactNode }> = ({ icon, iconColor, title, children }) => (
  <section className="rounded-3xl p-3.5" style={glassCard}>
    <h3 className="font-black text-foreground mb-3 flex items-center gap-2 text-[13px] px-1">
      <span className={`${iconColor}`}>{icon}</span>
      {title}
    </h3>
    {children}
  </section>
);

const FlowCell: React.FC<{ tone: 'emerald' | 'amber' | 'blue'; icon: React.ReactNode; value: number; label: string }> = ({ tone, icon, value, label }) => {
  const map = {
    emerald: { ring: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400', text: 'text-emerald-700 dark:text-emerald-400' },
    amber:   { ring: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',     text: 'text-amber-700 dark:text-amber-400' },
    blue:    { ring: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',         text: 'text-blue-700 dark:text-blue-400' },
  } as const;
  return (
    <div className="rounded-2xl p-2.5 text-center bg-muted/40">
      <div className={`w-7 h-7 mx-auto rounded-xl flex items-center justify-center mb-1 ${map[tone].ring}`}>{icon}</div>
      <p className={`text-[13px] font-black leading-none ${map[tone].text}`}>{value.toLocaleString()}</p>
      <p className="text-[9px] text-muted-foreground font-bold mt-1">{label}</p>
    </div>
  );
};

const AlertRow: React.FC<{ tone: 'destructive' | 'warning' | 'orange'; icon: React.ReactNode; text: string }> = ({ tone, icon, text }) => {
  const map = {
    destructive: 'bg-destructive/10 text-destructive',
    warning:     'bg-warning/10 text-warning',
    orange:      'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  } as const;
  return (
    <div className={`rounded-2xl p-2.5 flex items-center gap-2 ${map[tone]}`}>
      <span className="shrink-0">{icon}</span>
      <p className="text-[12px] font-bold">{text}</p>
    </div>
  );
};

const ListGroup: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-2xl bg-muted/40 overflow-hidden">{children}</div>
);

const ListRow: React.FC<{ left: React.ReactNode; right: React.ReactNode; isLast?: boolean }> = ({ left, right, isLast }) => (
  <div className={`flex items-center justify-between gap-3 px-3 py-2.5 ${isLast ? '' : 'border-b border-border/40'}`}>
    <div className="min-w-0 flex-1">{left}</div>
    <div className="shrink-0">{right}</div>
  </div>
);

const SummaryCell: React.FC<{ tone: 'primary' | 'purple' | 'blue'; icon: React.ReactNode; value: number; label: string }> = ({ tone, icon, value, label }) => {
  const map = {
    primary: 'bg-primary/10 text-primary',
    purple:  'bg-purple-500/10 text-purple-700 dark:text-purple-400',
    blue:    'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  } as const;
  return (
    <div className="rounded-2xl p-3 text-center bg-muted/40">
      <div className={`w-9 h-9 mx-auto rounded-xl flex items-center justify-center mb-1.5 ${map[tone]}`}>{icon}</div>
      <p className="text-[18px] font-black text-foreground leading-none">{value}</p>
      <p className="text-[9px] text-muted-foreground font-bold mt-1">{label}</p>
    </div>
  );
};

export default OwnerOverviewTab;
