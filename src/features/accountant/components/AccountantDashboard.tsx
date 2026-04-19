import React, { useState } from 'react';
import AnimatedTabContent from '@/components/ui/AnimatedTabContent';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  ShoppingCart,
  RotateCcw,
  Wallet,
  Users,
  BarChart3,
  LayoutDashboard,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { useAuth } from '@/store/AuthContext';
import { useTabPrefetch } from '@/hooks/useTabPrefetch';
import WelcomeSplash from '@/components/ui/WelcomeSplash';
import AccountantOverviewTab from './AccountantOverviewTab';
import SalesInvoicesTab from './SalesInvoicesTab';
import PurchasesTab from './PurchasesTab';
import SalesReturnsTab from './SalesReturnsTab';
import PurchaseReturnsTab from './PurchaseReturnsTab';
import CollectionsTab from './CollectionsTab';
import DebtsTab from './DebtsTab';
import ReportsTab from './ReportsTab';
import AccountantAlerts from './AccountantAlerts';
import {
  AppHeader,
  AppBottomNav,
  AppSettingsSheet,
  AppSubPageSheet,
  type BottomNavItem,
  type SettingsItem,
} from '@/components/shell';

type AccountantPrimaryTab = 'overview' | 'sales' | 'collections' | 'debts';
type AccountantSubPage = 'purchases' | 'sales-returns' | 'purchase-returns' | 'reports' | 'alerts';
type AccountantTabType = AccountantPrimaryTab | AccountantSubPage;

const AccountantDashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { logout, user } = useApp();
  const { organization, role } = useAuth();
  const [activeTab, setActiveTab] = useState<AccountantTabType>('overview');
  const [loggingOut, setLoggingOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [subPage, setSubPage] = useState<AccountantSubPage | null>(null);

  useTabPrefetch(activeTab as any, organization?.id, role);

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await logout(); } finally { setLoggingOut(false); }
  };

  const navItems: BottomNavItem<AccountantPrimaryTab>[] = [
    { id: 'overview',    label: t('accountant.tabs.overview'),    icon: LayoutDashboard },
    { id: 'sales',       label: t('accountant.tabs.sales'),       icon: FileText },
    { id: 'collections', label: t('accountant.tabs.collections'), icon: Wallet },
    { id: 'debts',       label: t('accountant.tabs.debts'),       icon: Users },
  ];

  const settingsItems: SettingsItem<AccountantSubPage>[] = [
    { id: 'purchases',        label: t('accountant.tabs.purchases'),        Icon: ShoppingCart, color: 'text-blue-600',    bg: 'bg-blue-500/10' },
    { id: 'sales-returns',    label: t('accountant.tabs.salesReturns'),     Icon: RotateCcw,    color: 'text-amber-600',   bg: 'bg-amber-500/10' },
    { id: 'purchase-returns', label: t('accountant.tabs.purchaseReturns'),  Icon: RotateCcw,    color: 'text-orange-600',  bg: 'bg-orange-500/10' },
    { id: 'reports',          label: t('accountant.tabs.reports'),          Icon: BarChart3,    color: 'text-indigo-600',  bg: 'bg-indigo-500/10' },
    { id: 'alerts',           label: t('accountant.tabs.alerts'),           Icon: AlertTriangle,color: 'text-rose-600',    bg: 'bg-rose-500/10' },
  ];

  const subPageTitle = (() => {
    const found = settingsItems.find(i => i.id === subPage);
    return found?.label ?? '';
  })();

  const renderPrimaryContent = () => {
    switch (activeTab) {
      case 'overview':    return <AccountantOverviewTab />;
      case 'sales':       return <SalesInvoicesTab />;
      case 'collections': return <CollectionsTab />;
      case 'debts':       return <DebtsTab />;
      default: return null;
    }
  };

  const renderSubPage = () => {
    switch (subPage) {
      case 'purchases':        return <PurchasesTab />;
      case 'sales-returns':    return <SalesReturnsTab />;
      case 'purchase-returns': return <PurchaseReturnsTab />;
      case 'reports':          return <ReportsTab />;
      case 'alerts':           return <AccountantAlerts />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-background" dir={isRtl ? 'rtl' : 'ltr'}>
      <AppHeader
        title={user?.name || t('roles.accountant')}
        subtitle={organization?.name || t('accountant.subtitle')}
        Icon={BarChart3}
      />

      <div className="max-w-lg mx-auto">
        <WelcomeSplash />

        <div
          className="px-3 pt-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
        >
          <AnimatedTabContent tabKey={activeTab}>{renderPrimaryContent()}</AnimatedTabContent>
        </div>
      </div>

      <AppBottomNav
        items={navItems}
        active={activeTab as any}
        onChange={(id) => setActiveTab(id as AccountantPrimaryTab)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <AppSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        items={settingsItems}
        onOpenItem={(id) => { setSettingsOpen(false); setSubPage(id); }}
        onLogout={handleLogout}
        loggingOut={loggingOut}
      />

      <AppSubPageSheet
        open={subPage !== null}
        onClose={() => setSubPage(null)}
        title={subPageTitle}
      >
        {renderSubPage()}
      </AppSubPageSheet>
    </div>
  );
};

export default AccountantDashboard;
