import React, { useState, useMemo } from 'react';
import AnimatedTabContent from '@/components/ui/AnimatedTabContent';
import DeletionRequestsManager from '@/features/shared/components/DeletionRequestsManager';
import { createPortal } from 'react-dom';
import { copyToClipboard } from '@/lib/clipboard';
import { useTranslation } from 'react-i18next';
import {
  FileText, Package, Users, TrendingUp, LayoutDashboard,
  Receipt, Wallet, UserPlus, X, Copy, CheckCircle2, Clock,
  ShieldCheck, AlertTriangle,
  CircleDollarSign, UserX, UserCheck, Loader2,
  CreditCard, Banknote,
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { useAuth } from '@/store/AuthContext';
import { useTabPrefetch } from '@/hooks/useTabPrefetch';
import { CURRENCY } from '@/constants';
import { UserRole, EmployeeType, PaymentType } from '@/types';
import { FinanceTab } from './FinanceTab';
import WelcomeSplash from '@/components/ui/WelcomeSplash';
import LegalInfoTab from './LegalInfoTab';
import CustomersTab from './CustomersTab';
import OrgDeletionRequest from './OrgDeletionRequest';
import SubscriptionTab from './SubscriptionTab';
import BackupTab from './BackupTab';
import { OwnerOverviewTab } from './OwnerOverviewTab';
import CurrenciesTab from './CurrenciesTab';
import OwnerCompactHeader from './OwnerCompactHeader';
import OwnerBottomNav, { OwnerNavTab } from './OwnerBottomNav';
import OwnerSettingsSheet, { SettingsSubPage } from './OwnerSettingsSheet';
import OwnerSubPageSheet from './OwnerSubPageSheet';
import FinanceWithPerformance from './FinanceWithPerformance';

const AgentMapView = React.lazy(() => import('@/features/tracking/components/AgentMapView'));

const OwnerDashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const {
    user, sales = [], payments = [], customers = [], users = [],
    products = [], logout, addDistributor, pendingEmployees = [],
    deactivateEmployee, reactivateEmployee, organization
  } = useApp();

  const { role: authRole, organization: authOrg } = useAuth();
  const [activeTab, setActiveTab] = useState<OwnerNavTab>('overview');
  useTabPrefetch(activeTab as any, authOrg?.id, authRole);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newEmployeeCode, setNewEmployeeCode] = useState<string | null>(null);
  const [newEmployeeData, setNewEmployeeData] = useState<any | null>(null);
  const [togglingEmployee, setTogglingEmployee] = useState<string | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [subPage, setSubPage] = useState<SettingsSubPage>(null);

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
      case EmployeeType.ACCOUNTANT: return t('owner.accountantType');
      case EmployeeType.FIELD_AGENT: return t('owner.fieldAgentType');
      case EmployeeType.WAREHOUSE_KEEPER: return t('owner.warehouseKeeperType');
      default: return type;
    }
  };

  const myPendingEmployees = pendingEmployees.filter(pe => !pe.is_used);
  const myActivatedEmployees = pendingEmployees.filter(pe => pe.is_used);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': return <OwnerOverviewTab />;
      case 'team': return <TeamContent
        teamMembers={teamMembers} organization={organization} activeEmployeeCount={activeEmployeeCount}
        maxEmployees={maxEmployees} remainingSlots={remainingSlots} usagePercent={usagePercent}
        showAddUserModal={showAddUserModal} setShowAddUserModal={setShowAddUserModal}
        myPendingEmployees={myPendingEmployees} myActivatedEmployees={myActivatedEmployees}
        copiedId={copiedId} setCopiedId={setCopiedId} togglingEmployee={togglingEmployee}
        handleToggleEmployee={handleToggleEmployee} getEmployeeTypeLabel={getEmployeeTypeLabel}
      />;
      case 'customers': return <CustomersTab />;
      case 'finance': return <FinanceWithPerformance />;
      default: return null;
    }
  };

  const subPageTitle = (() => {
    switch (subPage) {
      case 'subscription': return t('owner.tabs.subscription');
      case 'backup':       return t('owner.tabs.backup');
      case 'currencies':   return 'العملات والصرف';
      case 'tracking':     return t('tracking.tab');
      case 'legal':        return t('owner.tabs.legal');
      default: return '';
    }
  })();

  const renderSubPage = () => {
    switch (subPage) {
      case 'subscription': return <SubscriptionTab />;
      case 'backup':       return <BackupTab />;
      case 'currencies':   return <CurrenciesTab />;
      case 'legal':        return <><LegalInfoTab /><OrgDeletionRequest /></>;
      case 'tracking':
        return (
          <React.Suspense fallback={<div className="animate-pulse bg-card h-96 rounded-2xl" />}>
            <AgentMapView />
          </React.Suspense>
        );
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-background" dir={isRtl ? 'rtl' : 'ltr'}>
      <OwnerCompactHeader userName={user?.name} orgName={organization?.name} />

      <div className="max-w-lg mx-auto">
        <WelcomeSplash />

        {/* Content */}
        <div
          className="px-3 pt-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
        >
          <AnimatedTabContent tabKey={activeTab}>
            {renderTabContent()}
          </AnimatedTabContent>
        </div>
      </div>

      {/* Bottom Nav */}
      <OwnerBottomNav
        active={activeTab}
        onChange={setActiveTab}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Settings Sheet */}
      <OwnerSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenSubPage={(page) => { setSettingsOpen(false); setSubPage(page); }}
        onLogout={handleLogout}
        loggingOut={loggingOut}
      />

      {/* Sub-page sheets */}
      <OwnerSubPageSheet
        open={subPage !== null}
        onClose={() => setSubPage(null)}
        title={subPageTitle}
      >
        {renderSubPage()}
      </OwnerSubPageSheet>

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
                <select name="type" defaultValue={EmployeeType.ACCOUNTANT} className="w-full px-4 py-3 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-primary">
                  <option value={EmployeeType.ACCOUNTANT}>{t('owner.accountantType')}</option>
                  <option value={EmployeeType.FIELD_AGENT}>{t('owner.fieldAgentType')}</option>
                  <option value={EmployeeType.WAREHOUSE_KEEPER}>{t('owner.warehouseKeeperType')}</option>
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

/* ========== Team Content ========== */
const TeamContent: React.FC<any> = ({
  teamMembers, organization, activeEmployeeCount, maxEmployees, remainingSlots, usagePercent,
  setShowAddUserModal, myPendingEmployees, myActivatedEmployees,
  copiedId, setCopiedId, togglingEmployee, handleToggleEmployee, getEmployeeTypeLabel
}) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
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
