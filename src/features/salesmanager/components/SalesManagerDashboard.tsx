import React, { useState, useMemo } from 'react';
import DeletionRequestsManager from '@/features/shared/components/DeletionRequestsManager';
import { createPortal } from 'react-dom';
import { copyToClipboard } from '@/lib/clipboard';
import { 
  Users, LogOut, LayoutDashboard, UserPlus, X, Copy, CheckCircle2, Clock,
  ShieldCheck, MessageCircle, TrendingUp, Package, Wallet, FileText,
  Warehouse as WarehouseIcon, BarChart3, UserX, UserCheck, Loader2, Trash2,
  Home, PieChart, Settings
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { CURRENCY } from '@/constants';
import { UserRole, EmployeeType } from '@/types';
import AIAssistant from '@/features/ai/components/AIAssistant';
import WelcomeSplash from '@/components/ui/WelcomeSplash';
import DistributorWarehouseKPIs from '@/features/analytics/components/DistributorWarehouseKPIs';
import { DashboardHeader } from '@/components/ui/DashboardHeader';
import { BottomTabNav } from '@/components/ui/BottomTabNav';
import { GlassCard, GlassKPI } from '@/components/ui/GlassCard';

type SalesManagerTabType = 'dashboard' | 'team' | 'sales' | 'kpi';
type BottomNavType = 'home' | 'team' | 'reports';

const SalesManagerDashboard: React.FC = () => {
  const { 
    user, sales = [], payments = [], customers = [], users = [],
    logout, addDistributor, pendingEmployees = [],
    deactivateEmployee, reactivateEmployee
  } = useApp();
  
  const [activeTab, setActiveTab] = useState<SalesManagerTabType>('dashboard');
  const [bottomNav, setBottomNav] = useState<BottomNavType>('home');
  const [loggingOut, setLoggingOut] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newEmployeeCode, setNewEmployeeCode] = useState<string | null>(null);
  const [newEmployeeData, setNewEmployeeData] = useState<any | null>(null);
  const [togglingEmployee, setTogglingEmployee] = useState<string | null>(null);
  const [employeeLimitError, setEmployeeLimitError] = useState<string | null>(null);

  React.useEffect(() => {
    if (['dashboard'].includes(activeTab)) setBottomNav('home');
    else if (['team'].includes(activeTab)) setBottomNav('team');
    else if (['sales', 'kpi'].includes(activeTab)) setBottomNav('reports');
  }, [activeTab]);

  const stats = useMemo(() => {
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const todaySales = sales.filter(s => s.timestamp >= todayStart);
    const todayRevenue = todaySales.reduce((s, i) => s + i.grandTotal, 0);
    const totalCollections = payments.filter(c => c.timestamp >= todayStart).reduce((s, i) => s + i.amount, 0);
    return { todayRevenue, totalCollections, todaySalesCount: todaySales.length };
  }, [sales, payments]);

  const teamMembers = users.filter(u => 
    u.role === UserRole.EMPLOYEE && 
    (u.employeeType === EmployeeType.FIELD_AGENT || u.employeeType === EmployeeType.WAREHOUSE_KEEPER)
  );
  const distributors = users.filter(u => u.role === UserRole.EMPLOYEE && u.employeeType === EmployeeType.FIELD_AGENT);
  const warehouseKeepers = users.filter(u => u.role === UserRole.EMPLOYEE && u.employeeType === EmployeeType.WAREHOUSE_KEEPER);
  const myPendingEmployees = pendingEmployees.filter(pe => 
    !pe.is_used && (pe.employee_type === EmployeeType.FIELD_AGENT || pe.employee_type === EmployeeType.WAREHOUSE_KEEPER)
  );
  const myActivatedEmployees = pendingEmployees.filter(pe => 
    pe.is_used && (pe.employee_type === EmployeeType.FIELD_AGENT || pe.employee_type === EmployeeType.WAREHOUSE_KEEPER)
  );

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await logout(); } finally { setLoggingOut(false); }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmployeeLimitError(null);
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const result = await addDistributor(fd.get('name') as string, fd.get('phone') as string, UserRole.EMPLOYEE, fd.get('type') as EmployeeType);
    if (result.code) { setNewEmployeeCode(result.code); setNewEmployeeData(result.employee); }
    else { setEmployeeLimitError('فشل إنشاء الموظف. تحقق من عدم تجاوز الحد الأقصى للموظفين النشطين.'); }
  };

  const closeEmployeeModal = () => { setShowAddUserModal(false); setNewEmployeeCode(null); setNewEmployeeData(null); };

  const handleToggleEmployee = async (employeeId: string, isActive: boolean) => {
    setTogglingEmployee(employeeId);
    try { if (isActive) await deactivateEmployee(employeeId); else await reactivateEmployee(employeeId); }
    finally { setTogglingEmployee(null); }
  };

  const getEmployeeTypeLabel = (type: EmployeeType) => {
    switch (type) {
      case EmployeeType.FIELD_AGENT: return 'موزع ميداني';
      case EmployeeType.WAREHOUSE_KEEPER: return 'أمين مستودع';
      default: return type;
    }
  };

  const handleBottomNavChange = (navId: string) => {
    setBottomNav(navId as BottomNavType);
    switch (navId) {
      case 'home': setActiveTab('dashboard'); break;
      case 'team': setActiveTab('team'); break;
      case 'reports': setActiveTab('sales'); break;
    }
  };

  const getSectionTabs = () => {
    switch (bottomNav) {
      case 'reports': return [
        { id: 'sales', label: 'المبيعات', icon: <TrendingUp className="w-4 h-4" />, bgColor: 'bg-purple-600' },
        { id: 'kpi', label: 'الأداء', icon: <BarChart3 className="w-4 h-4" />, bgColor: 'bg-emerald-600' },
      ];
      default: return null;
    }
  };

  const sectionTabs = getSectionTabs();

  const bottomTabs = [
    { id: 'home', label: 'الرئيسية', icon: <Home className="w-5 h-5" /> },
    { id: 'team', label: 'الفريق', icon: <Users className="w-5 h-5" /> },
    { id: 'reports', label: 'التقارير', icon: <PieChart className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-background has-bottom-nav" dir="rtl">
      <div className="max-w-lg mx-auto">
        <DashboardHeader
          userName={user?.name || 'مدير المبيعات'}
          subtitle="إدارة المبيعات"
          icon={<TrendingUp className="w-4 h-4 text-primary-foreground" />}
          iconBgClass="bg-warning"
          onLogout={handleLogout}
          loggingOut={loggingOut}
        />

        <WelcomeSplash />

        {sectionTabs && (
          <div className="px-4 pb-3">
            <div className="glass-section-tabs">
              {sectionTabs.map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as SalesManagerTabType)}
                  className={`glass-section-tab ${activeTab === tab.id ? `glass-section-tab-active ${tab.bgColor}` : 'glass-section-tab-inactive'}`}>
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="px-4 pb-4">
          {activeTab === 'dashboard' && (
            <SalesManagerDashboardContent stats={stats} customers={customers} distributors={distributors} warehouseKeepers={warehouseKeepers} sales={sales} />
          )}

          {activeTab === 'team' && (
            <div className="space-y-4 animate-fade-in">
              <button onClick={() => setShowAddUserModal(true)} 
                className="w-full py-4 bg-warning text-warning-foreground rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">
                <UserPlus className="w-5 h-5" /> إضافة موظف
              </button>
              
              {myPendingEmployees.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-bold text-foreground text-sm flex items-center gap-2 px-2">
                    <Clock className="w-4 h-4 text-warning" /> أكواد تفعيل معلقة
                  </h3>
                  {myPendingEmployees.map(pe => (
                    <GlassCard key={pe.id} className="!border-warning/20">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-foreground">{pe.name}</p>
                          <p className="text-xs text-muted-foreground">{pe.phone}</p>
                        </div>
                        <span className="bg-warning/15 text-warning px-2 py-1 rounded-lg text-xs font-bold">{getEmployeeTypeLabel(pe.employee_type)}</span>
                      </div>
                      <div onClick={async () => { await copyToClipboard(pe.activation_code); setCopiedId(pe.id); setTimeout(() => setCopiedId(null), 2000); }}
                        className="bg-muted/50 p-3 rounded-xl flex justify-between items-center cursor-pointer hover:bg-accent transition-colors">
                        <span className="font-mono font-bold text-primary tracking-wider">{pe.activation_code}</span>
                        {copiedId === pe.id ? <CheckCircle2 className="w-5 h-5 text-success" /> : <Copy className="w-5 h-5 text-muted-foreground" />}
                      </div>
                    </GlassCard>
                  ))}
                </div>
              )}

              {myActivatedEmployees.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-bold text-foreground text-sm flex items-center gap-2 px-2">
                    <CheckCircle2 className="w-4 h-4 text-success" /> أكواد مفعّلة
                  </h3>
                  {myActivatedEmployees.map(pe => (
                    <GlassCard key={pe.id} className="!border-success/20">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-foreground">{pe.name}</p>
                          <p className="text-xs text-muted-foreground">{pe.phone}</p>
                        </div>
                        <span className="bg-success/15 text-success px-2 py-1 rounded-lg text-xs font-bold">مفعّل ✓</span>
                      </div>
                      <div className="bg-muted/50 p-3 rounded-xl">
                        <span className="font-mono text-muted-foreground text-xs line-through">{pe.activation_code}</span>
                        {pe.activated_at && <p className="text-[10px] text-muted-foreground mt-1">تم التفعيل: {new Date(pe.activated_at).toLocaleDateString('ar-SY')}</p>}
                      </div>
                    </GlassCard>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                {teamMembers.length === 0 && myPendingEmployees.length === 0 ? (
                  <GlassCard className="!p-8 text-center">
                    <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground font-medium">لا يوجد موظفين</p>
                  </GlassCard>
                ) : (
                  teamMembers.map(u => {
                    const isActive = u.isActive !== false;
                    return (
                      <GlassCard key={u.id} className={!isActive ? 'opacity-60' : ''}>
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black ${isActive ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                              {u.name ? u.name.charAt(0) : '?'}
                            </div>
                            <div>
                              <p className="font-bold text-foreground">{u.name}</p>
                              <p className="text-xs text-muted-foreground">{getEmployeeTypeLabel(u.employeeType!)}</p>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-lg text-xs font-bold ${isActive ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                            {isActive ? 'نشط' : 'معطّل'}
                          </span>
                        </div>
                        <button onClick={() => handleToggleEmployee(u.id, isActive)} disabled={togglingEmployee === u.id}
                          className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                            isActive ? 'bg-destructive/10 text-destructive hover:bg-destructive/20' : 'bg-success/10 text-success hover:bg-success/20'
                          }`}>
                          {togglingEmployee === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> :
                            isActive ? <><UserX className="w-4 h-4" /> إيقاف الموظف</> : <><UserCheck className="w-4 h-4" /> إعادة التنشيط</>}
                        </button>
                      </GlassCard>
                    );
                  })
                )}
              </div>

              <GlassCard>
                <h3 className="font-bold text-foreground mb-3 text-sm flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-destructive" /> طلبات حذف الحسابات
                </h3>
                <DeletionRequestsManager />
              </GlassCard>
            </div>
          )}

          {activeTab === 'kpi' && <DistributorWarehouseKPIs />}

          {activeTab === 'sales' && (
            <div className="space-y-3 animate-fade-in">
              <GlassCard className="!p-6 !bg-gradient-to-br !from-purple-500/90 !to-purple-600/90 !text-white !border-purple-400/30" glow>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs opacity-80 mb-1">إجمالي المبيعات اليوم</p>
                    <p className="text-3xl font-black">{stats.todayRevenue.toLocaleString()} {CURRENCY}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs opacity-80 mb-1">عدد الفواتير</p>
                    <p className="text-2xl font-black">{stats.todaySalesCount}</p>
                  </div>
                </div>
              </GlassCard>

              <GlassCard>
                <h3 className="font-bold text-foreground mb-3 text-sm">آخر المبيعات</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {sales.slice(0, 10).map(sale => (
                    <div key={sale.id} className="flex justify-between items-center bg-muted/50 p-3 rounded-xl">
                      <div>
                        <p className="font-bold text-foreground text-sm">{sale.customerName}</p>
                        <p className="text-xs text-muted-foreground">{new Date(sale.timestamp).toLocaleString('ar-EG')}</p>
                      </div>
                      <div className="text-left">
                        <p className="font-black text-success">{sale.grandTotal.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">{CURRENCY}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
          )}
        </div>
      </div>

      <BottomTabNav tabs={bottomTabs} activeTab={bottomNav} onTabChange={handleBottomNavChange} />

      {/* Add Employee Modal */}
      {showAddUserModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-md flex items-center justify-center p-6 safe-area-x safe-area-bottom" dir="rtl">
          <div className="bg-card rounded-2xl w-full max-w-md p-6 space-y-4 animate-zoom-in shadow-2xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-foreground">{newEmployeeCode ? 'تم إنشاء كود التفعيل' : 'إضافة موظف جديد'}</h2>
              <button onClick={closeEmployeeModal} className="p-2 bg-muted rounded-full hover:bg-accent"><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            {employeeLimitError && !newEmployeeCode && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-xl border border-destructive/20 text-sm font-bold">{employeeLimitError}</div>
            )}
            {newEmployeeCode ? (
              <div className="space-y-4">
                <div className="bg-success/10 p-6 rounded-2xl border border-success/20 text-center">
                  <CheckCircle2 className="w-12 h-12 mx-auto text-success mb-3" />
                  <p className="text-sm text-muted-foreground mb-2">كود تفعيل الموظف:</p>
                  <p className="text-2xl font-mono font-bold text-primary tracking-widest">{newEmployeeCode}</p>
                </div>
                {newEmployeeData && (
                  <div className="bg-muted p-4 rounded-xl space-y-2 text-sm">
                    <p><span className="text-muted-foreground">الاسم:</span> <span className="font-bold text-foreground">{newEmployeeData.name}</span></p>
                    <p><span className="text-muted-foreground">الهاتف:</span> <span className="font-bold text-foreground">{newEmployeeData.phone}</span></p>
                    <p><span className="text-muted-foreground">النوع:</span> <span className="font-bold text-foreground">{getEmployeeTypeLabel(newEmployeeData.employee_type)}</span></p>
                  </div>
                )}
                <button onClick={async () => { await copyToClipboard(newEmployeeCode); }} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2"><Copy className="w-5 h-5" /> نسخ الكود</button>
                <button onClick={closeEmployeeModal} className="w-full py-3 bg-muted text-muted-foreground rounded-xl font-bold">إغلاق</button>
              </div>
            ) : (
              <form onSubmit={handleAddEmployee} className="space-y-4">
                <input name="name" required placeholder="اسم الموظف" className="w-full px-4 py-3 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-warning placeholder:text-muted-foreground" />
                <input name="phone" type="tel" inputMode="numeric" pattern="[0-9]*" required placeholder="رقم الهاتف" className="w-full px-4 py-3 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-warning placeholder:text-muted-foreground" />
                <select name="type" className="w-full px-4 py-3 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-warning">
                  <option value={EmployeeType.FIELD_AGENT}>موزع ميداني</option>
                  <option value={EmployeeType.WAREHOUSE_KEEPER}>أمين مستودع</option>
                </select>
                <button type="submit" className="w-full py-3 bg-warning text-warning-foreground rounded-xl font-bold">توليد كود التفعيل</button>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

/* ========== Sales Manager Dashboard Content ========== */
const SalesManagerDashboardContent: React.FC<{
  stats: any; customers: any[]; distributors: any[]; warehouseKeepers: any[]; sales: any[];
}> = ({ stats, customers, distributors, warehouseKeepers, sales }) => {
  const [discountStats, setDiscountStats] = React.useState({ total: 0, avgPct: 0, cashDisc: 0, creditDisc: 0 });

  React.useEffect(() => {
    const loadDiscounts = async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data } = await supabase.from('sales').select('discount_value, discount_percentage, payment_type, is_voided').eq('is_voided', false);
        if (data) {
          const withDiscount = data.filter(d => Number(d.discount_value || 0) > 0);
          const total = data.reduce((s, d) => s + Number(d.discount_value || 0), 0);
          const avgPct = withDiscount.length > 0 ? withDiscount.reduce((s, d) => s + Number(d.discount_percentage || 0), 0) / withDiscount.length : 0;
          const cashDisc = data.filter(d => d.payment_type === 'CASH').reduce((s, d) => s + Number(d.discount_value || 0), 0);
          const creditDisc = data.filter(d => d.payment_type === 'CREDIT').reduce((s, d) => s + Number(d.discount_value || 0), 0);
          setDiscountStats({ total, avgPct, cashDisc, creditDisc });
        }
      } catch {}
    };
    loadDiscounts();
  }, []);

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="grid grid-cols-2 gap-2">
        <GlassKPI icon={<FileText className="w-5 h-5 text-primary" />} label="مبيعات اليوم" value={stats.todayRevenue.toLocaleString()} subValue={CURRENCY} iconBgClass="bg-primary/10" />
        <GlassKPI icon={<Wallet className="w-5 h-5 text-success" />} label="التحصيلات" value={stats.totalCollections.toLocaleString()} subValue={CURRENCY} iconBgClass="bg-success/10" />
      </div>

      <GlassCard>
        <h3 className="font-bold text-foreground mb-3 text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-warning" /> تحليلات الخصومات
        </h3>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="bg-warning/10 p-3 rounded-xl text-center">
            <p className="text-lg font-black text-warning">{discountStats.total.toLocaleString()}</p>
            <p className="text-[8px] text-muted-foreground font-bold">إجمالي الخصومات</p>
          </div>
          <div className="bg-purple-500/10 p-3 rounded-xl text-center">
            <p className="text-lg font-black text-purple-600 dark:text-purple-400">{discountStats.avgPct.toFixed(1)}%</p>
            <p className="text-[8px] text-muted-foreground font-bold">متوسط نسبة الخصم</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-success/10 p-2.5 rounded-xl text-center">
            <p className="text-sm font-black text-success">{discountStats.cashDisc.toLocaleString()}</p>
            <p className="text-[8px] text-muted-foreground font-bold">خصومات نقدي</p>
          </div>
          <div className="bg-primary/10 p-2.5 rounded-xl text-center">
            <p className="text-sm font-black text-primary">{discountStats.creditDisc.toLocaleString()}</p>
            <p className="text-[8px] text-muted-foreground font-bold">خصومات آجل</p>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="font-bold text-foreground mb-3 text-sm">إحصائيات الفريق</h3>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-primary/10 p-3 rounded-xl text-center">
            <Users className="w-5 h-5 mx-auto text-primary mb-1" />
            <p className="text-lg font-black text-foreground">{distributors.length}</p>
            <p className="text-[8px] text-muted-foreground font-bold">الموزعين</p>
          </div>
          <div className="bg-purple-500/10 p-3 rounded-xl text-center">
            <WarehouseIcon className="w-5 h-5 mx-auto text-purple-600 dark:text-purple-400 mb-1" />
            <p className="text-lg font-black text-foreground">{warehouseKeepers.length}</p>
            <p className="text-[8px] text-muted-foreground font-bold">أمناء المستودع</p>
          </div>
          <div className="bg-warning/10 p-3 rounded-xl text-center">
            <FileText className="w-5 h-5 mx-auto text-warning mb-1" />
            <p className="text-lg font-black text-foreground">{stats.todaySalesCount}</p>
            <p className="text-[8px] text-muted-foreground font-bold">فواتير اليوم</p>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="font-bold text-foreground mb-3 text-sm">إحصائيات الزبائن</h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-success/10 p-3 rounded-xl text-center">
            <p className="text-lg font-black text-foreground">{customers.length}</p>
            <p className="text-[8px] text-muted-foreground font-bold">إجمالي الزبائن</p>
          </div>
          <div className="bg-destructive/10 p-3 rounded-xl text-center">
            <p className="text-lg font-black text-foreground">{customers.filter(c => c.balance > 0).length}</p>
            <p className="text-[8px] text-muted-foreground font-bold">ذمم مدينة</p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};

export default SalesManagerDashboard;
