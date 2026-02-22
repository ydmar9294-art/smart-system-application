import React, { useState } from 'react';
import { 
  FileText, 
  ShoppingCart, 
  RotateCcw, 
  Wallet, 
  Users,
  BarChart3,
  LogOut,
  MessageCircle
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import WelcomeSplash from '@/components/ui/WelcomeSplash';
import AIAssistant from '@/components/ai/AIAssistant';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import SalesInvoicesTab from './SalesInvoicesTab';
import PurchasesTab from './PurchasesTab';
import SalesReturnsTab from './SalesReturnsTab';
import PurchaseReturnsTab from './PurchaseReturnsTab';
import CollectionsTab from './CollectionsTab';
import DebtsTab from './DebtsTab';
import ReportsTab from './ReportsTab';

type AccountantTabType = 'sales' | 'purchases' | 'sales-returns' | 'purchase-returns' | 'collections' | 'debts' | 'reports';

const AccountantDashboard: React.FC = () => {
  const { logout } = useApp();
  const [activeTab, setActiveTab] = useState<AccountantTabType>('sales');
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await logout(); } finally { setLoggingOut(false); }
  };

  const tabs: { id: AccountantTabType; label: string; icon: React.ReactNode; color: string; bgColor: string }[] = [
    { id: 'sales', label: 'المبيعات', icon: <FileText className="w-5 h-5" />, color: 'text-emerald-600', bgColor: 'bg-emerald-600' },
    { id: 'purchases', label: 'المشتريات', icon: <ShoppingCart className="w-5 h-5" />, color: 'text-blue-600', bgColor: 'bg-blue-600' },
    { id: 'collections', label: 'التحصيلات', icon: <Wallet className="w-5 h-5" />, color: 'text-purple-600', bgColor: 'bg-purple-600' },
    { id: 'debts', label: 'الديون', icon: <Users className="w-5 h-5" />, color: 'text-red-500', bgColor: 'bg-red-500' },
    { id: 'reports', label: 'التقارير', icon: <BarChart3 className="w-5 h-5" />, color: 'text-indigo-600', bgColor: 'bg-indigo-600' },
  ];

  const secondaryTabs: { id: AccountantTabType; label: string; icon: React.ReactNode }[] = [
    { id: 'sales-returns', label: 'مرتجع بيع', icon: <RotateCcw className="w-4 h-4" /> },
    { id: 'purchase-returns', label: 'مرتجع شراء', icon: <RotateCcw className="w-4 h-4" /> },
  ];

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

  const isSecondaryActive = activeTab === 'sales-returns' || activeTab === 'purchase-returns';

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="bg-background pt-4 px-4 relative">
          <div className="absolute -top-1 left-1 z-10"><NotificationCenter /></div>

          <div className="flex justify-center pt-4 mb-3">
            <div className="flex items-center gap-3 bg-card px-4 py-2 rounded-full shadow-sm">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              <div className="text-end">
                <p className="font-bold text-foreground text-sm">لوحة المحاسب</p>
                <p className="text-[10px] text-muted-foreground">إدارة العمليات المالية</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5 bg-card/80 backdrop-blur-sm px-2 py-1.5 rounded-xl shadow-sm">
              <AIAssistant className="!p-1.5 !rounded-lg" />
              <div className="w-px h-5 bg-border" />
              <a href="https://wa.me/963947744162" target="_blank" rel="noopener noreferrer"
                className="p-1.5 bg-gradient-to-br from-green-400 to-green-600 rounded-lg text-white hover:shadow-md transition-all active:scale-95" title="فريق الدعم">
                <MessageCircle className="w-4 h-4" />
              </a>
            </div>
            <button onClick={handleLogout} disabled={loggingOut}
              className="p-2.5 bg-card/80 backdrop-blur-sm rounded-full shadow-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all" title="تسجيل الخروج">
              <LogOut className={`w-5 h-5 ${loggingOut ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <WelcomeSplash />

        {/* Primary Tab Navigation */}
        <div className="px-4 pb-2">
          <div className="bg-card rounded-3xl p-2 shadow-sm flex gap-1">
            {tabs.map((tab) => (
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

        {/* Secondary Tabs (Returns) */}
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
    </div>
  );
};

export default AccountantDashboard;