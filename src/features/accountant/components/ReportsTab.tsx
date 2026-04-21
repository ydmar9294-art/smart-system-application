import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign,
  ShoppingCart, Wallet, Package, Percent, Loader2,
  ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp
} from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import { useApp } from '@/store/AppContext';
import { useFinancialSummary, useDailySalesTrend } from '../hooks/useAccountantData';
import { CURRENCY } from '@/constants';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';

type PeriodType = 'all' | 'today' | 'week' | 'month' | 'custom';

// ============ AI Advice Component ============
const AIAdvicePanel: React.FC<{ financialData: Record<string, number> }> = ({ financialData }) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [advice, setAdvice] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const getAdvice = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setAdvice('');
    setExpanded(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) { setAdvice(t('aiAssistant.loginRequired')); return; }

      const prompt = i18n.language === 'ar'
        ? `أنت محلل مالي خبير. حلل البيانات المالية التالية وقدم 5 نصائح عملية مختصرة لمساعدة الإدارة في اتخاذ قرارات أفضل.

البيانات المالية:
- إجمالي المبيعات: ${financialData.totalSales?.toLocaleString()} ل.س
- صافي المبيعات (بعد المرتجعات): ${financialData.netSales?.toLocaleString()} ل.س
- إجمالي المشتريات: ${financialData.purchases?.toLocaleString()} ل.س
- إجمالي التحصيلات: ${financialData.collections?.toLocaleString()} ل.س
- إجمالي الديون: ${financialData.totalDebt?.toLocaleString()} ل.س
- نسبة التحصيل: ${financialData.collectionRate?.toFixed(1)}%
- إجمالي الخصومات: ${financialData.discounts?.toLocaleString()} ل.س
- مرتجعات المبيعات: ${financialData.salesReturns?.toLocaleString()} ل.س
- مرتجعات المشتريات: ${financialData.purchaseReturns?.toLocaleString()} ل.س

قدم النصائح بصيغة نقاط مرقمة، كل نصيحة في سطرين: العنوان والتفصيل. ركز على:
1. تحسين التدفق النقدي
2. تقليل المخاطر المالية
3. تسريع عملية التحصيل
4. تقليل الديون المعدومة
5. تحسين سياسة الخصومات`
        : `You are an expert financial analyst. Analyze the following financial data and provide 5 practical, concise recommendations to help management make better decisions.

Financial Data:
- Total Sales: ${financialData.totalSales?.toLocaleString()} SYP
- Net Sales (after returns): ${financialData.netSales?.toLocaleString()} SYP
- Total Purchases: ${financialData.purchases?.toLocaleString()} SYP
- Total Collections: ${financialData.collections?.toLocaleString()} SYP
- Total Debt: ${financialData.totalDebt?.toLocaleString()} SYP
- Collection Rate: ${financialData.collectionRate?.toFixed(1)}%
- Total Discounts: ${financialData.discounts?.toLocaleString()} SYP
- Sales Returns: ${financialData.salesReturns?.toLocaleString()} SYP
- Purchase Returns: ${financialData.purchaseReturns?.toLocaleString()} SYP

Provide advice as numbered points, each with a title and detail. Focus on:
1. Improving cash flow
2. Reducing financial risks
3. Speeding up collections
4. Reducing bad debts
5. Optimizing discount policy`;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      });

      if (!response.ok) {
        if (response.status === 429) { setAdvice(t('aiAssistant.rateLimited')); return; }
        if (response.status === 402) { setAdvice(t('aiAssistant.addCredits')); return; }
        setAdvice(t('aiAssistant.connectionError')); return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim();
              if (jsonStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  fullText += content;
                  setAdvice(fullText);
                }
              } catch { /* ignore partial */ }
            }
          }
        }
      }
    } catch {
      setAdvice(t('aiAssistant.unexpectedError'));
    } finally {
      setLoading(false);
    }
  }, [financialData, loading, t, i18n.language]);

  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 p-4 rounded-2xl border border-purple-500/20">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm flex items-center gap-2 text-foreground">
          <div className="w-4 h-4 overflow-hidden rounded-sm"><AppLogo size={16} /></div>
          {t('reports.aiAdvice')}
        </h3>
        <button
          onClick={getAdvice}
          disabled={loading}
          className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 active:scale-95 transition-all"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <div className="w-3.5 h-3.5 overflow-hidden rounded-sm"><AppLogo size={14} /></div>}
          {loading ? t('common.loading') : t('reports.getAdvice')}
        </button>
      </div>

      {advice && (
        <div className="bg-card/80 rounded-xl p-3 mt-2">
          <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{advice}</p>
        </div>
      )}

      {!advice && !loading && (
        <p className="text-xs text-muted-foreground text-center py-2">
          {t('reports.aiAdviceHint')}
        </p>
      )}
    </div>
  );
};

