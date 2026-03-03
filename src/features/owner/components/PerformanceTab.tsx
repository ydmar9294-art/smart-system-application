import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '@/store/AppContext';
import { CURRENCY } from '@/constants';
import { EmployeeType, PaymentType } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import {
  Trophy, Star, TrendingUp, Users, DollarSign, Target, Award, Medal,
  Package, Wallet, BarChart3, Truck, ShoppingCart, Loader2
} from 'lucide-react';

interface EmployeePerformance {
  id: string;
  name: string;
  type: EmployeeType;
  totalSales: number;
  totalCollections: number;
  salesCount: number;
  collectionsCount: number;
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

  // أداء الموظفين
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

      const score = Math.round(
        (revenuePerEmployee * 0.4) + (collectionsPerEmployee * 0.4) + (empSales.length * 100 * 0.2)
      );

      return {
        id: emp.id,
        name: emp.name,
        type: emp.employeeType as EmployeeType,
        totalSales: revenuePerEmployee,
        totalCollections: collectionsPerEmployee,
        salesCount: empSales.length,
        collectionsCount: empCollections.length,
        score
      };
    });

    return performanceData.sort((a, b) => b.score - a.score);
  }, [users, sales, payments]);

  // إحصائيات المنشأة
  const orgStats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthSales = sales.filter(s => s.timestamp >= monthStart && !s.isVoided);
    const monthRevenue = monthSales.reduce((s, v) => s + v.grandTotal, 0);
    const monthCash = monthSales.filter(s => s.paymentType === PaymentType.CASH).reduce((s, v) => s + v.grandTotal, 0);
    const monthCredit = monthSales.filter(s => s.paymentType === PaymentType.CREDIT).reduce((s, v) => s + v.grandTotal, 0);
    const monthCollections = payments.filter(p => p.timestamp >= monthStart && !p.isReversed).reduce((s, p) => s + p.amount, 0);
    const totalDebt = customers.reduce((s, c) => s + Math.max(0, c.balance), 0);
    const lowStockCount = products.filter(p => p.stock <= p.minStock && !p.isDeleted).length;
    const totalInventoryValue = products.filter(p => !p.isDeleted).reduce((s, p) => s + (p.costPrice * p.stock), 0);

    // مخزون الموزعين
    const distInvValue = distributorInventory.reduce((s, item) => {
      const product = products.find(p => p.id === item.product_id);
      return s + (product ? product.costPrice * item.quantity : 0);
    }, 0);

    return {
      monthRevenue, monthCash, monthCredit, monthCollections, totalDebt,
      lowStockCount, totalInventoryValue, distInvValue,
      totalSalesCount: monthSales.length,
      activeEmployees: users.filter(u => u.employeeType && u.isActive !== false).length,
    };
  }, [sales, payments, customers, products, distributorInventory, users]);

  // أداء الموزعين
  const distributors = performance.filter(e => e.type === EmployeeType.FIELD_AGENT);
  const salesManagers = performance.filter(e => e.type === EmployeeType.SALES_MANAGER);
  const accountants = performance.filter(e => e.type === EmployeeType.ACCOUNTANT);
  const warehouseKeepers = performance.filter(e => e.type === EmployeeType.WAREHOUSE_KEEPER);

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
      <div className="p-4 rounded-2xl" style={{ background: 'var(--card-glass-bg)', backdropFilter: 'blur(var(--glass-blur))', border: '1px solid var(--card-glass-border)', boxShadow: 'var(--glass-shadow)' }}>
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
        <div className="p-3 rounded-2xl" style={{ background: 'var(--card-glass-bg)', border: '1px solid var(--card-glass-border)' }}>
          <Package className="w-5 h-5 text-primary mb-1" />
          <p className="text-[9px] text-muted-foreground font-bold">قيمة المخزون الرئيسي</p>
          <p className="text-sm font-black text-foreground">{orgStats.totalInventoryValue.toLocaleString()}</p>
          <p className="text-[9px] text-muted-foreground">{CURRENCY}</p>
        </div>
        <div className="p-3 rounded-2xl" style={{ background: 'var(--card-glass-bg)', border: '1px solid var(--card-glass-border)' }}>
          <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-1" />
          <p className="text-[9px] text-muted-foreground font-bold">مخزون الموزعين</p>
          <p className="text-sm font-black text-foreground">{orgStats.distInvValue.toLocaleString()}</p>
          <p className="text-[9px] text-muted-foreground">{CURRENCY}</p>
        </div>
      </div>

      {/* أفضل موظف */}
      {topPerformer && topPerformer.score > 0 && (
        <div className="bg-gradient-to-br from-primary to-primary/80 p-4 rounded-2xl text-primary-foreground shadow-lg relative overflow-hidden">
          <div className="absolute top-2 left-2 opacity-20">
            <Trophy size={50} />
          </div>
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
        <PerformanceSection title="أداء الموزعين" icon={<Truck size={16} />} employees={distributors} getRankIcon={getRankIcon} />
      )}

      {/* أداء مديري المبيعات */}
      {salesManagers.length > 0 && (
        <PerformanceSection title="مديرو المبيعات" icon={<Target size={16} />} employees={salesManagers} getRankIcon={getRankIcon} />
      )}

      {/* المحاسبين */}
      {accountants.length > 0 && (
        <PerformanceSection title="المحاسبون" icon={<DollarSign size={16} />} employees={accountants} getRankIcon={getRankIcon} />
      )}

      {/* أمناء المستودعات */}
      {warehouseKeepers.length > 0 && (
        <PerformanceSection title="أمناء المستودعات" icon={<Package size={16} />} employees={warehouseKeepers} getRankIcon={getRankIcon} />
      )}

      {performance.length === 0 && (
        <div className="p-8 rounded-2xl text-center" style={{ background: 'var(--card-glass-bg)', border: '1px solid var(--card-glass-border)' }}>
          <Users size={40} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-bold text-sm">لا يوجد موظفين لعرض أدائهم</p>
        </div>
      )}

      {/* معايير التقييم */}
      {performance.length > 0 && (
        <div className="bg-muted p-4 rounded-2xl border">
          <h4 className="font-black text-foreground mb-2 flex items-center gap-2 text-sm">
            <Star size={14} className="text-warning" /> معايير التقييم
          </h4>
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div className="flex items-center gap-1">
              <DollarSign size={12} className="text-success" />
              <span className="text-muted-foreground">مبيعات 40%</span>
            </div>
            <div className="flex items-center gap-1">
              <Target size={12} className="text-primary" />
              <span className="text-muted-foreground">تحصيل 40%</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp size={12} className="text-warning" />
              <span className="text-muted-foreground">فواتير 20%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PerformanceSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  employees: EmployeePerformance[];
  getRankIcon: (rank: number) => React.ReactNode;
}> = ({ title, icon, employees, getRankIcon }) => (
  <div className="p-4 rounded-2xl" style={{ background: 'var(--card-glass-bg)', backdropFilter: 'blur(var(--glass-blur))', border: '1px solid var(--card-glass-border)' }}>
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
  </div>
);
