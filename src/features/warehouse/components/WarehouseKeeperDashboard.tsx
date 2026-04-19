import React, { useState, useMemo, lazy, Suspense } from 'react';
import AnimatedTabContent from '@/components/ui/AnimatedTabContent';
import { useTranslation } from 'react-i18next';
import {
  Package,
  LayoutDashboard,
  Truck,
  RotateCcw,
  ShoppingCart,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowUpDown,
  Loader2,
  DollarSign,
  Search,
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { InventoryTab } from '@/features/owner/components/InventoryTab';
import { DeliveriesTab } from '@/features/owner/components/DeliveriesTab';
import { PurchasesTab } from '@/features/owner/components/PurchasesTab';
import WelcomeSplash from '@/components/ui/WelcomeSplash';
import { Product } from '@/types';
import FullScreenModal from '@/components/ui/FullScreenModal';
import {
  AppHeader,
  AppBottomNav,
  AppSettingsSheet,
  AppSubPageSheet,
  type BottomNavItem,
  type SettingsItem,
} from '@/components/shell';

const StockMovementsTab = lazy(() => import('./StockMovementsTab'));

type WarehousePrimaryTab = 'dashboard' | 'inventory' | 'deliveries' | 'movements';
type WarehouseSubPage = 'prices' | 'purchases' | 'purchase-returns';
type WarehouseTabType = WarehousePrimaryTab | WarehouseSubPage;

const WarehouseKeeperDashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const {
    user,
    products = [],
    deliveries = [],
    purchases = [],
    logout,
    updateProduct,
  } = useApp();

  const [activeTab, setActiveTab] = useState<WarehouseTabType>('dashboard');
  const [loggingOut, setLoggingOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [subPage, setSubPage] = useState<WarehouseSubPage | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [priceSearch, setPriceSearch] = useState('');

  const stats = useMemo(() => {
    const totalProducts = products.filter(p => !p.isDeleted).length;
    const lowStockProducts = products.filter(p => p.stock <= p.minStock && !p.isDeleted).length;
    const totalStock = products.filter(p => !p.isDeleted).reduce((sum, p) => sum + p.stock, 0);
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const todayDeliveries = deliveries.filter(d => new Date(d.created_at).getTime() >= todayStart).length;
    const todayPurchases = purchases.filter(p => new Date(p.created_at).getTime() >= todayStart).length;
    return { totalProducts, lowStockProducts, totalStock, todayDeliveries, todayPurchases };
  }, [products, deliveries, purchases]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await logout(); } finally { setLoggingOut(false); }
  };

  const handlePriceSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingProduct) return;
    const fd = new FormData(e.currentTarget);
    await updateProduct({
      ...editingProduct,
      costPrice: Number(fd.get('costPrice')),
      basePrice: Number(fd.get('basePrice')),
      consumerPrice: Number(fd.get('consumerPrice') || 0),
    });
    setEditingProduct(null);
  };

  const filteredPriceProducts = products.filter(p => !p.isDeleted && p.name.includes(priceSearch));

  const navItems: BottomNavItem<WarehousePrimaryTab>[] = [
    { id: 'dashboard',  label: t('warehouse.tabs.home'),       icon: LayoutDashboard },
    { id: 'inventory',  label: t('warehouse.tabs.inventory'),  icon: Package },
    { id: 'deliveries', label: t('warehouse.tabs.deliveries'), icon: Truck },
    { id: 'movements',  label: t('warehouse.tabs.movements'),  icon: ArrowUpDown },
  ];

  const settingsItems: SettingsItem<WarehouseSubPage>[] = [
    { id: 'prices',           label: t('warehouse.tabs.prices'),    Icon: DollarSign,  color: 'text-amber-600',  bg: 'bg-amber-500/10' },
    { id: 'purchases',        label: t('warehouse.tabs.purchases'), Icon: ShoppingCart,color: 'text-blue-600',   bg: 'bg-blue-500/10' },
    { id: 'purchase-returns', label: t('warehouse.tabs.returns'),   Icon: RotateCcw,   color: 'text-orange-600', bg: 'bg-orange-500/10' },
  ];

  const subPageTitle = settingsItems.find(i => i.id === subPage)?.label ?? '';

  const renderPrimaryContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-3 animate-fade-in">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-card p-4 rounded-2xl shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center">
                    <Package className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">{t('warehouse.totalProducts')}</p>
                <p className="text-xl font-black text-foreground">{stats.totalProducts}</p>
                <p className="text-[10px] text-muted-foreground">{t('common.product')}</p>
              </div>
              <div className="bg-card p-4 rounded-2xl shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                    <ArrowDownCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">{t('warehouse.totalStock')}</p>
                <p className="text-xl font-black text-foreground">{stats.totalStock.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">{t('warehouse.unit')}</p>
              </div>
            </div>

            <div className="bg-card p-4 rounded-2xl shadow-sm">
              <h3 className="font-bold text-foreground mb-3 text-sm">{t('warehouse.todayActivity')}</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-blue-500/10 p-3 rounded-xl text-center">
                  <Truck className="w-5 h-5 mx-auto text-blue-600 dark:text-blue-400 mb-1" />
                  <p className="text-lg font-black text-foreground">{stats.todayDeliveries}</p>
                  <p className="text-[8px] text-muted-foreground font-bold">{t('warehouse.todayDeliveries')}</p>
                </div>
                <div className="bg-orange-500/10 p-3 rounded-xl text-center">
                  <ShoppingCart className="w-5 h-5 mx-auto text-orange-600 dark:text-orange-400 mb-1" />
                  <p className="text-lg font-black text-foreground">{stats.todayPurchases}</p>
                  <p className="text-[8px] text-muted-foreground font-bold">{t('warehouse.todayPurchases')}</p>
                </div>
              </div>
            </div>

            {stats.lowStockProducts > 0 && (
              <div className="bg-card p-4 rounded-2xl shadow-sm border-r-4 border-destructive">
                <h3 className="font-bold text-foreground mb-3 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  {t('warehouse.lowStockProducts')}
                </h3>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {products.filter(p => p.stock <= p.minStock && !p.isDeleted).slice(0, 5).map(p => (
                    <div key={p.id} className="flex justify-between items-center bg-destructive/10 p-2 rounded-lg">
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

            <div className="bg-card p-4 rounded-2xl shadow-sm">
              <h3 className="font-bold text-foreground mb-3 text-sm flex items-center gap-2">
                <ArrowUpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                {t('warehouse.recentDeliveries')}
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {deliveries.slice(0, 5).map(d => (
                  <div key={d.id} className="flex justify-between items-center bg-muted p-3 rounded-lg">
                    <div>
                      <p className="font-bold text-foreground text-sm">{d.distributor_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(d.created_at).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                      d.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                    }`}>
                      {d.status === 'completed' ? t('common.completed') : t('common.pending')}
                    </span>
                  </div>
                ))}
                {deliveries.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">{t('warehouse.noDeliveries')}</p>
                )}
              </div>
            </div>
          </div>
        );
      case 'inventory':
        return <div className="bg-card rounded-3xl shadow-sm p-4"><InventoryTab productsOnly /></div>;
      case 'deliveries':
        return <div className="bg-card rounded-3xl shadow-sm p-4"><DeliveriesTab /></div>;
      case 'movements':
        return (
          <div className="bg-card rounded-3xl shadow-sm p-4">
            <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
              <StockMovementsTab />
            </Suspense>
          </div>
        );
      default: return null;
    }
  };

  const renderSubPage = () => {
    switch (subPage) {
      case 'prices':
        return (
          <div className="space-y-3 animate-fade-in">
            <div className="relative">
              <Search size={16} className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-muted-foreground`} />
              <input
                value={priceSearch}
                onChange={(e) => setPriceSearch(e.target.value)}
                placeholder={t('warehouse.searchProduct')}
                className={`w-full px-4 py-3 ${isRtl ? 'pr-10' : 'pl-10'} bg-card text-foreground rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground shadow-sm`}
              />
            </div>
            {filteredPriceProducts.map(p => (
              <div key={p.id} className="bg-card p-4 rounded-2xl shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-black text-foreground text-sm">{p.name}</p>
                    <p className="text-[9px] text-muted-foreground">{p.category}</p>
                  </div>
                  <button
                    onClick={() => setEditingProduct(p)}
                    className="px-3 py-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl text-xs font-bold flex items-center gap-1"
                  >
                    <DollarSign size={12} /> {t('common.edit')}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="bg-muted p-2 rounded-xl text-center">
                    <p className="text-[8px] text-muted-foreground font-bold">{t('warehouse.cost')}</p>
                    <p className="text-sm font-black text-foreground">{p.costPrice.toLocaleString()}</p>
                  </div>
                  <div className="bg-muted p-2 rounded-xl text-center">
                    <p className="text-[8px] text-muted-foreground font-bold">{t('warehouse.sale')}</p>
                    <p className="text-sm font-black text-foreground">{p.basePrice.toLocaleString()}</p>
                  </div>
                  <div className="bg-muted p-2 rounded-xl text-center">
                    <p className="text-[8px] text-muted-foreground font-bold">{t('warehouse.consumer')}</p>
                    <p className="text-sm font-black text-foreground">{(p.consumerPrice || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      case 'purchases':
        return <div className="bg-card rounded-3xl shadow-sm p-4"><PurchasesTab /></div>;
      case 'purchase-returns':
        return <div className="bg-card rounded-3xl shadow-sm p-4"><InventoryTab forceSubTab="purchase-returns" /></div>;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-background" dir={isRtl ? 'rtl' : 'ltr'}>
      <AppHeader
        title={user?.name || t('roles.warehouseKeeper')}
        subtitle={t('warehouse.dashboard')}
        Icon={Package}
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
        onChange={(id) => setActiveTab(id as WarehousePrimaryTab)}
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

      {/* Price Edit Modal */}
      <FullScreenModal
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        title={`${t('warehouse.editPrices')} ${editingProduct?.name || ''}`}
        icon={<DollarSign size={24} />}
        headerColor="warning"
        footer={
          <button
            type="button"
            onClick={() => {
              const form = document.getElementById('price-edit-form') as HTMLFormElement;
              if (form) form.requestSubmit();
            }}
            className="w-full bg-amber-500 text-white font-black py-5 rounded-2xl shadow-lg active:scale-[0.98] transition-all text-lg"
          >
            {t('warehouse.savePrices')}
          </button>
        }
      >
        {editingProduct && (
          <form id="price-edit-form" onSubmit={handlePriceSubmit} className="space-y-5">
            <div className="bg-muted p-4 rounded-2xl">
              <p className="text-xs text-muted-foreground mb-1">{t('common.product')}</p>
              <p className="font-black text-foreground text-lg">{editingProduct.name}</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-muted-foreground uppercase">{t('warehouse.costPrice')}</label>
              <input name="costPrice" type="number" step="0.01" defaultValue={editingProduct.costPrice}
                className="w-full px-4 py-4 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-amber-500 text-center text-xl font-black" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-muted-foreground uppercase">{t('warehouse.salePrice')}</label>
              <input name="basePrice" type="number" step="0.01" defaultValue={editingProduct.basePrice}
                className="w-full px-4 py-4 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-amber-500 text-center text-xl font-black" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-muted-foreground uppercase">{t('warehouse.consumerPrice')}</label>
              <input name="consumerPrice" type="number" step="0.01" defaultValue={editingProduct.consumerPrice ?? 0}
                className="w-full px-4 py-4 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-amber-500 text-center text-xl font-black" />
            </div>
          </form>
        )}
      </FullScreenModal>
    </div>
  );
};

export default WarehouseKeeperDashboard;
