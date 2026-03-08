import React, { useState, useMemo, lazy, Suspense } from 'react';
import { 
  Package, 
  LogOut,
  LayoutDashboard,
  Truck,
  RotateCcw,
  ShoppingCart,
  MessageCircle,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowUpDown,
  Loader2,
  DollarSign,
  Save,
  X,
  Search
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

const StockMovementsTab = lazy(() => import('./StockMovementsTab'));

type WarehouseTabType = 'dashboard' | 'inventory' | 'deliveries' | 'purchases' | 'purchase-returns' | 'movements' | 'prices';

const WarehouseKeeperDashboard: React.FC = () => {
  const { 
    user, 
    products = [],
    deliveries = [],
    purchases = [],
    logout,
    updateProduct
  } = useApp();
  
  const [activeTab, setActiveTab] = useState<WarehouseTabType>('dashboard');
  const [loggingOut, setLoggingOut] = useState(false);
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

  const tabs: { id: WarehouseTabType; label: string; icon: React.ReactNode; color: string; bgColor: string }[] = [
    { id: 'dashboard', label: 'الرئيسية', icon: <LayoutDashboard className="w-5 h-5" />, color: 'text-purple-600', bgColor: 'bg-purple-600' },
    { id: 'inventory', label: 'المخزون', icon: <Package className="w-5 h-5" />, color: 'text-emerald-600', bgColor: 'bg-emerald-600' },
    { id: 'prices', label: 'الأسعار', icon: <DollarSign className="w-5 h-5" />, color: 'text-amber-500', bgColor: 'bg-amber-500' },
    { id: 'deliveries', label: 'التسليم', icon: <Truck className="w-5 h-5" />, color: 'text-blue-600', bgColor: 'bg-blue-600' },
    { id: 'movements', label: 'الحركات', icon: <ArrowUpDown className="w-5 h-5" />, color: 'text-orange-500', bgColor: 'bg-orange-500' },
  ];

  const secondaryTabs: { id: WarehouseTabType; label: string; icon: React.ReactNode }[] = [
    { id: 'purchases', label: 'المشتريات', icon: <ShoppingCart className="w-4 h-4" /> },
    { id: 'purchase-returns', label: 'المرتجعات', icon: <RotateCcw className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="max-w-lg mx-auto">
        {/* Top Header */}
        <div className="bg-background pt-4 px-4 relative">
          <div className="flex justify-center pt-4 mb-3">
            <div className="flex items-center gap-3 bg-card px-4 py-2 rounded-full shadow-sm">
              <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                <Package className="w-4 h-4 text-white" />
              </div>
              <div className="text-end">
                <p className="font-bold text-foreground text-sm">{user?.name || 'أمين المستودع'}</p>
                <p className="text-[10px] text-muted-foreground">إدارة المخزون</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5 bg-card/80 backdrop-blur-sm px-2 py-1.5 rounded-xl shadow-sm">
              <AIAssistant className="!p-1.5 !rounded-lg" />
              <div className="w-px h-5 bg-border" />
              <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
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

        {/* Tab Navigation */}
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

        {/* Secondary Tabs */}
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
          {activeTab === 'dashboard' && (
            <div className="space-y-3 animate-fade-in">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-card p-4 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center">
                      <Package className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                  <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">إجمالي المنتجات</p>
                  <p className="text-xl font-black text-foreground">{stats.totalProducts}</p>
                  <p className="text-[10px] text-muted-foreground">منتج</p>
                </div>
                
                <div className="bg-card p-4 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                      <ArrowDownCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                  <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">إجمالي المخزون</p>
                  <p className="text-xl font-black text-foreground">{stats.totalStock.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">وحدة</p>
                </div>
              </div>

              <div className="bg-card p-4 rounded-2xl shadow-sm">
                <h3 className="font-bold text-foreground mb-3 text-sm">نشاط اليوم</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-blue-500/10 p-3 rounded-xl text-center">
                    <Truck className="w-5 h-5 mx-auto text-blue-600 dark:text-blue-400 mb-1" />
                    <p className="text-lg font-black text-foreground">{stats.todayDeliveries}</p>
                    <p className="text-[8px] text-muted-foreground font-bold">تسليمات اليوم</p>
                  </div>
                  <div className="bg-orange-500/10 p-3 rounded-xl text-center">
                    <ShoppingCart className="w-5 h-5 mx-auto text-orange-600 dark:text-orange-400 mb-1" />
                    <p className="text-lg font-black text-foreground">{stats.todayPurchases}</p>
                    <p className="text-[8px] text-muted-foreground font-bold">مشتريات اليوم</p>
                  </div>
                </div>
              </div>

              {stats.lowStockProducts > 0 && (
                <div className="bg-card p-4 rounded-2xl shadow-sm border-r-4 border-red-500">
                  <h3 className="font-bold text-foreground mb-3 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    منتجات قاربت على النفاد
                  </h3>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {products.filter(p => p.stock <= p.minStock && !p.isDeleted).slice(0, 5).map(p => (
                      <div key={p.id} className="flex justify-between items-center bg-red-500/10 p-2 rounded-lg">
                        <span className="font-bold text-xs text-foreground">{p.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-600 dark:text-red-400 font-black">{p.stock}</span>
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
                  آخر التسليمات
                </h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {deliveries.slice(0, 5).map(d => (
                    <div key={d.id} className="flex justify-between items-center bg-muted p-3 rounded-lg">
                      <div>
                        <p className="font-bold text-foreground text-sm">{d.distributor_name}</p>
                        <p className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString('ar-EG')}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                        d.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                      }`}>
                        {d.status === 'completed' ? 'مكتمل' : 'معلق'}
                      </span>
                    </div>
                  ))}
                  {deliveries.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">لا توجد تسليمات</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="bg-card rounded-3xl shadow-sm p-4"><InventoryTab productsOnly /></div>
          )}

          {/* Price Control Tab */}
          {activeTab === 'prices' && (
            <div className="space-y-3 animate-fade-in">
              <div className="relative">
                <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  value={priceSearch} onChange={(e) => setPriceSearch(e.target.value)} 
                  placeholder="بحث عن منتج..." 
                  className="w-full px-4 py-3 pr-10 bg-card text-foreground rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground shadow-sm" 
                />
              </div>
              
              {filteredPriceProducts.map(p => (
                <div key={p.id} className="bg-card p-4 rounded-2xl shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-black text-foreground text-sm">{p.name}</p>
                      <p className="text-[9px] text-muted-foreground">{p.category}</p>
                    </div>
                    <button onClick={() => setEditingProduct(p)}
                      className="px-3 py-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl text-xs font-bold flex items-center gap-1">
                      <DollarSign size={12} /> تعديل
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="bg-muted p-2 rounded-xl text-center">
                      <p className="text-[8px] text-muted-foreground font-bold">التكلفة</p>
                      <p className="text-sm font-black text-foreground">{p.costPrice.toLocaleString()}</p>
                    </div>
                    <div className="bg-muted p-2 rounded-xl text-center">
                      <p className="text-[8px] text-muted-foreground font-bold">البيع</p>
                      <p className="text-sm font-black text-foreground">{p.basePrice.toLocaleString()}</p>
                    </div>
                    <div className="bg-muted p-2 rounded-xl text-center">
                      <p className="text-[8px] text-muted-foreground font-bold">المستهلك</p>
                      <p className="text-sm font-black text-foreground">{(p.consumerPrice || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'deliveries' && (
            <div className="bg-card rounded-3xl shadow-sm p-4"><DeliveriesTab /></div>
          )}
          {activeTab === 'movements' && (
            <div className="bg-card rounded-3xl shadow-sm p-4">
              <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
                <StockMovementsTab />
              </Suspense>
            </div>
          )}
          {activeTab === 'purchases' && (
            <div className="bg-card rounded-3xl shadow-sm p-4"><PurchasesTab /></div>
          )}
          {activeTab === 'purchase-returns' && (
            <div className="bg-card rounded-3xl shadow-sm p-4"><InventoryTab forceSubTab="purchase-returns" /></div>
          )}
        </div>
      </div>

      {/* Price Edit Modal */}
      <FullScreenModal
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        title={`تعديل أسعار: ${editingProduct?.name || ''}`}
        icon={<DollarSign size={24} />}
        headerColor="warning"
        footer={
          <button type="button" onClick={() => {
            const form = document.getElementById('price-edit-form') as HTMLFormElement;
            if (form) form.requestSubmit();
          }} className="w-full bg-amber-500 text-white font-black py-5 rounded-2xl shadow-lg active:scale-[0.98] transition-all text-lg">
            حفظ الأسعار
          </button>
        }
      >
        {editingProduct && (
          <form id="price-edit-form" onSubmit={handlePriceSubmit} className="space-y-5">
            <div className="bg-muted p-4 rounded-2xl">
              <p className="text-xs text-muted-foreground mb-1">المنتج</p>
              <p className="font-black text-foreground text-lg">{editingProduct.name}</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-muted-foreground uppercase">سعر التكلفة</label>
              <input name="costPrice" type="number" step="0.01" defaultValue={editingProduct.costPrice}
                className="w-full px-4 py-4 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-amber-500 text-center text-xl font-black" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-muted-foreground uppercase">سعر البيع</label>
              <input name="basePrice" type="number" step="0.01" defaultValue={editingProduct.basePrice}
                className="w-full px-4 py-4 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-amber-500 text-center text-xl font-black" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-muted-foreground uppercase">سعر المستهلك</label>
              <input name="consumerPrice" type="number" step="0.01" defaultValue={editingProduct.consumerPrice ?? 0}
                className="w-full px-4 py-4 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-amber-500 text-center text-xl font-black" />
            </div>
            <div className="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20">
              <p className="text-xs text-amber-600 dark:text-amber-400 font-bold">⚠️ جميع التغييرات في الأسعار يتم تسجيلها تلقائياً في سجل التدقيق</p>
            </div>
          </form>
        )}
      </FullScreenModal>
    </div>
  );
};

export default WarehouseKeeperDashboard;
