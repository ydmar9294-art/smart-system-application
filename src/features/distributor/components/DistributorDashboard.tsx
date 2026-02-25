import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  RotateCcw, 
  Wallet, 
  Users,
  LogOut,
  UserPlus,
  X,
  User,
  Phone,
  MapPin,
  Check,
  Loader2,
  ChevronDown,
  Search,
  MessageCircle,
  Warehouse,
  History,
  ShoppingBag,
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { supabase } from '@/integrations/supabase/client';
import AIAssistant from '@/features/ai/components/AIAssistant';
import WelcomeSplash from '@/components/ui/WelcomeSplash';
import { NotificationCenter } from '@/features/notifications/components/NotificationCenter';
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

type DistributorTabType = 'inventory' | 'new-sale' | 'returns' | 'collections' | 'debts' | 'history';

const DistributorDashboard: React.FC = () => {
  const { logout, addNotification, refreshAllData, organization, user: appUser } = useApp();
  const offline = useDistributorOffline();
  const [activeTab, setActiveTab] = useState<DistributorTabType>('inventory');
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
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    getCurrentUser();
  }, []);

  // Use offline-first cached customers instead of network-dependent customers from context
  const myCustomers = offline.localCustomers.filter(c => c.created_by === currentUserId);
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
      const orgId = organization?.id;
      if (!orgId || !currentUserId) {
        addNotification('لا يمكن إضافة زبون — بيانات المنشأة غير متاحة', 'error');
        return;
      }

      // Use offline-first customer add (works offline with temp ID)
      const newCustomer = await offline.addCustomerOffline(
        newCustomerName.trim(),
        newCustomerPhone.trim(),
        newCustomerLocation.trim(),
        orgId,
        currentUserId
      );

      setNewCustomerName(''); setNewCustomerPhone(''); setNewCustomerLocation('');
      setShowAddCustomerModal(false);
      
      // Auto-select the new customer
      setSelectedCustomer({
        id: newCustomer.id,
        name: newCustomer.name,
        phone: newCustomer.phone || '',
        balance: 0,
        location: newCustomer.location || undefined,
        organization_id: newCustomer.organization_id,
        created_by: newCustomer.created_by || undefined,
      });

      addNotification(
        offline.isOnline ? 'تم إضافة الزبون بنجاح' : 'تم حفظ الزبون محلياً — ستتم المزامنة عند عودة الإنترنت',
        'success'
      );
    } catch (error) { console.error('Error adding customer:', error); }
    finally { setAddingCustomer(false); }
  };

  const primaryTabs: { id: DistributorTabType; label: string; icon: React.ReactNode; bgColor: string }[] = [
    { id: 'inventory', label: 'مخزني', icon: <Warehouse className="w-5 h-5" />, bgColor: 'bg-purple-600' },
    { id: 'new-sale', label: 'فاتورة', icon: <FileText className="w-5 h-5" />, bgColor: 'bg-blue-600' },
    { id: 'collections', label: 'تحصيل', icon: <Wallet className="w-5 h-5" />, bgColor: 'bg-emerald-600' },
    { id: 'debts', label: 'الزبائن', icon: <Users className="w-5 h-5" />, bgColor: 'bg-red-500' },
    { id: 'history', label: 'السجل', icon: <History className="w-5 h-5" />, bgColor: 'bg-indigo-600' },
  ];

  const secondaryTabs: { id: DistributorTabType; label: string; icon: React.ReactNode }[] = [
    { id: 'returns', label: 'مرتجع بيع', icon: <RotateCcw className="w-4 h-4" /> },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'inventory': return <DistributorInventoryTab localInventory={offline.localInventory} onQueueAction={offline.queueAction} isOnline={offline.isOnline} />;
      case 'new-sale': return <NewSaleTab selectedCustomer={selectedCustomer} localInventory={offline.localInventory} onQueueAction={offline.queueAction} isOnline={offline.isOnline} />;
      case 'returns': return <SalesReturnTab selectedCustomer={selectedCustomer} onQueueAction={offline.queueAction} isOnline={offline.isOnline} localSales={offline.localSales} />;
      case 'collections': return <CollectionTab selectedCustomer={selectedCustomer} onQueueAction={offline.queueAction} isOnline={offline.isOnline} localSales={offline.localSales} />;
      case 'debts': return <CustomerDebtsTab selectedCustomer={selectedCustomer} myCustomers={myCustomers} />;
      case 'history': return <InvoiceHistoryTab isOnline={offline.isOnline} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="max-w-lg mx-auto">
        {/* Header - mirrors AccountantDashboard */}
        <div className="bg-background pt-4 px-4 relative">
          <div className="absolute -top-1 left-1 z-10">
            <NotificationCenter />
          </div>

          <div className="flex justify-center pt-4 mb-3">
            <div className="flex items-center gap-3 bg-card px-4 py-2 rounded-full shadow-sm">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-white" />
              </div>
              <div className="text-end">
                <p className="font-bold text-foreground text-sm">لوحة الموزع</p>
                <p className="text-[10px] text-muted-foreground">إدارة المبيعات الميدانية</p>
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

            <div className="flex items-center gap-2">
              <button onClick={() => setShowAddCustomerModal(true)}
                className="p-2 bg-blue-600/10 text-blue-600 rounded-xl hover:bg-blue-600/20 transition-all" title="إضافة زبون جديد">
                <UserPlus className="w-5 h-5" />
              </button>
              <button onClick={handleLogout} disabled={loggingOut}
                className="p-2.5 bg-card/80 backdrop-blur-sm rounded-full shadow-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all" title="تسجيل الخروج">
                <LogOut className={`w-5 h-5 ${loggingOut ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Customer Selector Card */}
        <div className="px-4 pb-3">
          <div className="bg-card rounded-2xl p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground text-xs font-bold">الزبون المحدد للعمليات</span>
              {selectedCustomer && (
                <button onClick={() => setSelectedCustomer(null)} className="text-xs text-red-500 hover:text-red-600 font-bold">إلغاء</button>
              )}
            </div>
            <button onClick={() => setShowCustomerPicker(true)}
              className="w-full flex items-center justify-between bg-muted rounded-xl px-4 py-3 hover:bg-accent transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${selectedCustomer ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-border text-muted-foreground'}`}>
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
          </div>
        </div>

        <WelcomeSplash />

        {/* Offline Sync Status Banner */}
        <div className="px-4 pb-2">
          <OfflineSyncBanner
            isOnline={offline.isOnline}
            pendingCount={offline.pendingCount}
            failedCount={offline.failedCount}
            isSyncing={offline.isSyncing}
            lastSyncMessage={offline.lastSyncMessage}
            actions={offline.actions}
            onTriggerSync={offline.triggerSync}
            onRetryAction={offline.retrySingleAction}
            onRetryAllFailed={offline.retryAllFailed}
          />
        </div>

        {/* Primary Tab Navigation - mirrors AccountantDashboard */}
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

        {/* Secondary Tab (Returns) - mirrors AccountantDashboard secondary tabs */}
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

      {/* Customer Picker Modal */}
      {showCustomerPicker && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCustomerPicker(false)}>
          <div className="bg-card w-full max-w-md rounded-3xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-border bg-muted/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-lg text-foreground">اختر الزبون</h3>
                <button onClick={() => setShowCustomerPicker(false)} className="p-2 hover:bg-accent rounded-xl transition-colors">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              
              <button onClick={() => { setShowCustomerPicker(false); setShowAddCustomerModal(true); }}
                className="w-full bg-blue-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 font-bold mb-4 hover:bg-blue-700 transition-colors">
                <UserPlus className="w-5 h-5" /> إضافة زبون جديد
              </button>
              
              <div className="relative">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input type="text" placeholder="بحث..." value={searchCustomer} onChange={(e) => setSearchCustomer(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-12 py-3 font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-muted-foreground" />
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
                      selectedCustomer?.id === customer.id ? 'bg-blue-500/10 border-2 border-blue-500' : 'bg-muted hover:bg-accent'
                    }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        selectedCustomer?.id === customer.id ? 'bg-blue-600 text-white' : 'bg-border text-muted-foreground'
                      }`}>
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{customer.name}</p>
                        <p className="text-sm text-muted-foreground">الرصيد: {Number(customer.balance).toLocaleString('ar-SA')} {CURRENCY}</p>
                      </div>
                      {selectedCustomer?.id === customer.id && (
                        <Check className="w-5 h-5 text-blue-600 mr-auto" />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddCustomerModal(false)}>
          <div className="bg-card w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-black text-lg text-foreground flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" /> إضافة زبون جديد
              </h3>
              <button onClick={() => setShowAddCustomerModal(false)} className="p-2 hover:bg-accent rounded-xl transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-bold text-muted-foreground mb-2 block">اسم الزبون <span className="text-destructive">*</span></label>
                <div className="relative">
                  <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input type="text" placeholder="أدخل اسم الزبون" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full bg-muted border-none rounded-xl px-12 py-4 font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-muted-foreground" disabled={addingCustomer} />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-bold text-muted-foreground mb-2 block">رقم الهاتف <span className="text-destructive">*</span></label>
                <div className="relative">
                  <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input type="tel" inputMode="numeric" placeholder="09xxxxxxxx" value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value.replace(/[^0-9+\-\s]/g, ''))}
                    className="w-full bg-muted border-none rounded-xl px-12 py-4 font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-muted-foreground" disabled={addingCustomer} />
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-muted-foreground mb-2 block">موقع الزبون <span className="text-destructive">*</span></label>
                <div className="relative">
                  <MapPin className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input type="text" placeholder="أدخل موقع أو عنوان الزبون" value={newCustomerLocation} onChange={(e) => setNewCustomerLocation(e.target.value)}
                    className="w-full bg-muted border-none rounded-xl px-12 py-4 font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-muted-foreground" disabled={addingCustomer} />
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 pt-2">
              <button onClick={handleAddCustomer}
                disabled={addingCustomer || !newCustomerName.trim() || !newCustomerPhone.trim() || !newCustomerLocation.trim()}
                className="flex-1 bg-emerald-500 text-white py-4 rounded-xl flex items-center justify-center gap-2 font-bold disabled:opacity-50 hover:bg-emerald-600 transition-colors">
                {addingCustomer ? (<><Loader2 className="w-5 h-5 animate-spin" /> جارٍ الحفظ...</>) : (<><Check className="w-5 h-5" /> حفظ</>)}
              </button>
              <button onClick={() => setShowAddCustomerModal(false)} disabled={addingCustomer}
                className="px-6 py-4 bg-muted rounded-xl font-bold text-muted-foreground hover:bg-accent disabled:opacity-50 transition-colors">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DistributorDashboard;
