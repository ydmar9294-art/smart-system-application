import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  FileText, ShoppingCart, RotateCcw, Wallet, Users,
  BarChart3, Home
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import WelcomeSplash from '@/components/ui/WelcomeSplash';
import SalesInvoicesTab from './SalesInvoicesTab';
import PurchasesTab from './PurchasesTab';
import SalesReturnsTab from './SalesReturnsTab';
import PurchaseReturnsTab from './PurchaseReturnsTab';
import CollectionsTab from './CollectionsTab';
import DebtsTab from './DebtsTab';
import ReportsTab from './ReportsTab';
import { DashboardHeader } from '@/components/ui/DashboardHeader';
import { BottomTabNav } from '@/components/ui/BottomTabNav';
import { motion, AnimatePresence } from 'motion/react';

type AccountantTabType = 'sales' | 'purchases' | 'sales-returns' | 'purchase-returns' | 'collections' | 'debts' | 'reports';
type BottomNavType = 'home' | 'operations' | 'reports' | 'returns';

const AccountantDashboard: React.FC = () => {
  const { logout } = useApp();
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<AccountantTabType>('sales');
  const [bottomNav, setBottomNav] = useState<BottomNavType>('home');
  React.useEffect(() => {
    if (['sales', 'purchases'].includes(activeTab)) setBottomNav('home');
    else if (['collections', 'debts'].includes(activeTab)) setBottomNav('operations');
    else if (['reports'].includes(activeTab)) setBottomNav('reports');
    else if (['sales-returns', 'purchase-returns'].includes(activeTab)) setBottomNav('returns');
  }, [activeTab]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await logout(); } finally { setLoggingOut(false); }
  };

  const handleBottomNavChange = (navId: string) => {
    setBottomNav(navId as BottomNavType);
    switch (navId) {
      case 'home': setActiveTab('sales'); break;
      case 'operations': setActiveTab('collections'); break;
      case 'reports': setActiveTab('reports'); break;
      case 'returns': setActiveTab('sales-returns'); break;
    }
  };

  const getSectionTabs = () => {
    switch (bottomNav) {
      case 'home': return [
        { id: 'sales', label: t('accountant.salesInvoices'), icon: <FileText className="w-4 h-4" strokeWidth={1.5} />, bgColor: 'bg-emerald-600' },
        { id: 'purchases', label: t('accountant.purchases'), icon: <ShoppingCart className="w-4 h-4" strokeWidth={1.5} />, bgColor: 'bg-primary' },
      ];
      case 'operations': return [
        { id: 'collections', label: t('accountant.collections'), icon: <Wallet className="w-4 h-4" strokeWidth={1.5} />, bgColor: 'bg-purple-600' },
        { id: 'debts', label: t('accountant.debts'), icon: <Users className="w-4 h-4" strokeWidth={1.5} />, bgColor: 'bg-destructive' },
      ];
      case 'returns': return [
        { id: 'sales-returns', label: t('accountant.salesReturns'), icon: <RotateCcw className="w-4 h-4" strokeWidth={1.5} />, bgColor: 'bg-warning' },
        { id: 'purchase-returns', label: t('accountant.purchaseReturns'), icon: <RotateCcw className="w-4 h-4" strokeWidth={1.5} />, bgColor: 'bg-warning' },
      ];
      default: return null;
    }
  };

  const sectionTabs = getSectionTabs();

  const renderTabContent = () => {
    switch (activeTab) {
      case 'sales': return <SalesInvoicesTab />;
      case 'purchases': return <PurchasesTab />;
      case 'sales-returns': return <SalesReturnsTab />;
      case 'purchase-returns': return <PurchaseReturnsTab />;
      case 'collections': return <CollectionsTab />;
      case 'debts': return <DebtsTab />;
      case 'reports': return <ReportsTab />;
      default: return null;
    }
  };

  const bottomTabs = [
    { id: 'home', label: t('nav.home'), icon: <Home className="w-5 h-5" strokeWidth={1.5} /> },
    { id: 'operations', label: t('nav.operations'), icon: <Wallet className="w-5 h-5" strokeWidth={1.5} /> },
    { id: 'reports', label: t('nav.reports'), icon: <BarChart3 className="w-5 h-5" strokeWidth={1.5} /> },
    { id: 'returns', label: t('nav.returns'), icon: <RotateCcw className="w-5 h-5" strokeWidth={1.5} /> },
  ];

  return (
    <div className="min-h-screen bg-background has-bottom-nav" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-lg mx-auto">
        <DashboardHeader
          userName={t('accountant.title')}
          subtitle={t('accountant.subtitle')}
          icon={<BarChart3 className="w-4 h-4 text-primary-foreground" strokeWidth={1.5} />}
          iconBgClass="bg-primary"
          onLogout={handleLogout}
          loggingOut={loggingOut}
        />

        <WelcomeSplash />

        {/* Section tabs with motion */}
        {sectionTabs && (
          <motion.div
            className="px-4 pb-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            <div className="glass-section-tabs">
              {sectionTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as AccountantTabType)}
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
          </motion.div>
        )}

        {/* Animated tab content */}
        <div className="px-4 pb-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.99 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <BottomTabNav tabs={bottomTabs} activeTab={bottomNav} onTabChange={handleBottomNavChange} />
    </div>
  );
};

export default AccountantDashboard;
