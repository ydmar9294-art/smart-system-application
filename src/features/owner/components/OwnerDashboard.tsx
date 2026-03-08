import React, { useState, useMemo } from 'react';
import DeletionRequestsManager from '@/features/shared/components/DeletionRequestsManager';
import { createPortal } from 'react-dom';
import { copyToClipboard } from '@/lib/clipboard';
import { useTranslation } from 'react-i18next';
import { 
  FileText, Package, Users, TrendingUp, LogOut, LayoutDashboard,
  Receipt, Wallet, UserPlus, X, Copy, CheckCircle2, Clock,
  ShieldCheck, MessageCircle, AlertTriangle, Phone, MapPin,
  CircleDollarSign, Shield, UserX, UserCheck, Loader2,
  BarChart3, CreditCard, Banknote, Database
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

type OwnerTabType = 'daily' | 'team' | 'customers' | 'finance' | 'performance' | 'subscription' | 'legal' | 'backup';

const OwnerDashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { 
    user, sales = [], payments = [], customers = [], users = [],
    products = [], logout, addDistributor, pendingEmployees = [],
    deactivateEmployee, reactivateEmployee, organization
  } = useApp();
  
  const [activeTab, setActiveTab] = useState<OwnerTabType>('daily');
  const [loggingOut, setLoggingOut] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [newEmployeeCode, setNewEmployeeCode] = useState<string | null>(null);
  const [newEmployeeData, setNewEmployeeData] = useState<any | null>(null);
  const [togglingEmployee, setTogglingEmployee] = useState<string | null>(null);

  React.useEffect(() => { setIsMounted(true); }, []);

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
      case EmployeeType.SALES_MANAGER: return t('owner.salesManagerType');
      case EmployeeType.ACCOUNTANT: return t('owner.accountantType');
      case EmployeeType.FIELD_AGENT: return t('owner.fieldAgentType');
      case EmployeeType.WAREHOUSE_KEEPER: return t('owner.warehouseKeeperType');
      default: return type;
    }
  };

  const myPendingEmployees = pendingEmployees.filter(pe => !pe.is_used);
  const myActivatedEmployees = pendingEmployees.filter(pe => pe.is_used);

  const primaryTabs: { id: OwnerTabType; label: string; icon: React.ReactNode; color: string; bgColor: string }[] = [
    { id: 'daily', label: t('owner.tabs.home'), icon: <LayoutDashboard className="w-5 h-5" />, color: 'text-emerald-600', bgColor: 'bg-emerald-600' },
    { id: 'team', label: t('owner.tabs.team'), icon: <Users className="w-5 h-5" />, color: 'text-blue-600', bgColor: 'bg-blue-600' },
    { id: 'customers', label: t('owner.tabs.customers'), icon: <CircleDollarSign className="w-5 h-5" />, color: 'text-purple-600', bgColor: 'bg-purple-600' },
    { id: 'finance', label: t('owner.tabs.finance'), icon: <TrendingUp className="w-5 h-5" />, color: 'text-red-500', bgColor: 'bg-red-500' },
    { id: 'performance', label: t('owner.tabs.performance'), icon: <BarChart3 className="w-5 h-5" />, color: 'text-indigo-600', bgColor: 'bg-indigo-600' },
  ];

  const secondaryTabs: { id: OwnerTabType; label: string; icon: React.ReactNode }[] = [
    { id: 'backup', label: t('owner.tabs.backup'), icon: <Database className="w-4 h-4" /> },
    { id: 'subscription', label: t('owner.tabs.subscription'), icon: <Shield className="w-4 h-4" /> },
    { id: 'legal', label: t('owner.tabs.legal'), icon: <ShieldCheck className="w-4 h-4" /> },
  ];

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

  return (
    <div className="min-h-screen bg-background" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="bg-background pt-4 px-4 relative">
          <div className={`absolute -top-1 ${isRtl ? 'left-1' : 'right-1'} z-10`}><NotificationCenter /></div>

          <div className="flex justify-center pt-4 mb-3">
            <div className="flex items-center gap-3 bg-card px-4 py-2 rounded-full shadow-sm">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className={isRtl ? 'text-end' : 'text-start'}>
                <p className="font-bold text-foreground text-sm">{user?.name || t('roles.owner')}</p>
                <p className="text-[10px] text-muted-foreground">{t('owner.dashboard')}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5 bg-card/80 backdrop-blur-sm px-2 py-1.5 rounded-xl shadow-sm">
              <AIAssistant className="!p-1.5 !rounded-lg" />
              <div className="w-px h-5 bg-border" />
              <a href="https://wa.me/963947744162" target="_blank" rel="noopener noreferrer"
                className="p-1.5 bg-gradient-to-br from-green-400 to-green-600 rounded-lg text-white hover:shadow-md transition-all active:scale-95" title={t('common.supportTeam')}>
                <MessageCircle className="w-4 h-4" />
              </a>
            </div>
            <button onClick={handleLogout} disabled={loggingOut}
              className="p-2.5 bg-card/80 backdrop-blur-sm rounded-full shadow-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all" title={t('common.logout')}>
              <LogOut className={`w-5 h-5 ${loggingOut ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <WelcomeSplash />

        {/* Primary Tab Navigation */}
        <div className="px-4 pb-2">
          <div className="bg-card rounded-3xl p-2 shadow-sm flex gap-1">
            {primaryTabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl transition-all duration-300 ${
                  activeTab === tab.id ? `${tab.bgColor} text-white shadow-lg` : 'text-muted-foreground hover:bg-muted'
                }`}>
                <div className={`${activeTab === tab.id ? 'scale-110' : ''} transition-transform duration-300`}>{tab.icon}</div>
                <span className="text-[10px] font-bold">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Tabs */}
        <div className="px-4 pb-4">
          <div className="flex gap-2">
            {secondaryTabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition-all ${
                  activeTab === tab.id
                    ? 'bg-warning text-white shadow-md'
                    : 'bg-card text-muted-foreground hover:bg-muted shadow-sm'
                }`}>
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="px-4 pb-8">
          <div className="animate-fade-in">
            {renderTabContent()}
          </div>
        </div>
      </div>

      {/* Add Employee Modal */}
      {showAddUserModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-md flex items-center justify-center p-6 safe-area-x safe-area-bottom" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-card rounded-2xl w-full max-w-md p-6 space-y-4 animate-zoom-in shadow-2xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-foreground">
                {newEmployeeCode ? t('owner.activationCodeCreated') : t('owner.addEmployee')}
              </h2>
              <button onClick={closeEmployeeModal} className="p-2 bg-muted rounded-full hover:bg-accent">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            
            {newEmployeeCode ? (
              <div className="space-y-4">
                <div className="bg-success/10 p-6 rounded-2xl border border-success/20 text-center">
                  <CheckCircle2 className="w-12 h-12 mx-auto text-success mb-3" />
                  <p className="text-sm text-muted-foreground mb-2">{t('owner.employeeActivationCode')}</p>
                  <p className="text-2xl font-mono font-bold text-primary tracking-widest">{newEmployeeCode}</p>
                </div>
                
                {newEmployeeData && (
                  <div className="bg-muted p-4 rounded-xl space-y-2 text-sm">
                    <p><span className="text-muted-foreground">{t('common.name')}:</span> <span className="font-bold text-foreground">{newEmployeeData.name}</span></p>
                    <p><span className="text-muted-foreground">{t('common.phone')}:</span> <span className="font-bold text-foreground">{newEmployeeData.phone}</span></p>
                    <p><span className="text-muted-foreground">{t('owner.employeeType')}:</span> <span className="font-bold text-foreground">{getEmployeeTypeLabel(newEmployeeData.employee_type)}</span></p>
                  </div>
                )}
                
                <button onClick={async () => { await copyToClipboard(newEmployeeCode); }}
                  className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2">
                  <Copy className="w-5 h-5" /> {t('owner.copyCode')}
                </button>
                <button onClick={closeEmployeeModal} className="w-full py-3 bg-muted text-muted-foreground rounded-xl font-bold">{t('common.close')}</button>
              </div>
            ) : (
              <form onSubmit={handleAddEmployee} className="space-y-4">
                <input name="name" required placeholder={t('owner.employeeName')} 
                  className="w-full px-4 py-3 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground" />
                <input name="phone" type="tel" inputMode="numeric" pattern="[0-9]*" required placeholder={t('owner.employeePhone')} 
                  className="w-full px-4 py-3 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground" />
                <select name="type" className="w-full px-4 py-3 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-primary">
                  <option value={EmployeeType.SALES_MANAGER}>{t('owner.salesManagerType')}</option>
                  <option value={EmployeeType.ACCOUNTANT}>{t('owner.accountantType')}</option>
                </select>
                <button type="submit" className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold">{t('owner.generateCode')}</button>
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
}> = ({ stats, sales, products, customers, activeEmployeeCount, maxEmployees }) => {
  const { t } = useTranslation();
  return (
  <div className="space-y-3">
    <div className="p-4 rounded-2xl bg-card shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
          <Receipt className="w-4 h-4 text-primary" />
        </div>
        <span className="text-xs font-bold text-foreground">{t('owner.todaySales')}</span>
      </div>
      <p className="text-2xl font-black text-foreground mb-2">{stats.todayRevenue.toLocaleString()} <span className="text-xs font-medium text-muted-foreground">{CURRENCY}</span></p>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-emerald-500/10 p-2.5 rounded-xl flex items-center gap-2">
          <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-[8px] text-muted-foreground font-bold">{t('owner.cashLabel')}</p>
            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{stats.todayCash.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-amber-500/10 p-2.5 rounded-xl flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-[8px] text-muted-foreground font-bold">{t('owner.creditLabel')}</p>
            <p className="text-sm font-black text-amber-600 dark:text-amber-400">{stats.todayCredit.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>

    <div className="p-4 rounded-2xl bg-card shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <span className="text-xs font-bold text-foreground">{t('owner.totalSales')}</span>
      </div>
      <p className="text-2xl font-black text-foreground mb-2">{stats.totalAllSales.toLocaleString()} <span className="text-xs font-medium text-muted-foreground">{CURRENCY}</span></p>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-emerald-500/10 p-2.5 rounded-xl flex items-center gap-2">
          <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-[8px] text-muted-foreground font-bold">{t('owner.cashLabel')}</p>
            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{stats.totalCashSales.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-amber-500/10 p-2.5 rounded-xl flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-[8px] text-muted-foreground font-bold">{t('owner.creditLabel')}</p>
            <p className="text-sm font-black text-amber-600 dark:text-amber-400">{stats.totalCreditSales.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-2">
      <div className="p-3 rounded-2xl bg-card shadow-sm">
        <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mb-1" />
        <p className="text-[9px] text-muted-foreground font-bold">{t('owner.todayCollections')}</p>
        <p className="text-lg font-black text-foreground">{stats.totalCollections.toLocaleString()}</p>
        <p className="text-[10px] text-muted-foreground">{CURRENCY}</p>
      </div>
      <div className="p-3 rounded-2xl bg-card shadow-sm">
        <Users className="w-5 h-5 text-primary mb-1" />
        <p className="text-[9px] text-muted-foreground font-bold">{t('owner.totalEmployees')}</p>
        <p className="text-lg font-black text-foreground">{activeEmployeeCount}</p>
        <p className="text-[10px] text-muted-foreground">{t('debts.from')} {maxEmployees}</p>
      </div>
    </div>

    <div className="p-4 rounded-2xl bg-card shadow-sm">
      <h3 className="font-bold text-foreground mb-3 text-sm">{t('owner.quickStats')}</h3>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-primary/5 p-3 rounded-xl text-center">
          <FileText className="w-5 h-5 mx-auto text-primary mb-1" />
          <p className="text-lg font-black text-foreground">{sales.filter(s => s.timestamp >= new Date().setHours(0,0,0,0) && !s.isVoided).length}</p>
          <p className="text-[8px] text-muted-foreground font-bold">{t('salesManager.invoiceCount')}</p>
        </div>
        <div className="bg-destructive/5 p-3 rounded-xl text-center">
          <AlertTriangle className="w-5 h-5 mx-auto text-destructive mb-1" />
          <p className="text-lg font-black text-foreground">{products.filter(p => p.stock <= p.minStock && !p.isDeleted).length}</p>
          <p className="text-[8px] text-muted-foreground font-bold">{t('warehouse.lowStockProducts')}</p>
        </div>
        <div className="bg-purple-500/5 p-3 rounded-xl text-center">
          <Users className="w-5 h-5 mx-auto text-purple-600 dark:text-purple-400 mb-1" />
          <p className="text-lg font-black text-foreground">{customers.length}</p>
          <p className="text-[8px] text-muted-foreground font-bold">{t('owner.totalCustomers')}</p>
        </div>
        <div className="bg-orange-500/5 p-3 rounded-xl text-center">
          <Package className="w-5 h-5 mx-auto text-orange-600 dark:text-orange-400 mb-1" />
          <p className="text-lg font-black text-foreground">{products.filter(p => !p.isDeleted).length}</p>
          <p className="text-[8px] text-muted-foreground font-bold">{t('owner.totalProducts')}</p>
        </div>
      </div>
    </div>

    {products.filter(p => p.stock <= p.minStock && !p.isDeleted).length > 0 && (
      <div className="p-4 rounded-2xl bg-card shadow-sm border-r-4 border-destructive">
        <h3 className="font-bold text-foreground mb-3 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" /> {t('warehouse.lowStockProducts')}
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
      </div>
    )}
  </div>
);
};

/* ========== Team Content ========== */
const TeamContent: React.FC<any> = ({
  teamMembers, organization, activeEmployeeCount, maxEmployees, remainingSlots, usagePercent,
  showAddUserModal, setShowAddUserModal, myPendingEmployees, myActivatedEmployees,
  copiedId, setCopiedId, togglingEmployee, handleToggleEmployee, getEmployeeTypeLabel
}) => {
  const { t } = useTranslation();
  return (
  <div className="space-y-4">
    <div className="p-4 rounded-2xl bg-card shadow-sm">
      <h3 className="font-bold text-foreground text-sm mb-3 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-primary" /> {t('owner.tabs.team')}
      </h3>
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{t('common.name')}</span>
          <span className="font-bold text-foreground">{organization?.name || '—'}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{t('owner.totalEmployees')}</span>
          <span className="font-bold text-foreground">{activeEmployeeCount} / {maxEmployees}</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2 mt-1">
          <div className={`h-2 rounded-full transition-all ${usagePercent >= 100 ? 'bg-destructive' : usagePercent >= 80 ? 'bg-warning' : 'bg-primary'}`}
            style={{ width: `${Math.min(100, usagePercent)}%` }} />
        </div>
      </div>
    </div>

    <button onClick={() => setShowAddUserModal(true)} disabled={remainingSlots <= 0}
      className={`w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all ${
        remainingSlots <= 0 ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary text-primary-foreground'
      }`}>
      <UserPlus className="w-5 h-5" /> {t('owner.addEmployee')}
    </button>
    
    {myPendingEmployees.length > 0 && (
      <div className="space-y-2">
        <h3 className="font-bold text-foreground text-sm flex items-center gap-2 px-2">
          <Clock className="w-4 h-4 text-warning" /> {t('owner.pendingCodes')}
        </h3>
        {myPendingEmployees.map((pe: any) => (
          <div key={pe.id} className="bg-warning/10 p-4 rounded-2xl border border-warning/20">
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
              className="bg-card p-3 rounded-xl flex justify-between items-center cursor-pointer hover:bg-muted transition-colors">
              <span className="font-mono font-bold text-primary tracking-wider">{pe.activation_code}</span>
              {copiedId === pe.id ? <CheckCircle2 className="w-5 h-5 text-success" /> : <Copy className="w-5 h-5 text-muted-foreground" />}
            </div>
          </div>
        ))}
      </div>
    )}

    {myActivatedEmployees.length > 0 && (
      <div className="space-y-2">
        <h3 className="font-bold text-foreground text-sm flex items-center gap-2 px-2">
          <CheckCircle2 className="w-4 h-4 text-success" /> {t('owner.activatedCodes')}
        </h3>
        {myActivatedEmployees.map((pe: any) => (
          <div key={pe.id} className="bg-success/10 p-4 rounded-2xl border border-success/20">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-bold text-foreground">{pe.name}</p>
                <p className="text-xs text-muted-foreground">{pe.phone}</p>
              </div>
              <span className="bg-success/15 text-success px-2 py-1 rounded-lg text-xs font-bold">{t('owner.activated')}</span>
            </div>
            <div className="bg-card p-3 rounded-xl">
              <span className="font-mono text-muted-foreground text-xs line-through">{pe.activation_code}</span>
              {pe.activated_at && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {t('owner.activatedAt')} {new Date(pe.activated_at).toLocaleDateString(isRtl ? 'ar-SY' : 'en-US')}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    )}

    <div className="space-y-3">
      {teamMembers.length === 0 && myPendingEmployees.length === 0 ? (
        <div className="p-8 rounded-3xl text-center bg-card shadow-sm">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground font-medium">{t('owner.noEmployees')}</p>
        </div>
      ) : (
        teamMembers.map((u: any) => {
          const isActive = u.isActive !== false;
          const canManage = u.employeeType === 'SALES_MANAGER' || u.employeeType === 'ACCOUNTANT';
          return (
            <div key={u.id} className={`p-4 rounded-2xl bg-card shadow-sm ${!isActive ? 'opacity-60' : ''}`}>
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
                  {isActive ? t('common.active') : t('common.inactive')}
                </span>
              </div>
              {canManage && (
                <button onClick={() => handleToggleEmployee(u.id, isActive)} disabled={togglingEmployee === u.id}
                  className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                    isActive ? 'bg-destructive/10 text-destructive hover:bg-destructive/20' : 'bg-success/10 text-success hover:bg-success/20'
                  }`}>
                  {togglingEmployee === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> :
                    isActive ? <><UserX className="w-4 h-4" /> {t('owner.deactivateEmployee')}</> : <><UserCheck className="w-4 h-4" /> {t('owner.reactivateEmployee')}</>}
                </button>
              )}
            </div>
          );
        })
      )}
    </div>

    <div className="p-4 rounded-2xl bg-card shadow-sm">
      <h3 className="font-bold text-foreground mb-3 text-sm flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-destructive" /> {t('owner.deletionRequests')}
      </h3>
      <DeletionRequestsManager />
    </div>
  </div>
);
};

export default OwnerDashboard;
