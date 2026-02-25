import React, { useState, useEffect } from 'react';
import { generateUUID } from '@/lib/uuid';
import { 
  Plus, 
  Minus, 
  ShoppingBag, 
  User, 
  Search,
  X,
  Check,
  Loader2,
  Package,
  AlertCircle,
  WifiOff
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Customer } from '@/types';
import InvoicePrint from './InvoicePrint';
import FullScreenModal from '@/components/ui/FullScreenModal';
import type { CachedInventoryItem } from '../services/distributorOfflineService';

interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  consumer_price: number;
  unit: string;
}

interface NewSaleTabProps {
  selectedCustomer: Customer | null;
  localInventory: CachedInventoryItem[];
  onQueueAction: (type: any, payload: any, inventoryUpdates?: { productId: string; quantityDelta: number }[]) => Promise<any>;
  isOnline: boolean;
}

type PaymentType = 'CASH' | 'CREDIT';

const NewSaleTab: React.FC<NewSaleTabProps> = ({ selectedCustomer, localInventory, onQueueAction, isOnline }) => {
  const { addNotification } = useApp();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [paymentType, setPaymentType] = useState<PaymentType>('CREDIT');
  
  // Print state
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [lastSaleData, setLastSaleData] = useState<{
    id: string;
    customerName: string;
    items: CartItem[];
    grandTotal: number;
    paymentType: PaymentType;
  } | null>(null);

  // Use local cached inventory (offline-first)
  const activeProducts = localInventory.filter(p => p.quantity > 0);
  
  const filteredProducts = activeProducts.filter(p =>
    p.product_name.toLowerCase().includes(searchProduct.toLowerCase())
  );

  const addToCart = (product: CachedInventoryItem) => {
    const existing = cart.find(item => item.product_id === product.product_id);
    if (existing) {
      if (existing.quantity < product.quantity) {
        setCart(cart.map(item =>
          item.product_id === product.product_id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ));
      }
    } else {
      setCart([...cart, {
        product_id: product.product_id,
        product_name: product.product_name,
        quantity: 1,
        unit_price: product.base_price,
        consumer_price: product.consumer_price,
        unit: product.unit
      }]);
    }
    setShowProductPicker(false);
    setSearchProduct('');
  };

  const updateQuantity = (productId: string, delta: number) => {
    const product = localInventory.find(p => p.product_id === productId);
    setCart(cart.map(item => {
      if (item.product_id === productId) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return item;
        if (product && newQty > product.quantity) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  const grandTotal = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  const handleCreateSale = async () => {
    if (!selectedCustomer?.id || cart.length === 0) return;

    setLoading(true);
    try {
      const saleItems = cart.map(item => ({
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        totalPrice: item.quantity * item.unit_price
      }));

      // Inventory updates: deduct quantities locally
      const inventoryUpdates = cart.map(item => ({
        productId: item.product_id,
        quantityDelta: -item.quantity,
      }));

      await onQueueAction('CREATE_SALE', {
        customerId: selectedCustomer.id,
        items: saleItems,
        paymentType,
      }, inventoryUpdates);

      // Store sale data for printing
      setLastSaleData({
        id: generateUUID(),
        customerName: selectedCustomer.name,
        items: [...cart],
        grandTotal,
        paymentType
      });
      
      setCart([]);
      setPaymentType('CREDIT');
      setSuccess(true);
      setShowPrintModal(true);
      
      addNotification(
        isOnline ? 'تم إنشاء الفاتورة بنجاح' : 'تم حفظ الفاتورة — ستتم المزامنة عند عودة الإنترنت',
        'success'
      );
    } catch (error) {
      console.error('Error creating sale:', error);
      addNotification('حدث خطأ أثناء حفظ الفاتورة', 'error');
    } finally {
      setLoading(false);
    }
  };

  const closePrintModal = () => {
    setShowPrintModal(false);
    setSuccess(false);
    setLastSaleData(null);
  };

  return (
    <div className="p-5 space-y-5">
      {/* Print Modal */}
      {showPrintModal && lastSaleData && (
        <InvoicePrint
          invoiceType="sale"
          invoiceId={lastSaleData.id}
          customerName={lastSaleData.customerName}
          date={new Date()}
          items={lastSaleData.items.map(item => ({
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.quantity * item.unit_price,
            consumer_price: item.consumer_price,
            unit: item.unit
          }))}
          grandTotal={lastSaleData.grandTotal}
          paidAmount={lastSaleData.paymentType === 'CASH' ? lastSaleData.grandTotal : 0}
          remaining={lastSaleData.paymentType === 'CASH' ? 0 : lastSaleData.grandTotal}
          paymentType={lastSaleData.paymentType}
          onClose={closePrintModal}
        />
      )}

      {/* Success Message */}
      {success && !showPrintModal && (
        <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 p-4 rounded-2xl flex items-center gap-2 border border-emerald-500/20">
          <Check className="w-5 h-5" />
          <span className="font-bold">تم إنشاء الفاتورة بنجاح!</span>
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
        <div className="bg-blue-500/10 rounded-2xl p-4 flex items-center gap-3 border border-blue-500/20">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
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

      {/* Section Title */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-foreground">الأصناف المطلوبة</h3>
        <button
          onClick={() => setShowProductPicker(true)}
          className="flex items-center gap-1.5 text-blue-600 font-bold text-sm hover:text-blue-700"
          disabled={!selectedCustomer}
        >
          <Plus className="w-4 h-4" />
          إضافة مادة
        </button>
      </div>

      {/* Cart Items or Empty State */}
      {cart.length === 0 ? (
        <div className="bg-muted rounded-3xl p-8 text-center">
          <div className="w-20 h-20 bg-card rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-sm">
            <ShoppingBag className="w-10 h-10 text-muted-foreground/30" />
          </div>
          <p className="text-muted-foreground font-bold">السلة فارغة</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cart.map((item) => (
            <div key={item.product_id} className="bg-muted rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-foreground">{item.product_name}</span>
                <button onClick={() => removeFromCart(item.product_id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 bg-card rounded-xl p-1">
                  <button onClick={() => updateQuantity(item.product_id, -1)} className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center hover:bg-accent">
                    <Minus className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <span className="font-black w-8 text-center text-lg text-foreground">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.product_id, 1)} className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-700">
                    <Plus className="w-4 h-4 text-white" />
                  </button>
                </div>
                <span className="font-black text-blue-600 text-lg">
                  {(item.quantity * item.unit_price).toLocaleString('ar-SA')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Total & Submit */}
      {cart.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-border">
          {/* Payment Type Selection */}
          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">نوع الدفع</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setPaymentType('CASH')}
                className={`py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all border-2 ${
                  paymentType === 'CASH'
                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/30'
                    : 'bg-muted text-muted-foreground border-border hover:border-emerald-300'
                }`}>
                💵 نقداً
              </button>
              <button type="button" onClick={() => setPaymentType('CREDIT')}
                className={`py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all border-2 ${
                  paymentType === 'CREDIT'
                    ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/30'
                    : 'bg-muted text-muted-foreground border-border hover:border-orange-300'
                }`}>
                📝 آجل
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-bold text-muted-foreground">الإجمالي</span>
            <span className="font-black text-blue-600 text-2xl">
              {grandTotal.toLocaleString('ar-SA')} ل.س
            </span>
          </div>
          <button onClick={handleCreateSale} disabled={loading || !selectedCustomer}
            className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none hover:bg-blue-700 transition-all">
            {loading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> جارٍ الحفظ...</>
            ) : (
              <><Check className="w-5 h-5" /> تأكيد الفاتورة {!isOnline && <WifiOff className="w-4 h-4 opacity-60" />}</>
            )}
          </button>
        </div>
      )}

      {/* Product Picker Modal */}
      <FullScreenModal isOpen={showProductPicker} onClose={() => setShowProductPicker(false)}
        title="اختر المادة" icon={<Package size={24} />} headerColor="primary">
        <div className="relative mb-4">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input type="text" placeholder="بحث عن مادة..." value={searchProduct}
            onChange={(e) => setSearchProduct(e.target.value)}
            className="w-full bg-muted border border-border rounded-xl px-12 py-4 font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 text-base" />
        </div>
        
        <div className="space-y-2">
          {activeProducts.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="w-20 h-20 mx-auto mb-4 opacity-30" />
              <p className="font-bold text-lg mb-2">لا توجد مواد متاحة</p>
              <p className="text-sm">تواصل مع صاحب المنشأة لاستلام بضاعة</p>
            </div>
          ) : (
            filteredProducts.map((product) => (
              <button key={product.product_id} onClick={() => addToCart(product)}
                className="w-full text-start p-5 bg-muted rounded-2xl hover:bg-muted/80 transition-colors active:scale-[0.98]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-foreground text-lg">{product.product_name}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      المتوفر: {product.quantity} | السعر: {product.base_price.toLocaleString('ar-SA')} ل.س
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Plus className="w-5 h-5 text-primary" />
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

export default NewSaleTab;
