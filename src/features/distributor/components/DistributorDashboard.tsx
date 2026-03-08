import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { 
  FileText, RotateCcw, Wallet, Users, LogOut, UserPlus, X, User, Phone,
  MapPin, Check, Loader2, ChevronDown, Search, MessageCircle, Warehouse,
  History, ShoppingBag, Home, PieChart
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { supabase } from '@/integrations/supabase/client';
import AIAssistant from '@/features/ai/components/AIAssistant';
import WelcomeSplash from '@/components/ui/WelcomeSplash';
import NewSaleTab from './NewSaleTab';
import SalesReturnTab from './SalesReturnTab';
import CollectionTab from './CollectionTab';
import CustomerDebtsTab from './CustomerDebtsTab';
import DistributorInventoryTab from './DistributorInventoryTab';
import InvoiceHistoryTab from './InvoiceHistoryTab';
import OfflineSyncBanner from './OfflineSyncBanner';
import { useDistributorOffline } from '../hooks/useDistributorOffline';
import { Customer } from '@/types';
import { CURRENCY } from '@/constants';
import { DashboardHeader } from '@/components/ui/DashboardHeader';
import { BottomTabNav } from '@/components/ui/BottomTabNav';
import { GlassCard } from '@/components/ui/GlassCard';

type DistributorTabType = 'inventory' | 'new-sale' | 'returns' | 'collections' | 'debts' | 'history';
type BottomNavType = 'home' | 'sales' | 'finance' | 'history';

const DistributorDashboard: React.FC = () => {
  const { logout, addNotification, refreshAllData, organization, user: appUser } = useApp();
  const { t, i18n } = useTranslation();
  const offline = useDistributorOffline();
  const [activeTab, setActiveTab] = useState<DistributorTabType>('inventory');
  const [bottomNav, setBottomNav] = useState<BottomNavType>('home');
  const [loggingOut, setLoggingOut] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerLocation, setNewCustomerLocation] = useState('');
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchCustomer, setSearchCustomer] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) setCurrentUserId(session.user.id);
      } catch {}
    };
    getCurrentUser();
  }, []);

  React.useEffect(() => {
    if (['inventory'].includes(activeTab)) setBottomNav('home');
    else if (['new-sale', 'returns'].includes(activeTab)) setBottomNav('sales');
    else if (['collections', 'debts'].includes(activeTab)) setBottomNav('finance');
    else if (['history'].includes(activeTab)) setBottomNav('history');
  }, [activeTab]);

  const myCustomers = currentUserId
    ? offline.localCustomers.filter(c => c.created_by === currentUserId)
    : offline.localCustomers;
  const filteredCustomers = myCustomers.filter(c => c.name.toLowerCase().includes(searchCustomer.toLowerCase()));
  const totalDebt = myCustomers.reduce((sum, c) => sum + Number(c.balance), 0);
  const totalCustomers = myCustomers.length;

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await logout(); } finally { setLoggingOut(false); }
  };

  const handleAddCustomer = async () => {
    if (!newCustomerName.trim()) { addNotification('يرجى إدخال اسم الزبون', 'warning'); return; }
    if (!newCustomerPhone.trim()) { addNotification('يرجى إدخال رقم الهاتف', 'warning'); return; }
    if (!/^[0-9+\-\s]+$/.test(newCustomerPhone.trim())) { addNotification('رقم الهاتف غير صالح', 'warning'); return; }
    if (!newCustomerLocation.trim()) { addNotification('يرجى إدخال موقع الزبون', 'warning'); return; }
    setAddingCustomer(true);
    try {
      const newCustomer = await offline.addCustomerOffline(newCustomerName.trim(), newCustomerPhone.trim(), newCustomerLocation.trim());
      setNewCustomerName(''); setNewCustomerPhone(''); setNewCustomerLocation('');
      setShowAddCustomerModal(false);
      setSelectedCustomer({
        id: newCustomer.id, name: newCustomer.name, phone: newCustomer.phone || '', balance: 0,
        location: newCustomer.location || undefined, organization_id: newCustomer.organization_id,
        created_by: newCustomer.created_by || undefined,
      });
      addNotification(offline.isOnline ? 'تم إضافة الزبون بنجاح' : 'تم حفظ الزبون محلياً — ستتم المزامنة عند عودة الإنترنت', 'success');
    } catch (error: any) {
      console.error('Error adding customer:', error);
      addNotification(error?.message || 'فشل إضافة الزبون', 'error');
    } finally { setAddingCustomer(false); }
  };

  const handleBottomNavChange = (navId: string) => {
    setBottomNav(navId as BottomNavType);
    switch (navId) {
      case 'home': setActiveTab('inventory'); break;
      case 'sales': setActiveTab('new-sale'); break;
      case 'finance': setActiveTab('collections'); break;
      case 'history': setActiveTab('history'); break;
    }
  };

  const getSectionTabs = () => {
    switch (bottomNav) {
      case 'sales': return [
        { id: 'new-sale', label: t('distributor.newInvoice'), icon: <FileText className="w-4 h-4" />, bgColor: 'bg-primary' },
        { id: 'returns', label: t('distributor.salesReturn'), icon: <RotateCcw className="w-4 h-4" />, bgColor: 'bg-warning' },
      ];
      case 'finance': return [
        { id: 'collections', label: t('distributor.collection'), icon: <Wallet className="w-4 h-4" />, bgColor: 'bg-emerald-600' },
        { id: 'debts', label: t('distributor.debts'), icon: <Users className="w-4 h-4" />, bgColor: 'bg-destructive' },
      ];
      default: return null;
    }
  };

  const sectionTabs = getSectionTabs();

  const renderTabContent = () => {
    switch (activeTab) {
      case 'inventory': return <DistributorInventoryTab localInventory={offline.localInventory} onQueueAction={offline.queueAction} isOnline={offline.isOnline} />;
      case 'new-sale': return <NewSaleTab selectedCustomer={selectedCustomer} localInventory={offline.localInventory} onQueueAction={offline.queueAction} isOnline={offline.isOnline} />;
      case 'returns': return <SalesReturnTab selectedCustomer={selectedCustomer} onQueueAction={offline.queueAction} isOnline={offline.isOnline} localSales={offline.localSales} />;
      case 'collections': return <CollectionTab selectedCustomer={selectedCustomer} onQueueAction={offline.queueAction} isOnline={offline.isOnline} localSales={offline.localSales} />;
      case 'debts': return <CustomerDebtsTab selectedCustomer={selectedCustomer} myCustomers={myCustomers} localSales={offline.localSales} />;
      case 'history': return <InvoiceHistoryTab isOnline={offline.isOnline} />;
      default: return null;
    }
  };

  const bottomTabs = [
    { id: 'home', label: 'المخزون', icon: <Warehouse className="w-5 h-5" /> },
    { id: 'sales', label: 'المبيعات', icon: <FileText className="w-5 h-5" /> },
    { id: 'finance', label: 'المالية', icon: <Wallet className="w-5 h-5" /> },
    { id: 'history', label: 'السجل', icon: <History className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-background has-bottom-nav" dir="rtl">
      <div className="max-w-lg mx-auto">
        <DashboardHeader
          userName="لوحة الموزع"
          subtitle="إدارة المبيعات الميدانية"
          icon={<ShoppingBag className="w-4 h-4 text-primary-foreground" />}
          iconBgClass="bg-primary"
          onLogout={handleLogout}
          loggingOut={loggingOut}
          rightActions={
            <button onClick={() => setShowAddCustomerModal(true)}
              className="p-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-all" title="إضافة زبون جديد">
              <UserPlus className="w-4 h-4" />
            </button>
          }
        />

        {/* Customer Selector */}
        <div className="px-4 pb-3">
          <GlassCard className="!p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground text-xs font-bold">الزبون المحدد للعمليات</span>
              {selectedCustomer && (
                <button onClick={() => setSelectedCustomer(null)} className="text-xs text-destructive hover:text-destructive/80 font-bold">إلغاء</button>
              )}
            </div>
            <button onClick={() => setShowCustomerPicker(true)}
              className="w-full flex items-center justify-between bg-muted/50 rounded-xl px-4 py-3 hover:bg-accent transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${selectedCustomer ? 'bg-primary/10 text-primary' : 'bg-border text-muted-foreground'}`}>
                  <User className="w-4 h-4" />
                </div>
                <div className="text-start">
                  {selectedCustomer ? (
                    <>
                      <p className="font-bold text-foreground text-sm">{selectedCustomer.name}</p>
                      <p className="text-xs text-muted-foreground">الرصيد: {Number(selectedCustomer.balance).toLocaleString('ar-SA')} {CURRENCY}</p>
                    </>
                  ) : (
                    <p className="text-muted-foreground font-medium text-sm">اختر زبون من القائمة</p>
                  )}
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>
          </GlassCard>
        </div>

        <WelcomeSplash />

        {/* Offline Sync Banner */}
        <div className="px-4 pb-2">
          <OfflineSyncBanner
            isOnline={offline.isOnline} pendingCount={offline.pendingCount}
            failedCount={offline.failedCount} isSyncing={offline.isSyncing}
            lastSyncMessage={offline.lastSyncMessage} actions={offline.actions}
            onTriggerSync={offline.triggerSync} onRetryAction={offline.retrySingleAction}
            onRetryAllFailed={offline.retryAllFailed}
          />
        </div>

        {sectionTabs && (
          <div className="px-4 pb-3">
            <div className="glass-section-tabs">
              {sectionTabs.map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as DistributorTabType)}
                  className={`glass-section-tab ${activeTab === tab.id ? `glass-section-tab-active ${tab.bgColor}` : 'glass-section-tab-inactive'}`}>
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

      {/* Customer Picker Modal */}
      {showCustomerPicker && createPortal(
        <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-md flex items-center justify-center p-6 safe-area-x safe-area-bottom" dir="rtl" onClick={() => setShowCustomerPicker(false)}>
          <div className="bg-card w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-border" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-border bg-muted/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-lg text-foreground">اختر الزبون</h3>
                <button onClick={() => setShowCustomerPicker(false)} className="p-2 hover:bg-accent rounded-xl transition-colors">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              <button onClick={() => { setShowCustomerPicker(false); setShowAddCustomerModal(true); }}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl flex items-center justify-center gap-2 font-bold mb-4 hover:opacity-90 transition-colors">
                <UserPlus className="w-5 h-5" /> إضافة زبون جديد
              </button>
              <div className="relative">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input type="text" placeholder="بحث..." value={searchCustomer} onChange={(e) => setSearchCustomer(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-12 py-3 font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground" />
              </div>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-4 space-y-2">
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <User className="w-16 h-16 mx-auto mb-3 opacity-30" />
                  <p className="font-bold">لا يوجد زبائن</p>
                  <p className="text-sm mt-1">قم بإضافة زبون جديد للبدء</p>
                </div>
              ) : (
                filteredCustomers.map((customer) => (
                  <button key={customer.id}
                    onClick={() => { setSelectedCustomer(customer); setShowCustomerPicker(false); setSearchCustomer(''); }}
                    className={`w-full text-start p-4 rounded-2xl transition-colors ${
                      selectedCustomer?.id === customer.id ? 'bg-primary/10 border-2 border-primary' : 'bg-muted/50 hover:bg-accent'
                    }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        selectedCustomer?.id === customer.id ? 'bg-primary text-primary-foreground' : 'bg-border text-muted-foreground'
                      }`}>
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{customer.name}</p>
                        <p className="text-sm text-muted-foreground">الرصيد: {Number(customer.balance).toLocaleString('ar-SA')} {CURRENCY}</p>
                      </div>
                      {selectedCustomer?.id === customer.id && <Check className="w-5 h-5 text-primary mr-auto" />}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add Customer Modal */}
      {showAddCustomerModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-md flex items-center justify-center p-6 safe-area-x safe-area-bottom" dir="rtl" onClick={() => setShowAddCustomerModal(false)}>
          <div className="bg-card w-full max-w-md rounded-2xl p-6 space-y-5 shadow-2xl border border-border" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-black text-lg text-foreground flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" /> إضافة زبون جديد
              </h3>
              <button onClick={() => setShowAddCustomerModal(false)} className="p-2 hover:bg-accent rounded-xl transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input type="text" placeholder="اسم الزبون" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)}
                  className="w-full bg-muted text-foreground rounded-xl px-12 py-3 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground" />
              </div>
              <div className="relative">
                <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input type="tel" inputMode="numeric" placeholder="رقم الهاتف" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)}
                  className="w-full bg-muted text-foreground rounded-xl px-12 py-3 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground" />
              </div>
              <div className="relative">
                <MapPin className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input type="text" placeholder="الموقع / العنوان" value={newCustomerLocation} onChange={(e) => setNewCustomerLocation(e.target.value)}
                  className="w-full bg-muted text-foreground rounded-xl px-12 py-3 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground" />
              </div>
              <button onClick={handleAddCustomer} disabled={addingCustomer}
                className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50">
                {addingCustomer ? <Loader2 className="w-5 h-5 animate-spin" /> : <><UserPlus className="w-5 h-5" /> إضافة الزبون</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default DistributorDashboard;
