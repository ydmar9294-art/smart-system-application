import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp, TrendingDown, DollarSign, Wallet,
  Users, Percent, BarChart3, AlertTriangle, Loader2
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { useFinancialSummary, useDailySalesTrend, useCollectionsTrend } from '../hooks/useAccountantData';
import { CURRENCY } from '@/constants';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

const AccountantOverviewTab: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
  const isRtl = i18n.language === 'ar';
  const { sales, customers, products } = useApp();
  const { data: summary, isLoading: summaryLoading } = useFinancialSummary();
  const { data: salesTrend = [] } = useDailySalesTrend(30);
  const { data: collectionsTrend = [] } = useCollectionsTrend(30);

  // ============ KPIs ============
  // Cost/profit tracking removed — only sales, collections, debts, and collection rate are shown.
  const kpis = useMemo(() => {
    const activeSales = sales.filter(s => !s.isVoided);
    const totalSales = activeSales.reduce((sum, s) => sum + Number(s.grandTotal), 0);
    const totalCollected = activeSales.reduce((sum, s) => sum + Number(s.paidAmount), 0);
    const totalDebt = customers.reduce((sum, c) => sum + Math.max(0, Number(c.balance)), 0);
    const collectionRate = totalSales > 0 ? (totalCollected / totalSales) * 100 : 0;

    const collectionsFromRPC = summary ? Number(summary.collections_total) : totalCollected;

    return {
      totalSales,
      totalCollections: collectionsFromRPC,
      totalDebt,
      collectionRate,
    };
  }, [sales, customers, summary]);

  // ============ Chart data: merge sales & collections ============
  const chartData = useMemo(() => {
    const collMap = new Map(collectionsTrend.map(c => [c.date, c.amount]));
    return salesTrend.map(s => ({
      date: s.date.slice(5), // MM-DD
      [t('overview.sales')]: Math.round(s.sales),
      [t('overview.collections')]: Math.round(collMap.get(s.date) || 0),
    }));
  }, [salesTrend, collectionsTrend, t]);

  // ============ Top 5 customers by debt ============
  const topDebtors = useMemo(() => {
    return [...customers]
      .filter(c => Number(c.balance) > 0)
      .sort((a, b) => Number(b.balance) - Number(a.balance))
      .slice(0, 5)
      .map(c => ({
        name: c.name.length > 12 ? c.name.slice(0, 12) + '…' : c.name,
        [t('overview.debt')]: Number(c.balance),
      }));
  }, [customers, t]);

  // ============ Smart Insights ============
  const insights = useMemo(() => {
    const items: { type: 'warning' | 'info' | 'success'; text: string }[] = [];

    if (kpis.collectionRate < 50) {
      items.push({ type: 'warning', text: t('overview.lowCollectionRate', { rate: kpis.collectionRate.toFixed(0) }) });
    }
    if (kpis.totalDebt > kpis.totalSales * 0.5) {
      items.push({ type: 'warning', text: t('overview.highDebtRatio') });
    }
    if (summary && Number(summary.total_discounts) > kpis.totalSales * 0.1) {
      items.push({ type: 'warning', text: t('overview.highDiscountImpact') });
    }
    if (items.length === 0) {
      items.push({ type: 'info', text: t('overview.noAlerts') });
    }
    return items;
  }, [kpis, summary, t]);

  const formatNum = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
    return n.toLocaleString(locale);
  };

  if (summaryLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[4, 5, 6].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-3 gap-2">
        <KPICard
          icon={<TrendingUp className="w-4 h-4" />}
          label={t('overview.totalSales')}
          value={formatNum(kpis.totalSales)}
          color="emerald"
        />
        <KPICard
          icon={<Wallet className="w-4 h-4" />}
          label={t('overview.collections')}
          value={formatNum(kpis.totalCollections)}
          color="blue"
        />
        <KPICard
          icon={<Users className="w-4 h-4" />}
          label={t('overview.debts')}
          value={formatNum(kpis.totalDebt)}
          color="red"
        />
      </div>

      {/* KPI Cards Row 2 — collection efficiency only (cost/profit tracking removed) */}
      <div className="grid grid-cols-1 gap-2">
        <KPICard
          icon={<Percent className="w-4 h-4" />}
          label={t('overview.collectionRate')}
          value={`${kpis.collectionRate.toFixed(0)}%`}
          color={kpis.collectionRate >= 70 ? 'emerald' : 'amber'}
        />
      </div>

      {/* Sales vs Collections Chart */}
      {chartData.length > 0 && (
        <div className="bg-card p-4 rounded-2xl shadow-sm">
          <h3 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            {t('overview.salesVsCollections')}
          </h3>
          <div className="h-48" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" width={45} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    fontSize: '11px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey={t('overview.sales')}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey={t('overview.collections')}
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top Debtors Chart */}
      {topDebtors.length > 0 && (
        <div className="bg-card p-4 rounded-2xl shadow-sm">
          <h3 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-destructive" />
            {t('overview.topDebtors')}
          </h3>
          <div className="h-40" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topDebtors} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" width={45} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    fontSize: '11px',
                  }}
                />
                <Bar dataKey={t('overview.debt')} fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Smart Insights */}
      <div className="bg-card p-4 rounded-2xl shadow-sm">
        <h3 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          {t('overview.smartInsights')}
        </h3>
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <div
              key={i}
              className={`p-3 rounded-xl text-xs font-medium ${
                insight.type === 'warning'
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                  : insight.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
              }`}
            >
              {insight.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============ KPI Card Component ============
const KPICard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'emerald' | 'blue' | 'red' | 'amber' | 'purple';
}> = ({ icon, label, value, color }) => {
  const colorMap = {
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    red: 'bg-red-500/10 text-red-500',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  };
  const [bg] = colorMap[color].split(' ');
  const textColor = colorMap[color].split(' ').slice(1).join(' ');

  return (
    <div className={`${bg} p-3 rounded-2xl text-center`}>
      <div className={`flex items-center justify-center gap-1 mb-1 ${textColor}`}>
        {icon}
      </div>
      <p className={`text-lg font-black ${textColor}`}>{value}</p>
      <p className="text-[8px] text-muted-foreground font-bold leading-tight mt-0.5">{label}</p>
    </div>
  );
};

export default AccountantOverviewTab;
