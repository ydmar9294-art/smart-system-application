import React, { useState, useEffect } from 'react';
import AnimatedTabContent from '@/components/ui/AnimatedTabContent';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  RotateCcw,
  Wallet,
  Users,
  UserPlus,
  X,
  User,
  Phone,
  MapPin,
  Check,
  Loader2,
  ChevronDown,
  Search,
  Warehouse,
  History,
  ShoppingBag,
  FileText,
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { useAuth } from '@/store/AuthContext';
import { useTabPrefetch } from '@/hooks/useTabPrefetch';
import { supabase } from '@/integrations/supabase/client';
import WelcomeSplash from '@/components/ui/WelcomeSplash';
import NewSaleTab from './NewSaleTab';
import SalesReturnTab from './SalesReturnTab';
import CollectionTab from './CollectionTab';
import CustomerDebtsTab from './CustomerDebtsTab';
import DistributorInventoryTab from './DistributorInventoryTab';
import InvoiceHistoryTab from './InvoiceHistoryTab';
import OfflineSyncBanner from './OfflineSyncBanner';
import MyRouteTab from './MyRouteTab';
import { useDistributorOffline } from '../hooks/useDistributorOffline';
import { useNotificationToast } from '@/hooks/useNotificationToast';
import { useGpsTracker } from '@/platform/hooks/useGpsTracker';
import { Customer } from '@/types';
import { CURRENCY } from '@/constants';
import {
  AppHeader,
  AppBottomNav,
  AppSettingsSheet,
  AppSubPageSheet,
  type BottomNavItem,
  type SettingsItem,
} from '@/components/shell';

// Primary tabs shown in the bottom nav
type DistributorPrimaryTab = 'inventory' | 'new-sale' | 'collections' | 'route';
// Secondary tabs accessed through Settings sheet
type DistributorSubPage = 'debts' | 'history' | 'returns';
type DistributorTabType = DistributorPrimaryTab | DistributorSubPage;

const DistributorDashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { logout, addNotification, organization, user: appUser } = useApp();
  const offline = useDistributorOffline();
  const { role: authRole, organization: authOrg } = useAuth();

  // Subscribe to realtime price/exchange-rate notifications
  useNotificationToast(appUser?.id);


  // Activate GPS tracking for field agents (works offline)
  useGpsTracker({
    enabled: !!authOrg?.id,
    organizationId: authOrg?.id,
    intervalMs: 3 * 60 * 1000,
  });

  const [activeTab, setActiveTab] = useState<DistributorTabType>('inventory');
  useTabPrefetch(activeTab as any, authOrg?.id, authRole);

  const [loggingOut, setLoggingOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [subPage, setSubPage] = useState<DistributorSubPage | null>(null);

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

  const myCustomers = currentUserId
    ? offline.localCustomers.filter(c => c.created_by === currentUserId)
    : offline.localCustomers;
  const filteredCustomers = myCustomers.filter(c =>
    c.name.toLowerCase().includes(searchCustomer.toLowerCase()),
  );

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await logout(); } finally { setLoggingOut(false); }
  };

  const handleAddCustomer = async () => {
    if (!newCustomerName.trim()) { addNotification(t('distributor.enterCustomerName'), 'warning'); return; }
    if (!newCustomerPhone.trim()) { addNotification(t('distributor.enterCustomerPhone'), 'warning'); return; }
    if (!/^[0-9+\-\s]+$/.test(newCustomerPhone.trim())) { addNotification(t('distributor.invalidPhone'), 'warning'); return; }
    if (!newCustomerLocation.trim()) { addNotification(t('distributor.enterCustomerLocation'), 'warning'); return; }
    setAddingCustomer(true);
    try {
      const newCustomer = await offline.addCustomerOffline(
        newCustomerName.trim(),
        newCustomerPhone.trim(),
        newCustomerLocation.trim(),
        authOrg?.id,
        appUser?.id,
      );
      setNewCustomerName(''); setNewCustomerPhone(''); setNewCustomerLocation('');
      setShowAddCustomerModal(false);
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
        offline.isOnline ? t('distributor.customerAdded') : t('distributor.customerAddedOffline'),
        'success',
      );
    } catch (error: any) {
      addNotification(error?.message || t('distributor.customerAddFailed'), 'error');
    } finally {
      setAddingCustomer(false);
    }
  };

  // ===== Bottom nav (4 primary + Settings) =====
  const navItems: BottomNavItem<DistributorPrimaryTab>[] = [
    { id: 'inventory',   label: t('distributor.tabs.inventory'),   icon: Warehouse },
    { id: 'new-sale',    label: t('distributor.tabs.newSale'),     icon: FileText },
    { id: 'collections', label: t('distributor.tabs.collections'), icon: Wallet },
    { id: 'route',       label: t('tracking.myRoute'),             icon: MapPin },
  ];

  // ===== Settings sheet items (secondary screens) =====
  const settingsItems: SettingsItem<DistributorSubPage>[] = [
    { id: 'debts',   label: t('distributor.tabs.customers'), Icon: Users,    color: 'text-rose-600',  bg: 'bg-rose-500/10' },
    { id: 'history', label: t('distributor.tabs.history'),   Icon: History,  color: 'text-blue-600',  bg: 'bg-blue-500/10' },
    { id: 'returns', label: t('distributor.tabs.returns'),   Icon: RotateCcw,color: 'text-amber-600', bg: 'bg-amber-500/10' },
  ];

  const subPageTitle = (() => {
    switch (subPage) {
      case 'debts':   return t('distributor.tabs.customers');
      case 'history': return t('distributor.tabs.history');
      case 'returns': return t('distributor.tabs.returns');
      default: return '';
    }
  })();

  const renderPrimaryContent = () => {
    switch (activeTab) {
      case 'inventory':
        return <DistributorInventoryTab localInventory={offline.localInventory} onQueueAction={offline.queueAction} isOnline={offline.isOnline} />;
      case 'new-sale':
        return <NewSaleTab selectedCustomer={selectedCustomer} localInventory={offline.localInventory} onQueueAction={offline.queueAction} isOnline={offline.isOnline} />;
      case 'collections':
        return <CollectionTab selectedCustomer={selectedCustomer} onQueueAction={offline.queueAction} isOnline={offline.isOnline} localSales={offline.localSales} localCustomers={offline.localCustomers} />;
      case 'route':
        return <MyRouteTab isOnline={offline.isOnline} onQueueAction={offline.queueAction} />;
      default:
        return null;
    }
  };

  const renderSubPage = () => {
    switch (subPage) {
      case 'debts':
        return <CustomerDebtsTab selectedCustomer={selectedCustomer} myCustomers={myCustomers} localSales={offline.localSales} />;
      case 'history':
        return <InvoiceHistoryTab isOnline={offline.isOnline} />;
      case 'returns':
        return <SalesReturnTab selectedCustomer={selectedCustomer} onQueueAction={offline.queueAction} isOnline={offline.isOnline} localSales={offline.localSales} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background" dir={isRtl ? 'rtl' : 'ltr'}>
      <AppHeader
        title={appUser?.name || t('roles.fieldAgent')}
        subtitle={organization?.name || t('distributor.subtitle')}
        Icon={ShoppingBag}
      />

      <div className="max-w-lg mx-auto">
        <WelcomeSplash />

        <div
          className="px-3 pt-3 space-y-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
        >
          {/* Customer Selector */}
          <div
            className="rounded-3xl p-3"
            style={{
              background: 'var(--card-glass-bg)',
              backdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturation))',
              WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturation))',
              border: '1px solid var(--card-glass-border)',
              boxShadow: 'var(--glass-shadow), var(--glass-highlight)',
            }}
          >
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-muted-foreground text-[11px] font-bold">
                {t('distributor.selectedCustomer')}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddCustomerModal(true)}
                  className="text-[11px] text-primary font-bold flex items-center gap-1 active:scale-95 transition-transform"
                >
                  <UserPlus className="w-3.5 h-3.5" /> {t('distributor.addNewCustomer')}
                </button>
                {selectedCustomer && (
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="text-[11px] text-destructive font-bold"
                  >
                    {t('distributor.cancelSelection')}
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowCustomerPicker(true)}
              className="w-full flex items-center justify-between bg-muted/60 rounded-2xl px-3 py-2.5 hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    selectedCustomer
                      ? 'bg-primary/10 text-primary'
                      : 'bg-border text-muted-foreground'
                  }`}
                >
                  <User className="w-4 h-4" />
                </div>
                <div className="text-start">
                  {selectedCustomer ? (
                    <>
                      <p className="font-bold text-foreground text-sm">{selectedCustomer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('common.balance')}:{' '}
                        {Number(selectedCustomer.balance).toLocaleString('ar-SA')} {CURRENCY}
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground font-medium text-sm">
                      {t('distributor.selectCustomer')}
                    </p>
                  )}
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Offline Sync Banner */}
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

          {/* Tab Content */}
          <AnimatedTabContent tabKey={activeTab}>{renderPrimaryContent()}</AnimatedTabContent>
        </div>
      </div>

      {/* Bottom Nav */}
      <AppBottomNav
        items={navItems}
        active={activeTab as any}
        onChange={(id) => setActiveTab(id as DistributorPrimaryTab)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Settings Sheet (hosts secondary screens) */}
      <AppSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        items={settingsItems}
        onOpenItem={(id) => { setSettingsOpen(false); setSubPage(id); }}
        onLogout={handleLogout}
        loggingOut={loggingOut}
      />

      {/* Sub-page sheet */}
      <AppSubPageSheet
        open={subPage !== null}
        onClose={() => setSubPage(null)}
        title={subPageTitle}
      >
        {renderSubPage()}
      </AppSubPageSheet>

      {/* Customer Picker Modal */}
      {showCustomerPicker && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-md flex items-center justify-center p-6 safe-area-x safe-area-bottom"
          dir={isRtl ? 'rtl' : 'ltr'}
          onClick={() => setShowCustomerPicker(false)}
        >
          <div
            className="bg-card w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-border"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-border bg-muted/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-lg text-foreground">{t('distributor.chooseCustomer')}</h3>
                <button onClick={() => setShowCustomerPicker(false)} className="p-2 hover:bg-accent rounded-xl transition-colors">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              <button
                onClick={() => { setShowCustomerPicker(false); setShowAddCustomerModal(true); }}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl flex items-center justify-center gap-2 font-bold mb-4 hover:opacity-90 transition-opacity"
              >
                <UserPlus className="w-5 h-5" /> {t('distributor.addNewCustomer')}
              </button>
              <div className="relative">
                <Search className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground`} />
                <input
                  type="text"
                  placeholder={t('distributor.searchCustomer')}
                  value={searchCustomer}
                  onChange={(e) => setSearchCustomer(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-12 py-3 font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-4 space-y-2">
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <User className="w-16 h-16 mx-auto mb-3 opacity-30" />
                  <p className="font-bold">{t('distributor.noCustomers')}</p>
                  <p className="text-sm mt-1">{t('distributor.addCustomerToStart')}</p>
                </div>
              ) : (
                filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => { setSelectedCustomer(customer); setShowCustomerPicker(false); setSearchCustomer(''); }}
                    className={`w-full text-start p-4 rounded-2xl transition-colors ${
                      selectedCustomer?.id === customer.id
                        ? 'bg-primary/10 border-2 border-primary'
                        : 'bg-muted hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          selectedCustomer?.id === customer.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-border text-muted-foreground'
                        }`}
                      >
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{customer.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {t('common.balance')}: {Number(customer.balance).toLocaleString('ar-SA')} {CURRENCY}
                        </p>
                      </div>
                      {selectedCustomer?.id === customer.id && (
                        <Check className={`w-5 h-5 text-primary ${isRtl ? 'mr-auto' : 'ml-auto'}`} />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Add Customer Modal */}
      {showAddCustomerModal && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-md flex items-center justify-center p-6 safe-area-x safe-area-bottom"
          dir={isRtl ? 'rtl' : 'ltr'}
          onClick={() => setShowAddCustomerModal(false)}
        >
          <div
            className="bg-card w-full max-w-md rounded-2xl p-6 space-y-5 shadow-2xl border border-border"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-black text-lg text-foreground flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" /> {t('distributor.addNewCustomer')}
              </h3>
              <button onClick={() => setShowAddCustomerModal(false)} className="p-2 hover:bg-accent rounded-xl transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-bold text-muted-foreground mb-2 block">
                  {t('distributor.customerName')} <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <User className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground`} />
                  <input
                    type="text"
                    placeholder={t('distributor.customerName')}
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full bg-muted border-none rounded-xl px-12 py-4 font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
                    disabled={addingCustomer}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-bold text-muted-foreground mb-2 block">
                  {t('distributor.customerPhone')} <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Phone className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground`} />
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="09xxxxxxxx"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value.replace(/[^0-9+\-\s]/g, ''))}
                    className="w-full bg-muted border-none rounded-xl px-12 py-4 font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
                    disabled={addingCustomer}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-bold text-muted-foreground mb-2 block">
                  {t('distributor.customerLocation')} <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <MapPin className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground`} />
                  <input
                    type="text"
                    placeholder={t('distributor.customerLocation')}
                    value={newCustomerLocation}
                    onChange={(e) => setNewCustomerLocation(e.target.value)}
                    className="w-full bg-muted border-none rounded-xl px-12 py-4 font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
                    disabled={addingCustomer}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleAddCustomer}
                disabled={addingCustomer || !newCustomerName.trim() || !newCustomerPhone.trim() || !newCustomerLocation.trim()}
                className="flex-1 bg-primary text-primary-foreground py-4 rounded-xl flex items-center justify-center gap-2 font-bold disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {addingCustomer ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> {t('distributor.adding')}</>
                ) : (
                  <><Check className="w-5 h-5" /> {t('common.save')}</>
                )}
              </button>
              <button
                onClick={() => setShowAddCustomerModal(false)}
                disabled={addingCustomer}
                className="px-6 py-4 bg-muted rounded-xl font-bold text-muted-foreground hover:bg-accent disabled:opacity-50 transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default DistributorDashboard;
