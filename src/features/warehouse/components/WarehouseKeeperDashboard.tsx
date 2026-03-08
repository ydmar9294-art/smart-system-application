import React, { useState, useMemo, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Package, LogOut, LayoutDashboard, Truck, RotateCcw, ShoppingCart,
  MessageCircle, AlertTriangle, ArrowDownCircle, ArrowUpCircle, ArrowUpDown,
  Loader2, DollarSign, Save, X, Search, Home, PieChart, Settings
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { CURRENCY, SUPPORT_WHATSAPP_URL } from '@/constants';
import { InventoryTab } from '@/features/owner/components/InventoryTab';
import { DeliveriesTab } from '@/features/owner/components/DeliveriesTab';
import { PurchasesTab } from '@/features/owner/components/PurchasesTab';
import AIAssistant from '@/features/ai/components/AIAssistant';
import WelcomeSplash from '@/components/ui/WelcomeSplash';
import { Product } from '@/types';
import FullScreenModal from '@/components/ui/FullScreenModal';
import { DashboardHeader } from '@/components/ui/DashboardHeader';
import { BottomTabNav } from '@/components/ui/BottomTabNav';
import { GlassCard, GlassKPI } from '@/components/ui/GlassCard';

const StockMovementsTab = lazy(() => import('./StockMovementsTab'));

type WarehouseTabType = 'dashboard' | 'inventory' | 'deliveries' | 'purchases' | 'purchase-returns' | 'movements' | 'prices';
type BottomNavType = 'home' | 'inventory' | 'operations' | 'prices';

const WarehouseKeeperDashboard: React.FC = () => {
  const { user, products = [], deliveries = [], purchases = [], logout, updateProduct } = useApp();
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<WarehouseTabType>('dashboard');
  const [bottomNav, setBottomNav] = useState<BottomNavType>('home');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [priceSearch, setPriceSearch] = useState('');

  React.useEffect(() => {
    if (['dashboard'].includes(activeTab)) setBottomNav('home');
    else if (['inventory'].includes(activeTab)) setBottomNav('inventory');
    else if (['deliveries', 'movements', 'purchases', 'purchase-returns'].includes(activeTab)) setBottomNav('operations');
    else if (['prices'].includes(activeTab)) setBottomNav('prices');
  }, [activeTab]);

  const stats = useMemo(() => {
    const totalProducts = products.filter(p => !p.isDeleted).length;
    const lowStockProducts = products.filter(p => p.stock <= p.minStock && !p.isDeleted).length;
    const totalStock = products.filter(p => !p.isDeleted).reduce((sum, p) => sum + p.stock, 0);
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const todayDeliveries = deliveries.filter(d => new Date(d.created_at).getTime() >= todayStart).length;
    const todayPurchases = purchases.filter(p => new Date(p.created_at).getTime() >= todayStart).length;
    return { totalProducts, lowStockProducts, totalStock, todayDeliveries, todayPurchases };
  }, [products, deliveries, purchases]);




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

  const handleBottomNavChange = (navId: string) => {
    setBottomNav(navId as BottomNavType);
    switch (navId) {
      case 'home': setActiveTab('dashboard'); break;
      case 'inventory': setActiveTab('inventory'); break;
      case 'operations': setActiveTab('deliveries'); break;
      case 'prices': setActiveTab('prices'); break;
    }
  };

  const getSectionTabs = () => {
    switch (bottomNav) {
      case 'operations': return [
        { id: 'deliveries', label: t('warehouse.delivery'), icon: <Truck className="w-4 h-4" />, bgColor: 'bg-primary' },
        { id: 'movements', label: t('warehouse.movements'), icon: <ArrowUpDown className="w-4 h-4" />, bgColor: 'bg-warning' },
        { id: 'purchases', label: t('accountant.purchases'), icon: <ShoppingCart className="w-4 h-4" />, bgColor: 'bg-emerald-600' },
        { id: 'purchase-returns', label: t('warehouse.purchaseReturns'), icon: <RotateCcw className="w-4 h-4" />, bgColor: 'bg-destructive' },
      ];
      default: return null;
    }
  };

  const sectionTabs = getSectionTabs();

  const bottomTabs = [
    { id: 'home', label: t('nav.home'), icon: <Home className="w-5 h-5" /> },
    { id: 'inventory', label: t('nav.inventory'), icon: <Package className="w-5 h-5" /> },
    { id: 'operations', label: t('nav.operations'), icon: <Truck className="w-5 h-5" /> },
    { id: 'prices', label: t('nav.prices'), icon: <DollarSign className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-background has-bottom-nav" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-lg mx-auto">
        <DashboardHeader
          userName={user?.name || t('warehouse.keeper')}
          subtitle={t('warehouse.title')}
          icon={<Package className="w-4 h-4 text-primary-foreground" />}
          iconBgClass="bg-purple-600"
        />

        <WelcomeSplash />

        {sectionTabs && (
          <div className="px-4 pb-3">
            <div className="glass-section-tabs">
              {sectionTabs.map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as WarehouseTabType)}
                  className={`glass-section-tab ${activeTab === tab.id ? `glass-section-tab-active ${tab.bgColor}` : 'glass-section-tab-inactive'}`}>
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="px-4 pb-4">
          {activeTab === 'dashboard' && (
            <div className="space-y-3 animate-fade-in">
              <div className="grid grid-cols-2 gap-2">
                <GlassKPI icon={<Package className="w-5 h-5 text-purple-600 dark:text-purple-400" />} label="إجمالي المنتجات" value={stats.totalProducts} subValue="منتج" iconBgClass="bg-purple-500/10" />
                <GlassKPI icon={<ArrowDownCircle className="w-5 h-5 text-success" />} label="إجمالي المخزون" value={stats.totalStock.toLocaleString()} subValue="وحدة" iconBgClass="bg-success/10" />
              </div>

              <GlassCard>
                <h3 className="font-bold text-foreground mb-3 text-sm">نشاط اليوم</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-primary/10 p-3 rounded-xl text-center">
                    <Truck className="w-5 h-5 mx-auto text-primary mb-1" />
                    <p className="text-lg font-black text-foreground">{stats.todayDeliveries}</p>
                    <p className="text-[8px] text-muted-foreground font-bold">تسليمات اليوم</p>
                  </div>
                  <div className="bg-warning/10 p-3 rounded-xl text-center">
                    <ShoppingCart className="w-5 h-5 mx-auto text-warning mb-1" />
                    <p className="text-lg font-black text-foreground">{stats.todayPurchases}</p>
                    <p className="text-[8px] text-muted-foreground font-bold">مشتريات اليوم</p>
                  </div>
                </div>
              </GlassCard>

              {stats.lowStockProducts > 0 && (
                <GlassCard accentColor="hsl(0, 84%, 60%)">
                  <h3 className="font-bold text-foreground mb-3 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" /> منتجات قاربت على النفاد
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
                </GlassCard>
              )}

              <GlassCard>
                <h3 className="font-bold text-foreground mb-3 text-sm flex items-center gap-2">
                  <ArrowUpCircle className="w-4 h-4 text-primary" /> آخر التسليمات
                </h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {deliveries.slice(0, 5).map(d => (
                    <div key={d.id} className="flex justify-between items-center bg-muted/50 p-3 rounded-lg">
                      <div>
                        <p className="font-bold text-foreground text-sm">{d.distributor_name}</p>
                        <p className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString('ar-EG')}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                        d.status === 'completed' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                      }`}>
                        {d.status === 'completed' ? 'مكتمل' : 'معلق'}
                      </span>
                    </div>
                  ))}
                  {deliveries.length === 0 && <p className="text-center text-muted-foreground py-4">لا توجد تسليمات</p>}
                </div>
              </GlassCard>
            </div>
          )}

          {activeTab === 'inventory' && (
            <GlassCard className="!rounded-3xl"><InventoryTab productsOnly /></GlassCard>
          )}

          {activeTab === 'prices' && (
            <div className="space-y-3 animate-fade-in">
              <div className="relative">
                <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={priceSearch} onChange={(e) => setPriceSearch(e.target.value)} placeholder="بحث عن منتج..."
                  className="w-full px-4 py-3 pr-10 bg-card text-foreground rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground shadow-sm" />
              </div>
              {filteredPriceProducts.map(p => (
                <GlassCard key={p.id}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-black text-foreground text-sm">{p.name}</p>
                      <p className="text-[9px] text-muted-foreground">{p.category}</p>
                    </div>
                    <button onClick={() => setEditingProduct(p)}
                      className="px-3 py-1.5 bg-warning/10 text-warning rounded-xl text-xs font-bold flex items-center gap-1">
                      <DollarSign size={12} /> تعديل
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="bg-muted/50 p-2 rounded-xl text-center">
                      <p className="text-[8px] text-muted-foreground font-bold">التكلفة</p>
                      <p className="text-sm font-black text-foreground">{p.costPrice.toLocaleString()}</p>
                    </div>
                    <div className="bg-muted/50 p-2 rounded-xl text-center">
                      <p className="text-[8px] text-muted-foreground font-bold">البيع</p>
                      <p className="text-sm font-black text-foreground">{p.basePrice.toLocaleString()}</p>
                    </div>
                    <div className="bg-muted/50 p-2 rounded-xl text-center">
                      <p className="text-[8px] text-muted-foreground font-bold">المستهلك</p>
                      <p className="text-sm font-black text-foreground">{(p.consumerPrice || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}

          {activeTab === 'deliveries' && <GlassCard className="!rounded-3xl"><DeliveriesTab /></GlassCard>}
          {activeTab === 'movements' && (
            <GlassCard className="!rounded-3xl">
              <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
                <StockMovementsTab />
              </Suspense>
            </GlassCard>
          )}
          {activeTab === 'purchases' && <GlassCard className="!rounded-3xl"><PurchasesTab /></GlassCard>}
          {activeTab === 'purchase-returns' && <GlassCard className="!rounded-3xl"><InventoryTab forceSubTab="purchase-returns" /></GlassCard>}
        </div>
      </div>

      <BottomTabNav tabs={bottomTabs} activeTab={bottomNav} onTabChange={handleBottomNavChange} />

      {/* Price Edit Modal */}
      <FullScreenModal isOpen={!!editingProduct} onClose={() => setEditingProduct(null)}
        title={`تعديل أسعار: ${editingProduct?.name || ''}`} icon={<DollarSign size={24} />} headerColor="warning"
        footer={
          <button type="button" onClick={() => { const form = document.getElementById('price-edit-form') as HTMLFormElement; if (form) form.requestSubmit(); }}
            className="w-full bg-warning text-warning-foreground font-black py-5 rounded-2xl shadow-lg active:scale-[0.98] transition-all text-lg">حفظ الأسعار</button>
        }>
        {editingProduct && (
          <form id="price-edit-form" onSubmit={handlePriceSubmit} className="space-y-5">
            <div className="bg-muted p-4 rounded-2xl">
              <p className="text-xs text-muted-foreground mb-1">المنتج</p>
              <p className="font-black text-foreground text-lg">{editingProduct.name}</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-muted-foreground uppercase">سعر التكلفة</label>
              <input name="costPrice" type="number" step="0.01" defaultValue={editingProduct.costPrice}
                className="w-full px-4 py-4 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-warning text-center text-xl font-black" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-muted-foreground uppercase">سعر البيع</label>
              <input name="basePrice" type="number" step="0.01" defaultValue={editingProduct.basePrice}
                className="w-full px-4 py-4 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-warning text-center text-xl font-black" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-muted-foreground uppercase">سعر المستهلك</label>
              <input name="consumerPrice" type="number" step="0.01" defaultValue={editingProduct.consumerPrice || 0}
                className="w-full px-4 py-4 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-warning text-center text-xl font-black" />
            </div>
          </form>
        )}
      </FullScreenModal>
    </div>
  );
};

export default WarehouseKeeperDashboard;
