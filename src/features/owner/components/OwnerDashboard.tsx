import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import DeletionRequestsManager from '@/features/shared/components/DeletionRequestsManager';
import { createPortal } from 'react-dom';
import { copyToClipboard } from '@/lib/clipboard';
import { 
  FileText, Package, Users, TrendingUp, LogOut, LayoutDashboard,
  Receipt, Wallet, UserPlus, X, Copy, CheckCircle2, Clock,
  ShieldCheck, MessageCircle, AlertTriangle, Phone, MapPin,
  CircleDollarSign, Shield, UserX, UserCheck, Loader2,
  BarChart3, CreditCard, Banknote, Database, Home, PieChart, Settings
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { CURRENCY } from '@/constants';
import { UserRole, EmployeeType, PaymentType } from '@/types';
import { InventoryTab } from './InventoryTab';
import { FinanceTab } from './FinanceTab';
import { NotificationCenter } from '@/features/notifications/components/NotificationCenter';
import AIAssistant from '@/features/ai/components/AIAssistant';
import WelcomeSplash from '@/components/ui/WelcomeSplash';
import LegalInfoTab from './LegalInfoTab';
import CustomersTab from './CustomersTab';
import OrgDeletionRequest from './OrgDeletionRequest';
import SubscriptionTab from './SubscriptionTab';
import { PerformanceTab } from './PerformanceTab';
import BackupTab from './BackupTab';
import { DashboardHeader } from '@/components/ui/DashboardHeader';
import { BottomTabNav } from '@/components/ui/BottomTabNav';
import { GlassCard, GlassKPI } from '@/components/ui/GlassCard';

type OwnerTabType = 'daily' | 'team' | 'customers' | 'finance' | 'performance' | 'subscription' | 'legal' | 'backup';

// Bottom nav maps to tab groups
type BottomNavType = 'home' | 'operations' | 'reports' | 'settings';

const OwnerDashboard: React.FC = () => {
  const { 
    user, sales = [], payments = [], customers = [], users = [],
    products = [], logout, addDistributor, pendingEmployees = [],
    deactivateEmployee, reactivateEmployee, organization
  } = useApp();
  
  const { t, i18n } = useTranslation();
  const [bottomNav, setBottomNav] = useState<BottomNavType>('home');
  const [loggingOut, setLoggingOut] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newEmployeeCode, setNewEmployeeCode] = useState<string | null>(null);
  const [newEmployeeData, setNewEmployeeData] = useState<any | null>(null);
  const [togglingEmployee, setTogglingEmployee] = useState<string | null>(null);

  React.useEffect(() => {
    // Sync bottom nav with active tab
    if (['daily'].includes(activeTab)) setBottomNav('home');
    else if (['team', 'customers'].includes(activeTab)) setBottomNav('operations');
    else if (['finance', 'performance'].includes(activeTab)) setBottomNav('reports');
    else if (['subscription', 'legal', 'backup'].includes(activeTab)) setBottomNav('settings');
  }, [activeTab]);

  const stats = useMemo(() => {
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const todaySales = sales.filter(s => s.timestamp >= todayStart && !s.isVoided);
    const todayRevenue = todaySales.reduce((s, i) => s + i.grandTotal, 0);
    const todayCash = todaySales.filter(s => s.paymentType === PaymentType.CASH).reduce((s, i) => s + i.grandTotal, 0);
    const todayCredit = todaySales.filter(s => s.paymentType === PaymentType.CREDIT).reduce((s, i) => s + i.grandTotal, 0);
    const totalCollections = payments.filter(c => c.timestamp >= todayStart && !c.isReversed).reduce((s, i) => s + i.amount, 0);
    const allValidSales = sales.filter(s => !s.isVoided);
    const totalAllSales = allValidSales.reduce((s, i) => s + i.grandTotal, 0);
    const totalCashSales = allValidSales.filter(s => s.paymentType === PaymentType.CASH).reduce((s, i) => s + i.grandTotal, 0);
    const totalCreditSales = allValidSales.filter(s => s.paymentType === PaymentType.CREDIT).reduce((s, i) => s + i.grandTotal, 0);
    return { todayRevenue, todayCash, todayCredit, totalCollections, totalAllSales, totalCashSales, totalCreditSales };
  }, [sales, payments]);

  const teamMembers = users.filter(u => u.role === UserRole.EMPLOYEE);
  const activeEmployeeCount = teamMembers.filter(u => u.isActive !== false).length;
  
  const [licenseInfo, setLicenseInfo] = React.useState<{ maxEmployees: number; type: string; status: string; expiryDate?: string } | null>(null);
  
  React.useEffect(() => {
    const fetchLicense = async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data } = await supabase.rpc('get_my_license_info');
        const license = data?.[0];
        if (license) setLicenseInfo({ maxEmployees: license.max_employees, type: license.type, status: license.status, expiryDate: license.expiry_date ?? undefined });
      } catch {}
    };
    fetchLicense();
  }, []);
  
  const maxEmployees = licenseInfo?.maxEmployees ?? 10;
  const remainingSlots = Math.max(0, maxEmployees - activeEmployeeCount);
  const usagePercent = maxEmployees > 0 ? (activeEmployeeCount / maxEmployees) * 100 : 0;

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await logout(); } finally { setLoggingOut(false); }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const result = await addDistributor(fd.get('name') as string, fd.get('phone') as string, UserRole.EMPLOYEE, fd.get('type') as EmployeeType);
    if (result.code) { setNewEmployeeCode(result.code); setNewEmployeeData(result.employee); }
  };

  const closeEmployeeModal = () => { setShowAddUserModal(false); setNewEmployeeCode(null); setNewEmployeeData(null); };

  const handleToggleEmployee = async (employeeId: string, isActive: boolean) => {
    setTogglingEmployee(employeeId);
    try {
      if (isActive) await deactivateEmployee(employeeId);
      else await reactivateEmployee(employeeId);
    } finally { setTogglingEmployee(null); }
  };

  const getEmployeeTypeLabel = (type: EmployeeType) => {
    switch (type) {
      case EmployeeType.SALES_MANAGER: return 'مدير مبيعات';
      case EmployeeType.ACCOUNTANT: return 'محاسب';
      case EmployeeType.FIELD_AGENT: return 'موزع ميداني';
      case EmployeeType.WAREHOUSE_KEEPER: return 'أمين مستودع';
      default: return type;
    }
  };

  const myPendingEmployees = pendingEmployees.filter(pe => !pe.is_used);
  const myActivatedEmployees = pendingEmployees.filter(pe => pe.is_used);

  const handleBottomNavChange = (navId: string) => {
    setBottomNav(navId as BottomNavType);
    switch (navId) {
      case 'home': setActiveTab('daily'); break;
      case 'operations': setActiveTab('team'); break;
      case 'reports': setActiveTab('finance'); break;
      case 'settings': setActiveTab('subscription'); break;
    }
  };

  // Section tabs for each bottom nav section
  const getSectionTabs = () => {
    switch (bottomNav) {
      case 'home': return null;
      case 'operations': return [
        { id: 'team', label: 'الفريق', icon: <Users className="w-4 h-4" />, bgColor: 'bg-blue-600' },
        { id: 'customers', label: 'الزبائن', icon: <CircleDollarSign className="w-4 h-4" />, bgColor: 'bg-purple-600' },
      ];
      case 'reports': return [
        { id: 'finance', label: 'المالية', icon: <TrendingUp className="w-4 h-4" />, bgColor: 'bg-red-500' },
        { id: 'performance', label: 'الأداء', icon: <BarChart3 className="w-4 h-4" />, bgColor: 'bg-indigo-600' },
      ];
      case 'settings': return [
        { id: 'subscription', label: 'الاشتراك', icon: <Shield className="w-4 h-4" />, bgColor: 'bg-primary' },
        { id: 'legal', label: 'القانونية', icon: <ShieldCheck className="w-4 h-4" />, bgColor: 'bg-amber-600' },
        { id: 'backup', label: 'النسخ', icon: <Database className="w-4 h-4" />, bgColor: 'bg-emerald-600' },
      ];
      default: return null;
    }
  };

  const sectionTabs = getSectionTabs();

  const renderTabContent = () => {
    switch (activeTab) {
      case 'daily': return <DailyContent stats={stats} sales={sales} products={products} customers={customers} activeEmployeeCount={activeEmployeeCount} maxEmployees={maxEmployees} />;
      case 'team': return <TeamContent
        teamMembers={teamMembers} organization={organization} activeEmployeeCount={activeEmployeeCount}
        maxEmployees={maxEmployees} remainingSlots={remainingSlots} usagePercent={usagePercent}
        showAddUserModal={showAddUserModal} setShowAddUserModal={setShowAddUserModal}
        myPendingEmployees={myPendingEmployees} myActivatedEmployees={myActivatedEmployees}
        copiedId={copiedId} setCopiedId={setCopiedId} togglingEmployee={togglingEmployee}
        handleToggleEmployee={handleToggleEmployee} getEmployeeTypeLabel={getEmployeeTypeLabel}
      />;
      case 'customers': return <CustomersTab />;
      case 'finance': return <FinanceTab />;
      case 'performance': return <PerformanceTab />;
      case 'subscription': return <SubscriptionTab />;
      case 'legal': return <><LegalInfoTab /><OrgDeletionRequest /></>;
      case 'backup': return <BackupTab />;
      default: return null;
    }
  };

  const bottomTabs = [
    { id: 'home', label: 'الرئيسية', icon: <Home className="w-5 h-5" /> },
    { id: 'operations', label: 'العمليات', icon: <Users className="w-5 h-5" /> },
    { id: 'reports', label: 'التقارير', icon: <PieChart className="w-5 h-5" /> },
    { id: 'settings', label: 'الإعدادات', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-background has-bottom-nav" dir="rtl">
      <div className="max-w-lg mx-auto">
        <DashboardHeader
          userName={user?.name || 'المالك'}
          subtitle="لوحة الإدارة"
          icon={<ShieldCheck className="w-4 h-4 text-primary-foreground" />}
          iconBgClass="bg-primary"
          onLogout={handleLogout}
          loggingOut={loggingOut}
        />

        <WelcomeSplash />

        {/* Section Tabs (when bottom nav has sub-tabs) */}
        {sectionTabs && (
          <div className="px-4 pb-3">
            <div className="glass-section-tabs">
              {sectionTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as OwnerTabType)}
                  className={`glass-section-tab ${
                    activeTab === tab.id
                      ? `glass-section-tab-active ${tab.bgColor}`
                      : 'glass-section-tab-inactive'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="px-4 pb-4">
          <div className="animate-fade-in">
            {renderTabContent()}
          </div>
        </div>
      </div>

      <BottomTabNav tabs={bottomTabs} activeTab={bottomNav} onTabChange={handleBottomNavChange} />

      {/* Add Employee Modal */}
      {showAddUserModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-md flex items-center justify-center p-6 safe-area-x safe-area-bottom" dir="rtl">
          <div className="bg-card rounded-2xl w-full max-w-md p-6 space-y-4 animate-zoom-in shadow-2xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-foreground">
                {newEmployeeCode ? 'تم إنشاء كود التفعيل' : 'إضافة موظف جديد'}
              </h2>
              <button onClick={closeEmployeeModal} className="p-2 bg-muted rounded-full hover:bg-accent">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            
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
                
                <button onClick={async () => { await copyToClipboard(newEmployeeCode); }}
                  className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2">
                  <Copy className="w-5 h-5" /> نسخ الكود
                </button>
                <button onClick={closeEmployeeModal} className="w-full py-3 bg-muted text-muted-foreground rounded-xl font-bold">إغلاق</button>
              </div>
            ) : (
              <form onSubmit={handleAddEmployee} className="space-y-4">
                <input name="name" required placeholder="اسم الموظف" 
                  className="w-full px-4 py-3 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground" />
                <input name="phone" type="tel" inputMode="numeric" pattern="[0-9]*" required placeholder="رقم الهاتف" 
                  className="w-full px-4 py-3 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground" />
                <select name="type" className="w-full px-4 py-3 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-primary">
                  <option value={EmployeeType.SALES_MANAGER}>مدير مبيعات</option>
                  <option value={EmployeeType.ACCOUNTANT}>محاسب مالي</option>
                </select>
                <button type="submit" className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold">توليد كود التفعيل</button>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

/* ========== Daily Content ========== */
const DailyContent: React.FC<{
  stats: any; sales: any[]; products: any[]; customers: any[];
  activeEmployeeCount: number; maxEmployees: number;
}> = ({ stats, sales, products, customers, activeEmployeeCount, maxEmployees }) => (
  <div className="space-y-3">
    {/* Hero KPI */}
    <GlassCard className="!p-5" glow>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
          <Receipt className="w-4 h-4 text-primary" />
        </div>
        <span className="text-xs font-black text-foreground">مبيعات اليوم</span>
      </div>
      <p className="text-3xl font-black text-foreground mb-3">{stats.todayRevenue.toLocaleString()} <span className="text-xs font-medium text-muted-foreground">{CURRENCY}</span></p>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-success/10 p-2.5 rounded-xl flex items-center gap-2">
          <Banknote className="w-4 h-4 text-success" />
          <div>
            <p className="text-[8px] text-muted-foreground font-bold">نقدي</p>
            <p className="text-sm font-black text-success">{stats.todayCash.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-warning/10 p-2.5 rounded-xl flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-warning" />
          <div>
            <p className="text-[8px] text-muted-foreground font-bold">آجل</p>
            <p className="text-sm font-black text-warning">{stats.todayCredit.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </GlassCard>

    {/* Total Sales */}
    <GlassCard>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-primary" />
        </div>
        <span className="text-xs font-black text-foreground">إجمالي المبيعات</span>
      </div>
      <p className="text-2xl font-black text-foreground mb-2">{stats.totalAllSales.toLocaleString()} <span className="text-xs font-medium text-muted-foreground">{CURRENCY}</span></p>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-success/10 p-2.5 rounded-xl flex items-center gap-2">
          <Banknote className="w-4 h-4 text-success" />
          <div>
            <p className="text-[8px] text-muted-foreground font-bold">نقدي</p>
            <p className="text-sm font-black text-success">{stats.totalCashSales.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-warning/10 p-2.5 rounded-xl flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-warning" />
          <div>
            <p className="text-[8px] text-muted-foreground font-bold">آجل</p>
            <p className="text-sm font-black text-warning">{stats.totalCreditSales.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </GlassCard>

    {/* Quick Stats Grid */}
    <div className="grid grid-cols-2 gap-2">
      <GlassKPI icon={<Wallet className="w-5 h-5 text-success" />} label="تحصيلات اليوم" value={stats.totalCollections.toLocaleString()} subValue={CURRENCY} iconBgClass="bg-success/10" />
      <GlassKPI icon={<Users className="w-5 h-5 text-primary" />} label="الموظفين" value={activeEmployeeCount} subValue={`من ${maxEmployees}`} iconBgClass="bg-primary/10" />
    </div>

    {/* System Summary */}
    <GlassCard>
      <h3 className="font-bold text-foreground mb-3 text-sm">ملخص النظام</h3>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-primary/5 p-3 rounded-xl text-center">
          <FileText className="w-5 h-5 mx-auto text-primary mb-1" />
          <p className="text-lg font-black text-foreground">{sales.filter(s => s.timestamp >= new Date().setHours(0,0,0,0) && !s.isVoided).length}</p>
          <p className="text-[8px] text-muted-foreground font-bold">فواتير اليوم</p>
        </div>
        <div className="bg-destructive/5 p-3 rounded-xl text-center">
          <AlertTriangle className="w-5 h-5 mx-auto text-destructive mb-1" />
          <p className="text-lg font-black text-foreground">{products.filter(p => p.stock <= p.minStock && !p.isDeleted).length}</p>
          <p className="text-[8px] text-muted-foreground font-bold">مواد منخفضة</p>
        </div>
        <div className="bg-purple-500/5 p-3 rounded-xl text-center">
          <Users className="w-5 h-5 mx-auto text-purple-600 dark:text-purple-400 mb-1" />
          <p className="text-lg font-black text-foreground">{customers.length}</p>
          <p className="text-[8px] text-muted-foreground font-bold">إجمالي الزبائن</p>
        </div>
        <div className="bg-warning/5 p-3 rounded-xl text-center">
          <Package className="w-5 h-5 mx-auto text-warning mb-1" />
          <p className="text-lg font-black text-foreground">{products.filter(p => !p.isDeleted).length}</p>
          <p className="text-[8px] text-muted-foreground font-bold">المنتجات</p>
        </div>
      </div>
    </GlassCard>

    {/* Low Stock Warning */}
    {products.filter(p => p.stock <= p.minStock && !p.isDeleted).length > 0 && (
      <GlassCard accentColor="hsl(0, 84%, 60%)">
        <h3 className="font-bold text-foreground mb-3 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" /> منتجات قاربت على النفاد
        </h3>
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {products.filter(p => p.stock <= p.minStock && !p.isDeleted).slice(0, 5).map(p => (
            <div key={p.id} className="flex justify-between items-center bg-destructive/5 p-2 rounded-lg">
              <span className="font-bold text-xs text-foreground">{p.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-destructive font-black">{p.stock}</span>
                <span className="text-[8px] text-muted-foreground">/ {p.minStock}</span>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    )}
  </div>
);

/* ========== Team Content ========== */
const TeamContent: React.FC<any> = ({
  teamMembers, organization, activeEmployeeCount, maxEmployees, remainingSlots, usagePercent,
  showAddUserModal, setShowAddUserModal, myPendingEmployees, myActivatedEmployees,
  copiedId, setCopiedId, togglingEmployee, handleToggleEmployee, getEmployeeTypeLabel
}) => (
  <div className="space-y-4">
    <GlassCard>
      <h3 className="font-bold text-foreground text-sm mb-3 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-primary" /> حالة المنشأة
      </h3>
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">اسم المنشأة</span>
          <span className="font-bold text-foreground">{organization?.name || '—'}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">الموظفون / الحد</span>
          <span className="font-bold text-foreground">{activeEmployeeCount} / {maxEmployees}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">الأماكن المتبقية</span>
          <span className={`font-bold ${remainingSlots <= 1 ? 'text-destructive' : 'text-foreground'}`}>{remainingSlots}</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2 mt-1">
          <div className={`h-2 rounded-full transition-all ${usagePercent >= 100 ? 'bg-destructive' : usagePercent >= 80 ? 'bg-warning' : 'bg-primary'}`}
            style={{ width: `${Math.min(100, usagePercent)}%` }} />
        </div>
        {usagePercent >= 100 && (
          <p className="text-[10px] text-destructive font-bold flex items-center gap-1 mt-1">
            <AlertTriangle className="w-3 h-3" /> تم الوصول للحد الأقصى
          </p>
        )}
      </div>
    </GlassCard>

    <button onClick={() => setShowAddUserModal(true)} disabled={remainingSlots <= 0}
      className={`w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all ${
        remainingSlots <= 0 ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary text-primary-foreground'
      }`}>
      <UserPlus className="w-5 h-5" /> إضافة موظف
    </button>
    
    {myPendingEmployees.length > 0 && (
      <div className="space-y-2">
        <h3 className="font-bold text-foreground text-sm flex items-center gap-2 px-2">
          <Clock className="w-4 h-4 text-warning" /> أكواد تفعيل معلقة
        </h3>
        {myPendingEmployees.map((pe: any) => (
          <GlassCard key={pe.id} className="!border-warning/20">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-bold text-foreground">{pe.name}</p>
                <p className="text-xs text-muted-foreground">{pe.phone}</p>
              </div>
              <span className="bg-warning/15 text-warning px-2 py-1 rounded-lg text-xs font-bold">
                {getEmployeeTypeLabel(pe.employee_type)}
              </span>
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
        {myActivatedEmployees.map((pe: any) => (
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
              {pe.activated_at && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  تم التفعيل: {new Date(pe.activated_at).toLocaleDateString('ar-SY')}
                </p>
              )}
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
        teamMembers.map((u: any) => {
          const isActive = u.isActive !== false;
          const canManage = u.employeeType === 'SALES_MANAGER' || u.employeeType === 'ACCOUNTANT';
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
              {canManage && (
                <button onClick={() => handleToggleEmployee(u.id, isActive)} disabled={togglingEmployee === u.id}
                  className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                    isActive ? 'bg-destructive/10 text-destructive hover:bg-destructive/20' : 'bg-success/10 text-success hover:bg-success/20'
                  }`}>
                  {togglingEmployee === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> :
                    isActive ? <><UserX className="w-4 h-4" /> إيقاف الموظف</> : <><UserCheck className="w-4 h-4" /> إعادة التنشيط</>}
                </button>
              )}
            </GlassCard>
          );
        })
      )}
    </div>

    <GlassCard>
      <h3 className="font-bold text-foreground mb-3 text-sm flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-destructive" /> طلبات حذف الحسابات
      </h3>
      <DeletionRequestsManager />
    </GlassCard>
  </div>
);

export default OwnerDashboard;
