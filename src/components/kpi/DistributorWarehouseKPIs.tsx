import React, { useMemo, useState } from 'react';
import { useApp } from '@/store/AppContext';
import { CURRENCY } from '@/constants';
import { EmployeeType } from '@/types';
import {
  Trophy, TrendingUp, TrendingDown, Package, Wallet, FileText,
  BarChart3, RefreshCw, Users, Truck, ArrowUpRight, ArrowDownRight,
  Calendar, ChevronDown, ChevronUp, Target, Percent, ShoppingCart,
  Warehouse as WarehouseIcon, Activity, AlertTriangle, CheckCircle2
} from 'lucide-react';

type DateFilter = 'today' | 'week' | 'month' | 'all';

interface KPICardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  color: string;
  benchmark?: string;
}

const KPICard: React.FC<KPICardProps> = ({ label, value, subtitle, icon, trend, color, benchmark }) => (
  <div className="bg-card p-3 rounded-2xl shadow-sm border border-border/50">
    <div className="flex items-start justify-between mb-2">
      <div className={`w-9 h-9 ${color} rounded-xl flex items-center justify-center`}>
        {icon}
      </div>
      {trend && (
        <div className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
          trend === 'up' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
          trend === 'down' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
          'bg-muted text-muted-foreground'
        }`}>
          {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : trend === 'down' ? <ArrowDownRight className="w-3 h-3" /> : null}
        </div>
      )}
    </div>
    <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">{label}</p>
    <p className="text-lg font-black text-foreground leading-tight">{value}</p>
    {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
    {benchmark && <p className="text-[9px] text-primary/70 mt-0.5">🎯 {benchmark}</p>}
  </div>
);

interface EmployeeKPISection {
  id: string;
  name: string;
  type: EmployeeType;
  kpis: {
    salesAmount: number;
    salesCount: number;
    collectionsAmount: number;
    collectionsCount: number;
    collectionRate: number;
    returnAmount: number;
    returnRate: number;
    newCustomers: number;
    avgInvoice: number;
    cashRatio: number;
    deliveriesCount: number;
    deliveredItems: number;
    fulfillmentRate: number;
    purchasesCount: number;
    purchaseReturns: number;
    stockMovements: number;
    score: number;
  };
}

const DistributorWarehouseKPIs: React.FC = () => {
  const { users, sales, payments, customers, products } = useApp();
  const [dateFilter, setDateFilter] = useState<DateFilter>('month');
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  const getFilterStart = (filter: DateFilter): number => {
    const now = new Date();
    switch (filter) {
      case 'today': return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      case 'week': { const d = new Date(now); d.setDate(d.getDate() - 7); return d.getTime(); }
      case 'month': return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      case 'all': return 0;
    }
  };

  const filterStart = getFilterStart(dateFilter);

  const filteredSales = useMemo(() => sales.filter(s => s.timestamp >= filterStart && !s.isVoided), [sales, filterStart]);
  const filteredPayments = useMemo(() => payments.filter(p => p.timestamp >= filterStart && !p.isReversed), [payments, filterStart]);

  const distributors = users.filter(u => u.role === 'EMPLOYEE' && u.employeeType === EmployeeType.FIELD_AGENT);
  const warehouseKeepers = users.filter(u => u.role === 'EMPLOYEE' && u.employeeType === EmployeeType.WAREHOUSE_KEEPER);

  // Aggregate KPIs
  const totalSalesAmount = filteredSales.reduce((s, v) => s + v.grandTotal, 0);
  const totalCollections = filteredPayments.reduce((s, p) => s + p.amount, 0);
  const collectionRate = totalSalesAmount > 0 ? (totalCollections / totalSalesAmount) * 100 : 0;
  const avgInvoice = filteredSales.length > 0 ? totalSalesAmount / filteredSales.length : 0;
  const cashSales = filteredSales.filter(s => s.paymentType === 'CASH').length;
  const cashRatio = filteredSales.length > 0 ? (cashSales / filteredSales.length) * 100 : 0;

  // Employee-level KPIs (distributed equally for now since created_by isn't tracked client-side)
  const employeeKPIs: EmployeeKPISection[] = useMemo(() => {
    const allEmployees = [...distributors, ...warehouseKeepers];
    const distCount = Math.max(distributors.length, 1);
    const whCount = Math.max(warehouseKeepers.length, 1);

    return allEmployees.map(emp => {
      const isDistributor = emp.employeeType === EmployeeType.FIELD_AGENT;
      const divisor = isDistributor ? distCount : whCount;

      const salesAmount = isDistributor ? totalSalesAmount / divisor : 0;
      const salesCount = isDistributor ? Math.round(filteredSales.length / divisor) : 0;
      const collectionsAmt = isDistributor ? totalCollections / divisor : 0;
      const collectionsCount = isDistributor ? Math.round(filteredPayments.length / divisor) : 0;

      const score = isDistributor
        ? Math.round((salesAmount * 0.3) + (collectionsAmt * 0.3) + (salesCount * 100 * 0.2) + (collectionRate * 10 * 0.2))
        : Math.round(products.length * 10 + products.filter(p => p.stock > p.minStock).length * 5);

      return {
        id: emp.id,
        name: emp.name,
        type: emp.employeeType as EmployeeType,
        kpis: {
          salesAmount,
          salesCount,
          collectionsAmount: collectionsAmt,
          collectionsCount,
          collectionRate: salesAmount > 0 ? (collectionsAmt / salesAmount) * 100 : 0,
          returnAmount: 0,
          returnRate: 0,
          newCustomers: Math.round(customers.length / divisor),
          avgInvoice: salesCount > 0 ? salesAmount / salesCount : 0,
          cashRatio,
          deliveriesCount: 0,
          deliveredItems: 0,
          fulfillmentRate: 95,
          purchasesCount: 0,
          purchaseReturns: 0,
          stockMovements: 0,
          score,
        }
      };
    }).sort((a, b) => b.kpis.score - a.kpis.score);
  }, [distributors, warehouseKeepers, filteredSales, filteredPayments, totalSalesAmount, totalCollections, customers, products, collectionRate, cashRatio]);

  const dateFilters: { id: DateFilter; label: string }[] = [
    { id: 'today', label: 'اليوم' },
    { id: 'week', label: 'أسبوع' },
    { id: 'month', label: 'شهر' },
    { id: 'all', label: 'الكل' },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-500/10';
    if (score >= 50) return 'bg-yellow-500/10';
    return 'bg-red-500/10';
  };

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Date Filter */}
      <div className="flex gap-1.5 bg-card p-1.5 rounded-2xl shadow-sm">
        {dateFilters.map(f => (
          <button
            key={f.id}
            onClick={() => setDateFilter(f.id)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              dateFilter === f.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-2">
        <KPICard
          label="إجمالي المبيعات"
          value={totalSalesAmount.toLocaleString()}
          subtitle={CURRENCY}
          icon={<Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
          color="bg-emerald-500/10"
          trend={totalSalesAmount > 0 ? 'up' : 'neutral'}
        />
        <KPICard
          label="نسبة التحصيل"
          value={`${collectionRate.toFixed(1)}%`}
          subtitle={`${totalCollections.toLocaleString()} ${CURRENCY}`}
          icon={<Percent className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
          color="bg-blue-500/10"
          trend={collectionRate >= 85 ? 'up' : collectionRate < 50 ? 'down' : 'neutral'}
          benchmark="≥ 85%"
        />
        <KPICard
          label="عدد الفواتير"
          value={filteredSales.length}
          subtitle="فاتورة"
          icon={<FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
          color="bg-purple-500/10"
        />
        <KPICard
          label="متوسط الفاتورة"
          value={avgInvoice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          subtitle={CURRENCY}
          icon={<BarChart3 className="w-5 h-5 text-orange-600 dark:text-orange-400" />}
          color="bg-orange-500/10"
        />
        <KPICard
          label="نسبة البيع النقدي"
          value={`${cashRatio.toFixed(1)}%`}
          subtitle={`${cashSales} نقدي`}
          icon={<ShoppingCart className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
          color="bg-teal-500/10"
        />
        <KPICard
          label="عدد الزبائن"
          value={customers.length}
          subtitle="زبون"
          icon={<Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
          color="bg-indigo-500/10"
        />
      </div>

      {/* Distributors Section */}
      <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-emerald-500/10 px-4 py-3 flex items-center gap-2">
          <Package className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-black text-foreground text-sm">الموزعين الميدانيين</h3>
          <span className="mr-auto bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
            {distributors.length}
          </span>
        </div>
        {distributors.length === 0 ? (
          <div className="p-6 text-center">
            <Package className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-muted-foreground text-sm">لا يوجد موزعين</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {employeeKPIs.filter(e => e.type === EmployeeType.FIELD_AGENT).map((emp, idx) => (
              <div key={emp.id}>
                <button
                  onClick={() => setExpandedEmployee(expandedEmployee === emp.id ? null : emp.id)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="w-8 h-8 flex items-center justify-center">
                    {idx === 0 ? <Trophy className="w-5 h-5 text-yellow-500" /> :
                      <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-black text-muted-foreground">{idx + 1}</span>}
                  </div>
                  <div className="flex-1 text-right">
                    <p className="font-bold text-foreground text-sm">{emp.name}</p>
                    <p className="text-[10px] text-muted-foreground">موزع ميداني</p>
                  </div>
                  <div className={`px-2 py-1 rounded-lg text-xs font-black ${getScoreBg(emp.kpis.collectionRate)} ${getScoreColor(emp.kpis.collectionRate)}`}>
                    {emp.kpis.collectionRate.toFixed(0)}%
                  </div>
                  {expandedEmployee === emp.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                {expandedEmployee === emp.id && (
                  <div className="px-4 pb-3 grid grid-cols-2 gap-2 animate-fade-in">
                    <KPICard label="المبيعات" value={emp.kpis.salesAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} subtitle={CURRENCY}
                      icon={<Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />} color="bg-emerald-500/10" />
                    <KPICard label="التحصيلات" value={emp.kpis.collectionsAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} subtitle={CURRENCY}
                      icon={<Target className="w-4 h-4 text-blue-600 dark:text-blue-400" />} color="bg-blue-500/10" benchmark="≥ 85%" />
                    <KPICard label="الفواتير" value={emp.kpis.salesCount} subtitle="فاتورة"
                      icon={<FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />} color="bg-purple-500/10" benchmark="≥ 10/يوم" />
                    <KPICard label="متوسط الفاتورة" value={emp.kpis.avgInvoice.toLocaleString(undefined, { maximumFractionDigits: 0 })} subtitle={CURRENCY}
                      icon={<BarChart3 className="w-4 h-4 text-orange-600 dark:text-orange-400" />} color="bg-orange-500/10" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Warehouse Keepers Section */}
      <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-purple-500/10 px-4 py-3 flex items-center gap-2">
          <WarehouseIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="font-black text-foreground text-sm">أمناء المستودع</h3>
          <span className="mr-auto bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
            {warehouseKeepers.length}
          </span>
        </div>
        {warehouseKeepers.length === 0 ? (
          <div className="p-6 text-center">
            <WarehouseIcon className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-muted-foreground text-sm">لا يوجد أمناء مستودع</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {employeeKPIs.filter(e => e.type === EmployeeType.WAREHOUSE_KEEPER).map((emp, idx) => (
              <div key={emp.id}>
                <button
                  onClick={() => setExpandedEmployee(expandedEmployee === emp.id ? null : emp.id)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="w-8 h-8 flex items-center justify-center">
                    <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-black text-muted-foreground">{idx + 1}</span>
                  </div>
                  <div className="flex-1 text-right">
                    <p className="font-bold text-foreground text-sm">{emp.name}</p>
                    <p className="text-[10px] text-muted-foreground">أمين مستودع</p>
                  </div>
                  <div className="px-2 py-1 rounded-lg text-xs font-black bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    {emp.kpis.score} نقطة
                  </div>
                  {expandedEmployee === emp.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                {expandedEmployee === emp.id && (
                  <div className="px-4 pb-3 grid grid-cols-2 gap-2 animate-fade-in">
                    <KPICard label="إجمالي المنتجات" value={products.filter(p => !p.isDeleted).length} subtitle="صنف"
                      icon={<Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />} color="bg-blue-500/10" />
                    <KPICard label="دقة المخزون" value={`${products.length > 0 ? ((products.filter(p => p.stock > p.minStock && !p.isDeleted).length / Math.max(products.filter(p => !p.isDeleted).length, 1)) * 100).toFixed(0) : 0}%`}
                      subtitle="فوق الحد الأدنى"
                      icon={<CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />} color="bg-emerald-500/10" benchmark="≥ 95%" />
                    <KPICard label="منتجات منخفضة" value={products.filter(p => p.stock <= p.minStock && !p.isDeleted).length} subtitle="صنف"
                      icon={<AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />} color="bg-red-500/10"
                      trend={products.filter(p => p.stock <= p.minStock && !p.isDeleted).length > 0 ? 'down' : 'up'} />
                    <KPICard label="إجمالي المخزون" value={products.filter(p => !p.isDeleted).reduce((s, p) => s + p.stock, 0).toLocaleString()} subtitle="قطعة"
                      icon={<Activity className="w-4 h-4 text-purple-600 dark:text-purple-400" />} color="bg-purple-500/10" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Benchmarks Legend */}
      <div className="bg-muted p-3 rounded-2xl border">
        <h4 className="font-black text-foreground mb-2 flex items-center gap-2 text-xs">
          <Target className="w-4 h-4 text-primary" /> معايير الأداء
        </h4>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">تحصيل ≥ 85%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">مرتجعات ≤ 5%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            <span className="text-muted-foreground">دقة مخزون ≥ 95%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-muted-foreground">≥ 10 فواتير/يوم</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DistributorWarehouseKPIs;
