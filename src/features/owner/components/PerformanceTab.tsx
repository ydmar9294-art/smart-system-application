import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '@/store/AppContext';
import { CURRENCY } from '@/constants';
import { EmployeeType, PaymentType } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import {
  Trophy, Star, TrendingUp, Users, DollarSign, Target, Award, Medal,
  Package, Wallet, BarChart3, Truck, ShoppingCart, Loader2, ClipboardCheck,
  Calculator, Warehouse, UserCheck
} from 'lucide-react';

interface EmployeePerformance {
  id: string;
  name: string;
  type: EmployeeType;
  totalSales: number;
  totalCollections: number;
  salesCount: number;
  collectionsCount: number;
  deliveriesReceived: number;
  purchasesCount: number;
  score: number;
}

export const PerformanceTab: React.FC = () => {
  const { users, sales, payments, products, customers, deliveries } = useApp();
  const [distributorInventory, setDistributorInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDistInv = async () => {
      try {
        const { data } = await supabase.from('distributor_inventory').select('*');
        setDistributorInventory(data || []);
      } catch {}
      setLoading(false);
    };
    fetchDistInv();
  }, []);

  const performance = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const employees = users.filter(u => u.employeeType);

    const monthSales = sales.filter(s => s.timestamp >= monthStart && !s.isVoided);
    const monthPayments = payments.filter(p => p.timestamp >= monthStart && !p.isReversed);

    const performanceData: EmployeePerformance[] = employees.map(emp => {
      const empSales = monthSales.filter(s => s.createdBy === emp.id);
      const empCollections = monthPayments.filter(p => p.collectedBy === emp.id);
      const revenuePerEmployee = empSales.reduce((s, v) => s + v.grandTotal, 0);
      const collectionsPerEmployee = empCollections.reduce((s, p) => s + p.amount, 0);
      const empDeliveries = (deliveries || []).filter((d: any) => d.distributor_id === emp.id);

      let score = 0;
      switch (emp.employeeType) {
        case EmployeeType.FIELD_AGENT:
          // الموزع: مبيعات 40% + تحصيلات 35% + عدد الفواتير 15% + عدد الزبائن المخدومين 10%
          const uniqueCustomers = new Set(empSales.map(s => s.customer_id)).size;
          score = Math.round(
            (revenuePerEmployee * 0.4) + (collectionsPerEmployee * 0.35) + (empSales.length * 100 * 0.15) + (uniqueCustomers * 200 * 0.1)
          );
          break;
        case EmployeeType.ACCOUNTANT:
          // المحاسب: تحصيلات 50% + عدد عمليات التحصيل 30% + دقة (بدون عمليات معكوسة) 20%
          const reversedCount = monthPayments.filter(p => p.collectedBy === emp.id && p.isReversed).length;
          const accuracyScore = empCollections.length > 0 ? ((empCollections.length - reversedCount) / empCollections.length) * 1000 : 0;
          score = Math.round(
            (collectionsPerEmployee * 0.5) + (empCollections.length * 150 * 0.3) + (accuracyScore * 0.2)
          );
          break;
        // SALES_MANAGER and WAREHOUSE_KEEPER roles removed — no scoring case needed
        default:
          score = Math.round((revenuePerEmployee * 0.4) + (collectionsPerEmployee * 0.4) + (empSales.length * 100 * 0.2));
      }

      return {
        id: emp.id, name: emp.name, type: emp.employeeType as EmployeeType,
        totalSales: revenuePerEmployee, totalCollections: collectionsPerEmployee,
        salesCount: empSales.length, collectionsCount: empCollections.length,
        deliveriesReceived: empDeliveries.length, purchasesCount: 0, score
      };
    });

    return performanceData.sort((a, b) => b.score - a.score);
  }, [users, sales, payments, products, deliveries]);

  // إحصائيات المنشأة
  const orgStats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthSales = sales.filter(s => s.timestamp >= monthStart && !s.isVoided);
    const monthRevenue = monthSales.reduce((s, v) => s + v.grandTotal, 0);
    const monthCash = monthSales.filter(s => s.paymentType === PaymentType.CASH).reduce((s, v) => s + v.grandTotal, 0);
    const monthCredit = monthSales.filter(s => s.paymentType === PaymentType.CREDIT).reduce((s, v) => s + v.grandTotal, 0);
    const monthCollections = payments.filter(p => p.timestamp >= monthStart && !p.isReversed).reduce((s, p) => s + p.amount, 0);
    const totalInventoryValue = products.filter(p => !p.isDeleted).reduce((s, p) => s + (p.costPrice * p.stock), 0);
    const distInvValue = distributorInventory.reduce((s, item) => {
      const product = products.find(p => p.id === item.product_id);
      return s + (product ? product.costPrice * item.quantity : 0);
    }, 0);

    return { monthRevenue, monthCash, monthCredit, monthCollections, totalInventoryValue, distInvValue, totalSalesCount: monthSales.length };
  }, [sales, payments, products, distributorInventory]);

  const distributors = performance.filter(e => e.type === EmployeeType.FIELD_AGENT);
  const accountants = performance.filter(e => e.type === EmployeeType.ACCOUNTANT);

  const topPerformer = performance[0];

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy size={14} className="text-yellow-500" />;
    if (rank === 2) return <Medal size={14} className="text-slate-400" />;
    if (rank === 3) return <Award size={14} className="text-amber-600" />;
    return <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-black">{rank}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* KPIs الشهرية */}
      <div className="p-4 rounded-2xl bg-card shadow-sm">
        <h3 className="font-black text-foreground text-sm mb-3 flex items-center gap-2">
          <BarChart3 size={16} className="text-primary" /> أداء المنشأة هذا الشهر
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-primary/5 p-3 rounded-xl text-center">
            <DollarSign className="w-5 h-5 mx-auto text-primary mb-1" />
            <p className="text-lg font-black text-foreground">{orgStats.monthRevenue.toLocaleString()}</p>
            <p className="text-[8px] text-muted-foreground font-bold">إيرادات الشهر</p>
          </div>
          <div className="bg-success/5 p-3 rounded-xl text-center">
            <Wallet className="w-5 h-5 mx-auto text-success mb-1" />
            <p className="text-lg font-black text-foreground">{orgStats.monthCollections.toLocaleString()}</p>
            <p className="text-[8px] text-muted-foreground font-bold">التحصيلات</p>
          </div>
          <div className="bg-emerald-500/5 p-3 rounded-xl text-center">
            <TrendingUp className="w-4 h-4 mx-auto text-emerald-600 dark:text-emerald-400 mb-1" />
            <p className="text-sm font-black text-foreground">{orgStats.monthCash.toLocaleString()}</p>
            <p className="text-[8px] text-muted-foreground font-bold">نقدي</p>
          </div>
          <div className="bg-amber-500/5 p-3 rounded-xl text-center">
            <ShoppingCart className="w-4 h-4 mx-auto text-amber-600 dark:text-amber-400 mb-1" />
            <p className="text-sm font-black text-foreground">{orgStats.monthCredit.toLocaleString()}</p>
            <p className="text-[8px] text-muted-foreground font-bold">آجل</p>
          </div>
        </div>
      </div>

      {/* ملخص المخزون */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-2xl bg-card shadow-sm">
          <Package className="w-5 h-5 text-primary mb-1" />
          <p className="text-[9px] text-muted-foreground font-bold">المخزون الرئيسي</p>
          <p className="text-sm font-black text-foreground">{orgStats.totalInventoryValue.toLocaleString()}</p>
          <p className="text-[9px] text-muted-foreground">{CURRENCY}</p>
        </div>
        <div className="p-3 rounded-2xl bg-card shadow-sm">
          <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-1" />
          <p className="text-[9px] text-muted-foreground font-bold">مخزون الموزعين</p>
          <p className="text-sm font-black text-foreground">{orgStats.distInvValue.toLocaleString()}</p>
          <p className="text-[9px] text-muted-foreground">{CURRENCY}</p>
        </div>
      </div>

      {/* أفضل موظف */}
      {topPerformer && topPerformer.score > 0 && (
        <div className="bg-gradient-to-br from-primary to-primary/80 p-4 rounded-2xl text-primary-foreground shadow-lg relative overflow-hidden">
          <div className="absolute top-2 left-2 opacity-20"><Trophy size={50} /></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Trophy size={18} className="text-yellow-300" />
              </div>
              <div>
                <p className="text-primary-foreground/70 text-[10px] font-bold">موظف الشهر</p>
                <h3 className="text-lg font-black">{topPerformer.name}</h3>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white/10 p-2 rounded-lg text-center">
                <p className="text-primary-foreground/60 text-[8px] font-bold">المبيعات</p>
                <p className="font-black text-sm">{topPerformer.totalSales.toLocaleString()}</p>
              </div>
              <div className="bg-white/10 p-2 rounded-lg text-center">
                <p className="text-primary-foreground/60 text-[8px] font-bold">التحصيلات</p>
                <p className="font-black text-sm">{topPerformer.totalCollections.toLocaleString()}</p>
              </div>
              <div className="bg-white/10 p-2 rounded-lg text-center">
                <p className="text-primary-foreground/60 text-[8px] font-bold">النقاط</p>
                <p className="font-black text-sm">{topPerformer.score.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* أداء الموزعين */}
      {distributors.length > 0 && (
        <PerformanceSection title="أداء الموزعين" icon={<Truck size={16} />} employees={distributors} getRankIcon={getRankIcon}
          criteria={[
            { label: 'مبيعات 40%', icon: <DollarSign size={12} className="text-success" /> },
            { label: 'تحصيل 35%', icon: <Wallet size={12} className="text-primary" /> },
            { label: 'فواتير 15%', icon: <ClipboardCheck size={12} className="text-warning" /> },
            { label: 'زبائن 10%', icon: <UserCheck size={12} className="text-blue-500" /> },
          ]}
        />
      )}

      {/* أداء مديري المبيعات */}
      {salesManagers.length > 0 && (
        <PerformanceSection title="مديرو المبيعات" icon={<Target size={16} />} employees={salesManagers} getRankIcon={getRankIcon}
          criteria={[
            { label: 'مبيعات الفريق 35%', icon: <DollarSign size={12} className="text-success" /> },
            { label: 'نسبة التحصيل 35%', icon: <Wallet size={12} className="text-primary" /> },
            { label: 'تنوع الزبائن 15%', icon: <Users size={12} className="text-blue-500" /> },
            { label: 'عدد العمليات 15%', icon: <ClipboardCheck size={12} className="text-warning" /> },
          ]}
        />
      )}

      {/* المحاسبين */}
      {accountants.length > 0 && (
        <PerformanceSection title="المحاسبون" icon={<Calculator size={16} />} employees={accountants} getRankIcon={getRankIcon}
          criteria={[
            { label: 'تحصيلات 50%', icon: <Wallet size={12} className="text-success" /> },
            { label: 'عمليات 30%', icon: <ClipboardCheck size={12} className="text-primary" /> },
            { label: 'دقة 20%', icon: <Target size={12} className="text-warning" /> },
          ]}
        />
      )}

      {/* أمناء المستودعات */}
      {warehouseKeepers.length > 0 && (
        <PerformanceSection title="أمناء المستودعات" icon={<Warehouse size={16} />} employees={warehouseKeepers} getRankIcon={getRankIcon}
          criteria={[
            { label: 'تسليمات 40%', icon: <Truck size={12} className="text-success" /> },
            { label: 'صحة المخزون 35%', icon: <Package size={12} className="text-primary" /> },
            { label: 'عمليات 25%', icon: <ClipboardCheck size={12} className="text-warning" /> },
          ]}
        />
      )}

      {performance.length === 0 && (
        <div className="p-8 rounded-2xl text-center bg-card shadow-sm">
          <Users size={40} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-bold text-sm">لا يوجد موظفين لعرض أدائهم</p>
        </div>
      )}
    </div>
  );
};

/* ========== Performance Section ========== */
const PerformanceSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  employees: EmployeePerformance[];
  getRankIcon: (rank: number) => React.ReactNode;
  criteria: { label: string; icon: React.ReactNode }[];
}> = ({ title, icon, employees, getRankIcon, criteria }) => (
  <div className="p-4 rounded-2xl bg-card shadow-sm">
    <h3 className="font-black text-foreground mb-3 flex items-center gap-2 text-sm">
      {icon} {title}
    </h3>
    <div className="space-y-2">
      {employees.map((emp, index) => (
        <div key={emp.id} className={`p-3 rounded-xl border ${index < 3 ? 'bg-primary/5 border-primary/20' : 'bg-muted border-transparent'}`}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 flex items-center justify-center">{getRankIcon(index + 1)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center">
                <h4 className="font-black text-foreground text-sm truncate">{emp.name}</h4>
                <div className="text-end flex-shrink-0">
                  <p className="text-sm font-black text-primary">{emp.score.toLocaleString()}</p>
                  <p className="text-[8px] text-muted-foreground">نقطة</p>
                </div>
              </div>
              <div className="flex gap-3 mt-1 text-[9px] text-muted-foreground">
                <span>مبيعات: {emp.totalSales.toLocaleString()}</span>
                <span>تحصيلات: {emp.totalCollections.toLocaleString()}</span>
                <span>فواتير: {emp.salesCount}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
    {/* معايير التقييم لهذا الدور */}
    <div className="mt-3 bg-muted/50 p-3 rounded-xl">
      <p className="text-[10px] font-bold text-foreground mb-2 flex items-center gap-1">
        <Star size={10} className="text-warning" /> معايير التقييم
      </p>
      <div className="flex flex-wrap gap-2">
        {criteria.map((c, i) => (
          <div key={i} className="flex items-center gap-1 text-[9px] text-muted-foreground">
            {c.icon}
            <span>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);
