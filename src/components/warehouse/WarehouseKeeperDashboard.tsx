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
  Loader2
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { CURRENCY, SUPPORT_WHATSAPP_URL } from '@/constants';
import { InventoryTab } from '@/components/owner/InventoryTab';
import { DeliveriesTab } from '@/components/owner/DeliveriesTab';
import { PurchasesTab } from '@/components/owner/PurchasesTab';
import AIAssistant from '@/components/ai/AIAssistant';
import WelcomeSplash from '@/components/ui/WelcomeSplash';

const StockMovementsTab = lazy(() => import('./StockMovementsTab'));

type WarehouseTabType = 'dashboard' | 'inventory' | 'deliveries' | 'purchases' | 'purchase-returns' | 'movements';

const WarehouseKeeperDashboard: React.FC = () => {
  const { 
    user, 
    products = [],
    deliveries = [],
    purchases = [],
    logout
  } = useApp();
  
  const [activeTab, setActiveTab] = useState<WarehouseTabType>('dashboard');
  const [loggingOut, setLoggingOut] = useState(false);

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

  const tabs: { id: WarehouseTabType; label: string; icon: React.ReactNode; color: string; bgColor: string }[] = [
    { id: 'dashboard', label: 'الرئيسية', icon: <LayoutDashboard className="w-5 h-5" />, color: 'text-purple-600', bgColor: 'bg-purple-600' },
    { id: 'inventory', label: 'المخزون', icon: <Package className="w-5 h-5" />, color: 'text-emerald-600', bgColor: 'bg-emerald-600' },
    { id: 'deliveries', label: 'التسليم', icon: <Truck className="w-5 h-5" />, color: 'text-blue-600', bgColor: 'bg-blue-600' },
    { id: 'movements', label: 'الحركات', icon: <ArrowUpDown className="w-5 h-5" />, color: 'text-amber-500', bgColor: 'bg-amber-500' },
    { id: 'purchase-returns', label: 'المرتجعات', icon: <RotateCcw className="w-5 h-5" />, color: 'text-red-500', bgColor: 'bg-red-500' },
    { id: 'purchases', label: 'المشتريات', icon: <ShoppingCart className="w-5 h-5" />, color: 'text-orange-500', bgColor: 'bg-orange-500' },
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
        <div className="px-4 pb-4">
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
    </div>
  );
};

export default WarehouseKeeperDashboard;
