import React, { useState, useEffect } from 'react';
import { generateUUID } from '@/lib/uuid';
import { 
  RotateCcw, 
  FileText,
  Package,
  Check,
  Loader2,
  X,
  AlertCircle,
  Search,
  User,
  Plus,
  Minus,
  Printer,
  WifiOff
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Customer } from '@/types';
import InvoicePrint from './InvoicePrint';
import FullScreenModal from '@/components/ui/FullScreenModal';
import type { OfflineActionType, CachedSale } from '../services/distributorOfflineService';

interface ReturnCartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  max_quantity: number;
}

interface SalesReturnTabProps {
  selectedCustomer: Customer | null;
  onQueueAction: (type: OfflineActionType, payload: any, inventoryUpdates?: { productId: string; quantityDelta: number }[]) => Promise<any>;
  isOnline: boolean;
  localSales: CachedSale[];
}

const SalesReturnTab: React.FC<SalesReturnTabProps> = ({ selectedCustomer, onQueueAction, isOnline, localSales }) => {
  const { addNotification } = useApp();
  const [selectedSaleId, setSelectedSaleId] = useState<string>('');
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [cart, setCart] = useState<ReturnCartItem[]>([]);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showSalePicker, setShowSalePicker] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [searchSale, setSearchSale] = useState('');
  const [searchProduct, setSearchProduct] = useState('');

  // Print state
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [lastReturnData, setLastReturnData] = useState<{
    id: string;
    customerName: string;
    items: { product_name: string; quantity: number; unit_price: number; total_price: number }[];
    grandTotal: number;
    reason?: string;
  } | null>(null);

  // Filter sales for the selected customer only (non-voided)
  const customerSales = localSales.filter(s => 
    !s.isVoided && 
    selectedCustomer && 
    s.customer_id === selectedCustomer.id
  );

  const filteredSales = customerSales.filter(s =>
    s.customerName.toLowerCase().includes(searchSale.toLowerCase())
  );

  const selectedSale = localSales.find(s => s.id === selectedSaleId);

  const loadSaleItems = async (saleId: string) => {
    setLoadingItems(true);
    try {
      // Fetch sale items and previous returns in parallel
      const [itemsRes, returnsRes] = await Promise.all([
        supabase.from('sale_items').select('*').eq('sale_id', saleId),
        supabase.from('sales_return_items').select('product_id, quantity, return_id, sales_returns!inner(sale_id)').eq('sales_returns.sale_id', saleId)
      ]);

      if (itemsRes.error) throw itemsRes.error;
      
      // Calculate already returned quantities per product
      const returnedQtyMap: Record<string, number> = {};
      if (returnsRes.data) {
        for (const ri of returnsRes.data) {
          returnedQtyMap[ri.product_id] = (returnedQtyMap[ri.product_id] || 0) + ri.quantity;
        }
      }

      // Adjust available quantity by subtracting already returned
      const adjustedItems = (itemsRes.data || []).map(item => ({
        ...item,
        quantity: item.quantity - (returnedQtyMap[item.product_id] || 0)
      })).filter(item => item.quantity > 0);

      setSaleItems(adjustedItems);
    } catch (err) {
      console.error('Error loading sale items:', err);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleSelectSale = (saleId: string) => {
    setSelectedSaleId(saleId);
    setCart([]);
    loadSaleItems(saleId);
    setShowSalePicker(false);
    setSearchSale('');
  };

  const clearSale = () => {
    setSelectedSaleId('');
    setSaleItems([]);
    setCart([]);
  };

  // Available products = sale items not yet in the cart
  const availableProducts = saleItems.filter(
    item => !cart.find(c => c.product_id === item.product_id)
  );

  const filteredProducts = availableProducts.filter(p =>
    p.product_name.toLowerCase().includes(searchProduct.toLowerCase())
  );

  const addToCart = (item: any) => {
    setCart([...cart, {
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: 1,
      unit_price: Number(item.unit_price),
      max_quantity: item.quantity
    }]);
    setShowProductPicker(false);
    setSearchProduct('');
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.product_id === productId) {
        const newQty = item.quantity + delta;
        if (newQty <= 0 || newQty > item.max_quantity) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  const grandTotal = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  const handleCreateReturn = async () => {
    if (!selectedSaleId || cart.length === 0) return;

    setLoading(true);
    try {
      const items = cart.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price
      }));

      // Optimistic inventory updates: returned items go back to distributor inventory
      const inventoryUpdates = cart.map(item => ({
        productId: item.product_id,
        quantityDelta: item.quantity, // positive = restore stock
      }));

      // Queue offline action instead of direct RPC
      await onQueueAction('CREATE_RETURN', {
        saleId: selectedSaleId,
        items,
        reason: reason || null,
      }, inventoryUpdates);

      setLastReturnData({
        id: generateUUID(),
        customerName: selectedSale?.customerName || '',
        items: cart.map(item => ({
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price
        })),
        grandTotal,
        reason: reason || undefined
      });

      clearSale();
      setReason('');
      setSuccess(true);
      setShowPrintModal(true);

      addNotification(
        isOnline ? 'تم إنشاء المرتجع بنجاح' : 'تم حفظ المرتجع — ستتم المزامنة عند عودة الإنترنت',
        'success'
      );
    } catch (err: any) {
      addNotification(err.message || 'حدث خطأ أثناء إنشاء المرتجع', 'error');
    } finally {
      setLoading(false);
    }
  };

  const closePrintModal = () => {
    setShowPrintModal(false);
    setSuccess(false);
    setLastReturnData(null);
  };

  return (
    <div className="p-5 space-y-5">
      {/* Print Modal */}
      {showPrintModal && lastReturnData && (
        <InvoicePrint
          invoiceType="return"
          invoiceId={lastReturnData.id}
          customerName={lastReturnData.customerName}
          date={new Date()}
          items={lastReturnData.items}
          grandTotal={lastReturnData.grandTotal}
          notes={lastReturnData.reason}
          onClose={closePrintModal}
        />
      )}

      {/* Success Message */}
      {success && !showPrintModal && (
        <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 p-4 rounded-2xl flex items-center gap-2 border border-emerald-500/20">
          <Check className="w-5 h-5" />
          <span className="font-bold">تم إنشاء المرتجع بنجاح!</span>
          {!isOnline && (
            <span className="text-xs text-muted-foreground mr-auto flex items-center gap-1">
              <WifiOff className="w-3 h-3" /> محفوظة محلياً
            </span>
          )}
        </div>
      )}

      {/* No Customer Selected Warning */}
      {!selectedCustomer && (
        <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 p-4 rounded-2xl flex items-center gap-2 border border-amber-500/20">
          <AlertCircle className="w-5 h-5" />
          <span className="font-bold">يرجى اختيار زبون من القائمة أعلاه</span>
        </div>
      )}

      {/* Selected Customer Info */}
      {selectedCustomer && (
        <div className="bg-orange-500/10 rounded-2xl p-4 flex items-center gap-3 border border-orange-500/20">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-foreground">{selectedCustomer.name}</p>
            <p className="text-sm text-muted-foreground">
              الرصيد: {Number(selectedCustomer.balance).toLocaleString('ar-SA')} ل.س
            </p>
          </div>
        </div>
      )}

      {/* Step 1: Select Invoice */}
      {selectedCustomer && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-foreground">الفاتورة</h3>
            {!selectedSaleId && (
              <button
                onClick={() => setShowSalePicker(true)}
                className="flex items-center gap-1.5 text-orange-600 font-bold text-sm hover:text-orange-700"
              >
                <FileText className="w-4 h-4" />
                اختر فاتورة
              </button>
            )}
          </div>

          {selectedSale ? (
            <div className="bg-muted rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center">
                    <FileText className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{selectedSale.customerName}</p>
                    <p className="text-sm text-muted-foreground">
                      {Number(selectedSale.grandTotal).toLocaleString('ar-SA')} ل.س — {new Date(selectedSale.timestamp).toLocaleDateString('ar-SA')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={clearSale}
                  className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowSalePicker(true)}
              className="w-full bg-muted rounded-2xl p-6 text-center hover:bg-accent transition-colors"
            >
              <div className="w-14 h-14 bg-card rounded-2xl mx-auto mb-3 flex items-center justify-center shadow-sm">
                <FileText className="w-7 h-7 text-muted-foreground/30" />
              </div>
              <p className="text-muted-foreground font-bold">اضغط لاختيار فاتورة للإرجاع</p>
            </button>
          )}
        </div>
      )}

      {/* Step 2: Return Items (cart) */}
      {selectedSaleId && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-foreground">الأصناف المرتجعة</h3>
            <button
              onClick={() => setShowProductPicker(true)}
              className="flex items-center gap-1.5 text-orange-600 font-bold text-sm hover:text-orange-700"
              disabled={availableProducts.length === 0}
            >
              <Plus className="w-4 h-4" />
              إضافة مادة
            </button>
          </div>

          {cart.length === 0 ? (
            <div className="bg-muted rounded-3xl p-8 text-center">
              <div className="w-20 h-20 bg-card rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-sm">
                <RotateCcw className="w-10 h-10 text-muted-foreground/30" />
              </div>
              <p className="text-muted-foreground font-bold">لم تتم إضافة أصناف للمرتجع</p>
              <p className="text-muted-foreground/60 text-sm mt-1">اضغط "إضافة مادة" لاختيار الأصناف</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.product_id} className="bg-muted rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-foreground">{item.product_name}</span>
                    <button
                      onClick={() => removeFromCart(item.product_id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 bg-card rounded-xl p-1">
                      <button
                        onClick={() => updateQuantity(item.product_id, -1)}
                        className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center hover:bg-accent"
                      >
                        <Minus className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <span className="font-black w-8 text-center text-lg text-foreground">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product_id, 1)}
                        className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center hover:bg-orange-600"
                      >
                        <Plus className="w-4 h-4 text-white" />
                      </button>
                    </div>
                    <div className="text-end">
                      <span className="font-black text-orange-600 text-lg">
                        {(item.quantity * item.unit_price).toLocaleString('ar-SA')}
                      </span>
                      <p className="text-xs text-muted-foreground">الحد الأقصى: {item.max_quantity}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Reason & Total & Submit */}
      {cart.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-border">
          {/* Reason */}
          <div>
            <label className="text-xs font-black text-muted-foreground uppercase mb-2 block">سبب الإرجاع (اختياري)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: بضاعة تالفة"
              className="w-full bg-muted border-none rounded-2xl px-5 py-4 font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="font-bold text-muted-foreground">إجمالي المرتجع</span>
            <span className="font-black text-orange-600 text-2xl">
              {grandTotal.toLocaleString('ar-SA')} ل.س
            </span>
          </div>

          <button
            onClick={handleCreateReturn}
            disabled={loading}
            className="w-full bg-orange-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none hover:bg-orange-600 transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                جارٍ الحفظ...
              </>
            ) : (
              <>
                <RotateCcw className="w-5 h-5" />
                تأكيد المرتجع
                {!isOnline && <WifiOff className="w-4 h-4 opacity-60" />}
              </>
            )}
          </button>
        </div>
      )}

      {/* Sale Picker Modal */}
      <FullScreenModal
        isOpen={showSalePicker}
        onClose={() => setShowSalePicker(false)}
        title="اختر الفاتورة"
        icon={<FileText size={24} />}
        headerColor="warning"
      >
        <div className="relative mb-4">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="بحث عن فاتورة..."
            value={searchSale}
            onChange={(e) => setSearchSale(e.target.value)}
            className="w-full bg-muted border border-border rounded-xl px-12 py-4 font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 text-base"
          />
        </div>

        <div className="space-y-2">
          {filteredSales.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="w-20 h-20 mx-auto mb-4 opacity-30" />
              <p className="font-bold text-lg mb-2">لا توجد فواتير</p>
              <p className="text-sm">لا توجد فواتير لهذا الزبون</p>
            </div>
          ) : (
            filteredSales.map((sale) => (
              <button
                key={sale.id}
                onClick={() => handleSelectSale(sale.id)}
                className="w-full text-start p-5 bg-muted rounded-2xl hover:bg-muted/80 transition-colors active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-foreground text-lg">{sale.customerName}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(sale.timestamp).toLocaleDateString('ar-SA')}
                    </p>
                  </div>
                  <span className="font-black text-primary text-lg">
                    {Number(sale.grandTotal).toLocaleString('ar-SA')} ل.س
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </FullScreenModal>

      {/* Product Picker Modal */}
      <FullScreenModal
        isOpen={showProductPicker}
        onClose={() => setShowProductPicker(false)}
        title="اختر المادة للإرجاع"
        icon={<Package size={24} />}
        headerColor="warning"
      >
        <div className="relative mb-4">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="بحث عن مادة..."
            value={searchProduct}
            onChange={(e) => setSearchProduct(e.target.value)}
            className="w-full bg-muted border border-border rounded-xl px-12 py-4 font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 text-base"
          />
        </div>

        <div className="space-y-2">
          {loadingItems ? (
            <div className="text-center py-16">
              <Loader2 className="w-10 h-10 mx-auto mb-4 animate-spin text-primary" />
              <p className="text-muted-foreground font-bold">جارٍ التحميل...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="w-20 h-20 mx-auto mb-4 opacity-30" />
              <p className="font-bold text-lg mb-2">لا توجد مواد متاحة</p>
              <p className="text-sm">تمت إضافة جميع المواد أو لا توجد مواد في هذه الفاتورة</p>
            </div>
          ) : (
            filteredProducts.map((item: any) => (
              <button
                key={item.product_id}
                onClick={() => addToCart(item)}
                className="w-full text-start p-5 bg-muted rounded-2xl hover:bg-muted/80 transition-colors active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-foreground text-lg">{item.product_name}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      الكمية: {item.quantity} | السعر: {Number(item.unit_price).toLocaleString('ar-SA')} ل.س
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <Plus className="w-5 h-5 text-orange-500" />
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </FullScreenModal>
    </div>
  );
};

export default SalesReturnTab;