// ============ Main ReportsTab ============
const ReportsTab: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
  const { sales, customers, products } = useApp();
  const { data: summary, isLoading } = useFinancialSummary();
  const { data: salesTrend = [] } = useDailySalesTrend(30);
  const [period, setPeriod] = useState<PeriodType>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  // Period filter
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

  // RPC summary values (org-wide)
  const purchasesTotal = summary ? Number(summary.purchases_total) : 0;
  const salesReturnsTotal = summary ? Number(summary.sales_returns_total) : 0;
  const purchaseReturnsTotal = summary ? Number(summary.purchase_returns_total) : 0;
  const collectionsTotal = summary ? Number(summary.collections_total) : 0;
  const totalDiscounts = summary ? Number(summary.total_discounts) : 0;
  const distributorInventory = summary?.distributor_inventory || [];

  // Calculations — cost/profit tracking removed; only sales/collections metrics remain
  const totalSales = useMemo(() =>
    filteredSales.reduce((sum, s) => sum + Number(s.grandTotal), 0),
    [filteredSales]
  );

  const totalPaidAmount = useMemo(() =>
    filteredSales.reduce((sum, s) => sum + Number(s.paidAmount), 0),
    [filteredSales]
  );

  const netSales = totalSales - salesReturnsTotal;
  const netPurchases = purchasesTotal - purchaseReturnsTotal;
  const totalDebt = useMemo(() =>
    customers.reduce((sum, c) => sum + Math.max(0, Number(c.balance)), 0),
    [customers]
  );

  const collectionRate = totalSales > 0 ? (collectionsTotal / totalSales) * 100 : 0;
  const returnRate = totalSales > 0 ? (salesReturnsTotal / totalSales) * 100 : 0;
  const discountImpact = totalSales > 0 ? (totalDiscounts / (totalSales + totalDiscounts)) * 100 : 0;

  // Chart: daily trend
  const trendData = useMemo(() =>
    salesTrend.slice(-14).map(s => ({
      date: s.date.slice(5),
      [t('reports.totalSales')]: Math.round(s.sales),
      [t('reports.collections')]: Math.round(s.collections),
    })),
    [salesTrend, t]
  );

  // Financial health indicators
  const healthIndicators = useMemo(() => {
    const items: { label: string; value: string; status: 'good' | 'warning' | 'danger'; detail: string }[] = [];

    // Collection efficiency
    const collStatus = collectionRate >= 70 ? 'good' : collectionRate >= 40 ? 'warning' : 'danger';
    items.push({
      label: t('reports.collectionEfficiency'),
      value: `${collectionRate.toFixed(0)}%`,
      status: collStatus,
      detail: collStatus === 'good' ? t('reports.healthGood') : collStatus === 'warning' ? t('reports.healthWarning') : t('reports.healthDanger'),
    });

    // Return rate
    const rrStatus = returnRate <= 3 ? 'good' : returnRate <= 8 ? 'warning' : 'danger';
    items.push({
      label: t('reports.returnRate'),
      value: `${returnRate.toFixed(1)}%`,
      status: rrStatus,
      detail: rrStatus === 'good' ? t('reports.returnsNormal') : t('reports.returnsHigh'),
    });

    // Debt-to-sales ratio
    const debtRatio = totalSales > 0 ? (totalDebt / totalSales) * 100 : 0;
    const drStatus = debtRatio <= 20 ? 'good' : debtRatio <= 50 ? 'warning' : 'danger';
    items.push({
      label: t('reports.debtToSales'),
      value: `${debtRatio.toFixed(0)}%`,
      status: drStatus,
      detail: drStatus === 'good' ? t('reports.debtHealthy') : t('reports.debtRisky'),
    });

    return items;
  }, [collectionRate, returnRate, totalDebt, totalSales, t]);

  // AI financial data payload (cost/profit fields removed)
  const aiFinancialData = useMemo(() => ({
    totalSales,
    netSales,
    purchases: purchasesTotal,
    collections: collectionsTotal,
    totalDebt,
    collectionRate,
    discounts: totalDiscounts,
    salesReturns: salesReturnsTotal,
    purchaseReturns: purchaseReturnsTotal,
  }), [totalSales, netSales, purchasesTotal, collectionsTotal, totalDebt, collectionRate, totalDiscounts, salesReturnsTotal, purchaseReturnsTotal]);

  const fmt = (n: number) => n.toLocaleString(locale);

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

      {/* ====== Financial Health Indicators ====== */}
      <div className="bg-card p-4 rounded-2xl shadow-sm">
        <h3 className="font-bold text-sm flex items-center gap-2 text-foreground mb-3">
          <BarChart3 className="w-4 h-4 text-primary" />
          {t('reports.financialHealth')}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {healthIndicators.map((ind, i) => (
            <div key={i} className={`p-3 rounded-xl ${
              ind.status === 'good' ? 'bg-emerald-500/10' : ind.status === 'warning' ? 'bg-amber-500/10' : 'bg-red-500/10'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-muted-foreground font-bold">{ind.label}</span>
                <div className={`w-2 h-2 rounded-full ${
                  ind.status === 'good' ? 'bg-emerald-500' : ind.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                }`} />
              </div>
              <p className={`text-lg font-black ${
                ind.status === 'good' ? 'text-emerald-600 dark:text-emerald-400' :
                ind.status === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'
              }`}>{ind.value}</p>
              <p className="text-[8px] text-muted-foreground mt-0.5">{ind.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ====== Key Metrics ====== */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-emerald-500/10 p-4 rounded-2xl">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[9px] text-muted-foreground font-bold">{t('reports.netSales')}</span>
          </div>
          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{fmt(netSales)}</p>
          <p className="text-[9px] text-muted-foreground">{fmt(totalSales)} - {fmt(salesReturnsTotal)}</p>
        </div>
        <div className="bg-blue-500/10 p-4 rounded-2xl">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-[9px] text-muted-foreground font-bold">{t('reports.netPurchases')}</span>
          </div>
          <p className="text-lg font-black text-blue-600 dark:text-blue-400">{fmt(netPurchases)}</p>
          <p className="text-[9px] text-muted-foreground">{fmt(purchasesTotal)} - {fmt(purchaseReturnsTotal)}</p>
        </div>
      </div>

      {/* Gross Profit & Margin removed — system no longer tracks cost */}

      {/* ====== Sales Trend Chart ====== */}
      {trendData.length > 2 && (
        <div className="bg-card p-4 rounded-2xl shadow-sm">
          <h3 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            {t('reports.salesTrend')}
          </h3>
          <div className="h-40" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="collGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 9 }} className="fill-muted-foreground" width={40} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '10px' }} />
                <Area type="monotone" dataKey={t('reports.totalSales')} stroke="hsl(var(--primary))" fill="url(#salesGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey={t('reports.collections')} stroke="#22c55e" fill="url(#collGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Revenue breakdown pie removed — depended on cost data */}

      {/* Discounts & Returns Impact */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-amber-500/10 p-3 rounded-2xl">
          <div className="flex items-center gap-2 mb-1">
            <Percent className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-[9px] text-muted-foreground font-bold">{t('reports.totalDiscounts')}</span>
          </div>
          <p className="text-lg font-black text-amber-600 dark:text-amber-400">{fmt(totalDiscounts)}</p>
          <p className="text-[9px] text-muted-foreground">{t('reports.revenueImpact')}: -{discountImpact.toFixed(1)}%</p>
        </div>
        <div className="bg-red-500/10 p-3 rounded-2xl">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <span className="text-[9px] text-muted-foreground font-bold">{t('reports.returnRate')}</span>
          </div>
          <p className="text-lg font-black text-red-500">{returnRate.toFixed(1)}%</p>
          <p className="text-[9px] text-muted-foreground">{fmt(salesReturnsTotal)} {t('reports.fromTotal')} {fmt(totalSales)}</p>
        </div>
      </div>

      {/* Profit/Loss & inventory value cards removed — system no longer tracks cost */}

      {/* Collections & Debts */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-card p-3 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="text-[9px] text-muted-foreground font-bold">{t('reports.collections')}</span>
          </div>
          <p className="text-lg font-black text-purple-600 dark:text-purple-400">{fmt(collectionsTotal)}</p>
        </div>
        <div className="bg-card p-3 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-destructive" />
            <span className="text-[9px] text-muted-foreground font-bold">{t('reports.debts')}</span>
          </div>
          <p className="text-lg font-black text-destructive">{fmt(totalDebt)}</p>
        </div>
      </div>

      {/* Detailed Financial Table (collapsible) */}
      <div className="bg-card p-4 rounded-2xl shadow-sm">
        <button onClick={() => setShowDetails(!showDetails)} className="w-full flex items-center justify-between">
          <h3 className="font-bold text-sm flex items-center gap-2 text-foreground">
            <BarChart3 className="w-4 h-4" /> {t('reports.financialSummary')}
          </h3>
          {showDetails ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {showDetails && (
          <div className="space-y-2 mt-3">
            <div className="flex items-center justify-between p-2.5 bg-muted rounded-xl text-sm">
              <span className="text-muted-foreground">{t('reports.totalSales')}</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">+{fmt(totalSales)}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-amber-500/10 rounded-xl text-sm">
              <span className="text-muted-foreground">{t('reports.totalDiscounts')}</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">-{fmt(totalDiscounts)}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-muted rounded-xl text-sm">
              <span className="text-muted-foreground">{t('reports.salesReturns')}</span>
              <span className="font-bold text-red-500">-{fmt(salesReturnsTotal)}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-muted rounded-xl text-sm">
              <span className="text-muted-foreground">{t('reports.totalPurchases')}</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">-{fmt(purchasesTotal)}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-muted rounded-xl text-sm">
              <span className="text-muted-foreground">{t('reports.purchaseReturns')}</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">+{fmt(purchaseReturnsTotal)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/20">
              <span className="font-black">{t('reports.collections')}</span>
              <span className="font-black text-lg text-emerald-600 dark:text-emerald-400">
                {fmt(collectionsTotal)} {CURRENCY}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ====== AI Financial Advice ====== */}
      <AIAdvicePanel financialData={aiFinancialData} />
    </div>
  );
};

export default ReportsTab;
