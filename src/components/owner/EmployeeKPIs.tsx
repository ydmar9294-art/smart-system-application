import React, { useMemo, forwardRef } from 'react';
import { useApp } from '@/store/AppContext';
import { CURRENCY } from '@/constants';
import { Trophy, Star, TrendingUp, Users, DollarSign, Target, Award, Medal } from 'lucide-react';
import { EmployeeType } from '@/types';

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

interface EmployeeKPIsProps {
  className?: string;
}

export const EmployeeKPIs = forwardRef<HTMLDivElement, EmployeeKPIsProps>(({ className }, ref) => {
  const { users, sales, payments } = useApp();

  const performance = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    
    // الموظفين فقط
    const employees = users.filter(u => u.employeeType);

    const performanceData: EmployeePerformance[] = employees.map(emp => {
      // مبيعات هذا الشهر للموظف
      const empSales = sales.filter(s => 
        s.timestamp >= monthStart && 
        !s.isVoided
      );
      
      // تحصيلات هذا الشهر
      const empCollections = payments.filter(p => 
        p.timestamp >= monthStart && 
        !p.isReversed
      );

      // نوزع المبيعات بالتساوي مؤقتاً (يمكن تحسينه لاحقاً بإضافة created_by للمبيعات)
      const salesPerEmployee = empSales.length > 0 ? empSales.length / Math.max(employees.length, 1) : 0;
      const revenuePerEmployee = empSales.reduce((s, v) => s + v.grandTotal, 0) / Math.max(employees.length, 1);
      const collectionsPerEmployee = empCollections.reduce((s, p) => s + p.amount, 0) / Math.max(employees.length, 1);

      // حساب النقاط
      const score = Math.round(
        (revenuePerEmployee * 0.4) + 
        (collectionsPerEmployee * 0.4) + 
        (salesPerEmployee * 100 * 0.2)
      );

      return {
        id: emp.id,
        name: emp.name,
        type: emp.employeeType as EmployeeType,
        totalSales: revenuePerEmployee,
        totalCollections: collectionsPerEmployee,
        salesCount: Math.round(salesPerEmployee),
        collectionsCount: Math.round(empCollections.length / Math.max(employees.length, 1)),
        score
      };
    });

    // ترتيب حسب النقاط
    return performanceData.sort((a, b) => b.score - a.score);
  }, [users, sales, payments]);

  const topPerformer = performance[0];

  if (performance.length === 0) {
    return (
      <div ref={ref} className={`bg-card p-5 rounded-[2rem] border shadow-sm text-center ${className || ''}`}>
        <Users size={40} className="mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground font-bold text-sm">لا يوجد موظفين لعرض أدائهم</p>
      </div>
    );
  }

  return (
    <div ref={ref} className={`space-y-3 animate-fade-in ${className || ''}`}>
      {/* أفضل موظف - Compact */}
      {topPerformer && (
        <div className="bg-gradient-to-br from-primary to-primary/80 p-4 rounded-[2rem] text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-2 left-2 opacity-20">
            <Trophy size={60} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Trophy size={20} className="text-yellow-300" />
              </div>
              <div>
                <p className="text-white/70 text-[10px] font-bold">موظف الشهر</p>
                <h3 className="text-lg font-black">{topPerformer.name}</h3>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white/10 p-2 rounded-lg text-center">
                <p className="text-white/60 text-[8px] font-bold">المبيعات</p>
                <p className="font-black text-sm">{topPerformer.totalSales.toLocaleString()}</p>
              </div>
              <div className="bg-white/10 p-2 rounded-lg text-center">
                <p className="text-white/60 text-[8px] font-bold">التحصيلات</p>
                <p className="font-black text-sm">{topPerformer.totalCollections.toLocaleString()}</p>
              </div>
              <div className="bg-white/10 p-2 rounded-lg text-center">
                <p className="text-white/60 text-[8px] font-bold">النقاط</p>
                <p className="font-black text-sm">{topPerformer.score.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* قائمة الموظفين - Compact */}
      <div className="bg-card p-4 rounded-[2rem] border shadow-sm">
        <h3 className="font-black text-foreground mb-3 flex items-center gap-2 text-sm">
          <Target size={16} className="text-primary" />
          ترتيب الموظفين
        </h3>
        <div className="space-y-2">
          {performance.map((emp, index) => (
            <EmployeeCard key={emp.id} employee={emp} rank={index + 1} />
          ))}
        </div>
      </div>

      {/* نصائح تحفيزية - Compact */}
      <div className="bg-muted p-4 rounded-[1.5rem] border">
        <h4 className="font-black text-foreground mb-2 flex items-center gap-2 text-sm">
          <Star size={14} className="text-warning" />
          معايير التقييم
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
    </div>
  );
});

EmployeeKPIs.displayName = 'EmployeeKPIs';

const EmployeeCard: React.FC<{ employee: EmployeePerformance; rank: number }> = ({ employee, rank }) => {
  const getRankIcon = () => {
    if (rank === 1) return <Trophy size={16} className="text-yellow-500" />;
    if (rank === 2) return <Medal size={16} className="text-slate-400" />;
    if (rank === 3) return <Award size={16} className="text-amber-600" />;
    return <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-black">{rank}</span>;
  };

  const typeLabel = employee.type === EmployeeType.FIELD_AGENT ? 'موزع' 
    : employee.type === EmployeeType.SALES_MANAGER ? 'مدير مبيعات'
    : employee.type === EmployeeType.WAREHOUSE_KEEPER ? 'أمين مستودع'
    : 'محاسب';

  return (
    <div className={`p-3 rounded-xl border ${rank <= 3 ? 'bg-primary/5 border-primary/20' : 'bg-muted border-transparent'}`}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 flex items-center justify-center">
          {getRankIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center">
            <div className="min-w-0">
              <h4 className="font-black text-foreground text-sm truncate">{employee.name}</h4>
              <p className="text-[9px] text-muted-foreground font-bold">{typeLabel}</p>
            </div>
            <div className="text-end flex-shrink-0">
              <p className="text-base font-black text-primary">{employee.score.toLocaleString()}</p>
              <p className="text-[9px] text-muted-foreground">نقطة</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
