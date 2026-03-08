import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  FileText, ShoppingCart, RotateCcw, Wallet, Users,
  BarChart3, LogOut, MessageCircle, Home, PieChart, Settings
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import WelcomeSplash from '@/components/ui/WelcomeSplash';
import AIAssistant from '@/features/ai/components/AIAssistant';
import SalesInvoicesTab from './SalesInvoicesTab';
import PurchasesTab from './PurchasesTab';
import SalesReturnsTab from './SalesReturnsTab';
import PurchaseReturnsTab from './PurchaseReturnsTab';
import CollectionsTab from './CollectionsTab';
import DebtsTab from './DebtsTab';
import ReportsTab from './ReportsTab';
import { DashboardHeader } from '@/components/ui/DashboardHeader';
import { BottomTabNav } from '@/components/ui/BottomTabNav';

type AccountantTabType = 'sales' | 'purchases' | 'sales-returns' | 'purchase-returns' | 'collections' | 'debts' | 'reports';
type BottomNavType = 'home' | 'operations' | 'reports' | 'returns';

const AccountantDashboard: React.FC = () => {
  const { logout } = useApp();
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<AccountantTabType>('sales');
  const [bottomNav, setBottomNav] = useState<BottomNavType>('home');
  const [loggingOut, setLoggingOut] = useState(false);

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
        { id: 'sales', label: 'المبيعات', icon: <FileText className="w-4 h-4" />, bgColor: 'bg-emerald-600' },
        { id: 'purchases', label: 'المشتريات', icon: <ShoppingCart className="w-4 h-4" />, bgColor: 'bg-primary' },
      ];
      case 'operations': return [
        { id: 'collections', label: 'التحصيلات', icon: <Wallet className="w-4 h-4" />, bgColor: 'bg-purple-600' },
        { id: 'debts', label: 'الديون', icon: <Users className="w-4 h-4" />, bgColor: 'bg-destructive' },
      ];
      case 'returns': return [
        { id: 'sales-returns', label: 'مرتجع بيع', icon: <RotateCcw className="w-4 h-4" />, bgColor: 'bg-warning' },
        { id: 'purchase-returns', label: 'مرتجع شراء', icon: <RotateCcw className="w-4 h-4" />, bgColor: 'bg-warning' },
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
    { id: 'home', label: 'الرئيسية', icon: <Home className="w-5 h-5" /> },
    { id: 'operations', label: 'العمليات', icon: <Wallet className="w-5 h-5" /> },
    { id: 'reports', label: 'التقارير', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'returns', label: 'المرتجعات', icon: <RotateCcw className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-background has-bottom-nav" dir="rtl">
      <div className="max-w-lg mx-auto">
        <DashboardHeader
          userName="لوحة المحاسب"
          subtitle="إدارة العمليات المالية"
          icon={<BarChart3 className="w-4 h-4 text-primary-foreground" />}
          iconBgClass="bg-primary"
          onLogout={handleLogout}
          loggingOut={loggingOut}
        />

        <WelcomeSplash />

        {sectionTabs && (
          <div className="px-4 pb-3">
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
          </div>
        )}

        <div className="px-4 pb-4">
          <div className="animate-fade-in">
            {renderTabContent()}
          </div>
        </div>
      </div>

      <BottomTabNav tabs={bottomTabs} activeTab={bottomNav} onTabChange={handleBottomNavChange} />
    </div>
  );
};

export default AccountantDashboard;
