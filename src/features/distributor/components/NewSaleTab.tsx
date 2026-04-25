import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { generateUUID } from '@/lib/uuid';
import { 
  Plus, Minus, ShoppingBag, User, Search, X, Check, Loader2,
  Package, AlertCircle, WifiOff, Percent, Tag, Box, Layers
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Customer } from '@/types';
import { CURRENCY } from '@/constants';
import InvoicePrint from './InvoicePrint';
import FullScreenModal from '@/components/ui/FullScreenModal';
import type { CachedInventoryItem } from '../services/distributorOfflineService';

interface CartItem {
  product_id: string;
  product_name: string;
  /** Total pieces (= packs * units_per_pack + loose pieces) */
  quantity: number;
  /** Number of full packs */
  pack_quantity: number;
  /** Loose pieces in addition to packs */
  piece_quantity: number;
  /** Pieces per pack snapshot */
  units_per_pack: number;
  /** Price per single piece (always) */
  unit_price: number;
  /** Price per full pack */
  pack_price: number;
  consumer_price: number;
  unit: string;
  /** Whether this item allows pack/piece sales */
  allow_pack_sales: boolean;
  allow_piece_sales: boolean;
}

interface NewSaleTabProps {
  selectedCustomer: Customer | null;
  localInventory: CachedInventoryItem[];
  onQueueAction: (type: any, payload: any, inventoryUpdates?: { productId: string; quantityDelta: number }[]) => Promise<any>;
  isOnline: boolean;
}

type PaymentType = 'CASH' | 'CREDIT';
type DiscountType = 'percentage' | 'fixed' | null;

// Compute total pieces from packs + loose pieces
const totalPieces = (packs: number, loose: number, upp: number) =>
  Math.max(0, packs) * Math.max(1, upp) + Math.max(0, loose);

// Compute total price for cart line
const lineTotal = (item: CartItem) =>
  item.pack_quantity * item.pack_price + item.piece_quantity * item.unit_price;

// ─── Memoized cart row with pack/piece inputs ───
const CartRow = React.memo<{
  item: CartItem;
  locale: string;
  onUpdatePacks: (productId: string, delta: number) => void;
  onUpdatePieces: (productId: string, delta: number) => void;
  onRemove: (productId: string) => void;
}>(({ item, locale, onUpdatePacks, onUpdatePieces, onRemove }) => {
  const hasPacks = item.units_per_pack > 1 && item.allow_pack_sales;
  const total = lineTotal(item);

  return (
    <div className="bg-muted rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="min-w-0 flex-1">
          <span className="font-bold text-foreground block truncate">{item.product_name}</span>
          {hasPacks && (
            <span className="text-[10px] text-muted-foreground font-bold">
              الطرد = {item.units_per_pack} قطعة
            </span>
          )}
        </div>
        <button onClick={() => onRemove(item.product_id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Packs row */}
      {hasPacks && (
        <div className="flex items-center justify-between mb-2 bg-card rounded-xl p-2">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-primary" />
            <span className="text-xs font-black text-foreground">طرود</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onUpdatePacks(item.product_id, -1)} className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
              <Minus className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <span className="font-black w-7 text-center text-base text-foreground">{item.pack_quantity}</span>
            <button onClick={() => onUpdatePacks(item.product_id, 1)} className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Plus className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Pieces row */}
      {item.allow_piece_sales && (
        <div className="flex items-center justify-between mb-2 bg-card rounded-xl p-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-success" />
            <span className="text-xs font-black text-foreground">قطع</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onUpdatePieces(item.product_id, -1)} className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
              <Minus className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <span className="font-black w-7 text-center text-base text-foreground">{item.piece_quantity}</span>
            <button onClick={() => onUpdatePieces(item.product_id, 1)} className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Plus className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <span className="text-xs text-muted-foreground font-bold">
          إجمالي: {item.quantity} قطعة
        </span>
        <span className="font-black text-blue-600 text-lg">
          {total.toLocaleString(locale)} {CURRENCY}
        </span>
      </div>
    </div>
  );
}, (prev, next) =>
  prev.item.product_id === next.item.product_id &&
  prev.item.pack_quantity === next.item.pack_quantity &&
  prev.item.piece_quantity === next.item.piece_quantity &&
  prev.item.unit_price === next.item.unit_price &&
  prev.item.pack_price === next.item.pack_price &&
  prev.locale === next.locale
);
CartRow.displayName = 'CartRow';

const NewSaleTab: React.FC<NewSaleTabProps> = ({ selectedCustomer, localInventory, onQueueAction, isOnline }) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
  const { addNotification } = useApp();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [paymentType, setPaymentType] = useState<PaymentType>('CREDIT');
  const [discountType, setDiscountType] = useState<DiscountType>(null);
  const [discountInput, setDiscountInput] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [lastSaleData, setLastSaleData] = useState<any | null>(null);

  const activeProducts = useMemo(() => localInventory.filter(p => p.quantity > 0), [localInventory]);
  const filteredProducts = useMemo(
    () => {
      const q = searchProduct.toLowerCase();
      return q ? activeProducts.filter(p => p.product_name.toLowerCase().includes(q)) : activeProducts;
    },
    [activeProducts, searchProduct]
  );

  const addToCart = useCallback((product: CachedInventoryItem) => {
    setCart(prev => {
      if (prev.find(item => item.product_id === product.product_id)) return prev;
      const upp = Math.max(1, product.units_per_pack ?? 1);
      const allowPack = Boolean(product.allow_pack_sales) && upp > 1;
      const allowPiece = product.allow_piece_sales !== false;
      // Default add: 1 pack if pack-only, else 1 piece
      const initialPack = allowPack && !allowPiece ? 1 : 0;
      const initialPiece = allowPiece ? 1 : 0;
      return [...prev, {
        product_id: product.product_id,
        product_name: product.product_name,
        pack_quantity: initialPack,
        piece_quantity: initialPiece,
        units_per_pack: upp,
        quantity: totalPieces(initialPack, initialPiece, upp),
        unit_price: product.base_price,
        pack_price: product.pack_price ?? (product.base_price * upp),
        consumer_price: product.consumer_price,
        unit: product.unit,
        allow_pack_sales: allowPack,
        allow_piece_sales: allowPiece,
      }];
    });
    setShowProductPicker(false);
    setSearchProduct('');
  }, []);

  const updatePacks = useCallback((productId: string, delta: number) => {
    const product = localInventory.find(p => p.product_id === productId);
    setCart(prev => prev.map(item => {
      if (item.product_id !== productId) return item;
      const newPacks = Math.max(0, item.pack_quantity + delta);
      const newQty = totalPieces(newPacks, item.piece_quantity, item.units_per_pack);
      if (product && newQty > product.quantity) return item;
      return { ...item, pack_quantity: newPacks, quantity: newQty };
    }).filter(i => i.quantity > 0));
  }, [localInventory]);

  const updatePieces = useCallback((productId: string, delta: number) => {
    const product = localInventory.find(p => p.product_id === productId);
    setCart(prev => prev.map(item => {
      if (item.product_id !== productId) return item;
      const newPieces = Math.max(0, item.piece_quantity + delta);
      const newQty = totalPieces(item.pack_quantity, newPieces, item.units_per_pack);
      if (product && newQty > product.quantity) return item;
      return { ...item, piece_quantity: newPieces, quantity: newQty };
    }).filter(i => i.quantity > 0));
  }, [localInventory]);

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter(item => item.product_id !== productId));
  }, []);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + lineTotal(item), 0),
    [cart]
  );
  const discountPercentage = discountType === 'percentage' ? Math.min(100, Math.max(0, Number(discountInput) || 0)) : 
    subtotal > 0 ? ((Number(discountInput) || 0) / subtotal) * 100 : 0;
  const discountValue = discountType === 'percentage' 
    ? subtotal * (discountPercentage / 100)
    : Math.min(subtotal, Math.max(0, Number(discountInput) || 0));
  const grandTotal = Math.max(0, subtotal - discountValue);

  const handleCreateSale = async () => {
    if (!selectedCustomer?.id || cart.length === 0) return;
    setLoading(true);
    try {
      const saleItems = cart.map(item => {
        const total = lineTotal(item);
        const sold_unit = item.pack_quantity > 0 && item.piece_quantity > 0
          ? 'MIXED'
          : item.pack_quantity > 0 ? 'PACK' : 'PIECE';
        return {
          productId: item.product_id,
          productName: item.product_name,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          totalPrice: total,
          packQuantity: item.pack_quantity,
          pieceQuantity: item.piece_quantity,
          unitsPerPackSnapshot: item.units_per_pack,
          soldUnit: sold_unit,
        };
      });
      const inventoryUpdates = cart.map(item => ({ productId: item.product_id, quantityDelta: -item.quantity }));

      await onQueueAction('CREATE_SALE', {
        customerId: selectedCustomer.id, items: saleItems, paymentType,
        discountType: discountType || undefined, discountPercentage: discountPercentage || 0, discountValue: discountValue || 0,
      }, inventoryUpdates);

      setLastSaleData({
        id: generateUUID(), customerName: selectedCustomer.name, items: [...cart],
        grandTotal, subtotal, discountType, discountPercentage, discountValue, paymentType
      });
      setCart([]); setPaymentType('CREDIT'); setDiscountType(null); setDiscountInput('');
      setSuccess(true); setShowPrintModal(true);
      addNotification(isOnline ? t('invoice.invoiceCreated') : t('invoice.invoiceCreatedOffline'), 'success');
    } catch (error) {
      console.error('Error creating sale:', error);
      addNotification(t('invoice.invoiceError'), 'error');
    } finally { setLoading(false); }
  };

  const closePrintModal = () => { setShowPrintModal(false); setSuccess(false); setLastSaleData(null); };

  return (
    <div className="p-5 space-y-5">
      {showPrintModal && lastSaleData && (
        <InvoicePrint
          invoiceType="sale" invoiceId={lastSaleData.id} customerName={lastSaleData.customerName}
          date={new Date()}
          items={lastSaleData.items.map((item: CartItem) => ({
            product_name: item.product_name, quantity: item.quantity, unit_price: item.unit_price,
            total_price: lineTotal(item), consumer_price: item.consumer_price, unit: item.unit
          }))}
          grandTotal={lastSaleData.grandTotal} subtotal={lastSaleData.subtotal}
          discountType={lastSaleData.discountType} discountPercentage={lastSaleData.discountPercentage}
          discountValue={lastSaleData.discountValue}
          paidAmount={lastSaleData.paymentType === 'CASH' ? lastSaleData.grandTotal : 0}
          remaining={lastSaleData.paymentType === 'CASH' ? 0 : lastSaleData.grandTotal}
          paymentType={lastSaleData.paymentType} onClose={closePrintModal}
        />
      )}

      {success && !showPrintModal && (
        <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 p-4 rounded-2xl flex items-center gap-2 border border-emerald-500/20">
          <Check className="w-5 h-5" />
          <span className="font-bold">{t('distributorSale.invoiceCreatedSuccess')}</span>
          {!isOnline && (
            <span className="text-xs text-muted-foreground ms-auto flex items-center gap-1">
              <WifiOff className="w-3 h-3" /> {t('distributorSale.savedLocally')}
            </span>
          )}
        </div>
      )}

      {!selectedCustomer && (
        <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 p-4 rounded-2xl flex items-center gap-2 border border-amber-500/20">
          <AlertCircle className="w-5 h-5" />
          <span className="font-bold">{t('distributorSale.selectCustomerWarning')}</span>
        </div>
      )}

      {selectedCustomer && (
        <div className="bg-blue-500/10 rounded-2xl p-4 flex items-center gap-3 border border-blue-500/20">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-foreground">{selectedCustomer.name}</p>
            <p className="text-sm text-muted-foreground">
              {t('distributorSale.balance')} {Number(selectedCustomer.balance).toLocaleString(locale)} {CURRENCY}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-foreground">{t('distributorSale.requiredItems')}</h3>
        <button onClick={() => setShowProductPicker(true)}
          className="flex items-center gap-1.5 text-blue-600 font-bold text-sm hover:text-blue-700"
          disabled={!selectedCustomer}>
          <Plus className="w-4 h-4" /> {t('distributorSale.addItem')}
        </button>
      </div>

      {cart.length === 0 ? (
        <div className="bg-muted rounded-3xl p-8 text-center">
          <div className="w-20 h-20 bg-card rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-sm">
            <ShoppingBag className="w-10 h-10 text-muted-foreground/30" />
          </div>
          <p className="text-muted-foreground font-bold">{t('distributorSale.emptyCart')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cart.map((item) => (
            <CartRow
              key={item.product_id}
              item={item}
              locale={locale}
              onUpdatePacks={updatePacks}
              onUpdatePieces={updatePieces}
              onRemove={removeFromCart}
            />
          ))}
        </div>
      )}

      {cart.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">{t('distributorSale.paymentType')}</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setPaymentType('CASH')}
                className={`py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all border-2 ${
                  paymentType === 'CASH' ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/30' : 'bg-muted text-muted-foreground border-border hover:border-emerald-300'
                }`}>{t('distributorSale.cashPayment')}</button>
              <button type="button" onClick={() => setPaymentType('CREDIT')}
                className={`py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all border-2 ${
                  paymentType === 'CREDIT' ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/30' : 'bg-muted text-muted-foreground border-border hover:border-orange-300'
                }`}>{t('distributorSale.creditPayment')}</button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">{t('distributorSale.discountOptional')}</label>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => { setDiscountType(null); setDiscountInput(''); }}
                className={`py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all border-2 ${
                  discountType === null ? 'bg-muted border-primary text-primary' : 'bg-muted text-muted-foreground border-border'
                }`}>{t('distributorSale.noDiscount')}</button>
              <button type="button" onClick={() => { setDiscountType('percentage'); setDiscountInput(''); }}
                className={`py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all border-2 ${
                  discountType === 'percentage' ? 'bg-purple-500 text-white border-purple-500 shadow-lg' : 'bg-muted text-muted-foreground border-border'
                }`}><Percent className="w-3.5 h-3.5" /> {t('distributorSale.percentage')}</button>
              <button type="button" onClick={() => { setDiscountType('fixed'); setDiscountInput(''); }}
                className={`py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all border-2 ${
                  discountType === 'fixed' ? 'bg-purple-500 text-white border-purple-500 shadow-lg' : 'bg-muted text-muted-foreground border-border'
                }`}><Tag className="w-3.5 h-3.5" /> {t('distributorSale.fixedAmount')}</button>
            </div>
            {discountType && (
              <div className="relative">
                <input type="number" inputMode="decimal" min="0"
                  max={discountType === 'percentage' ? '100' : String(subtotal)}
                  value={discountInput} onChange={(e) => setDiscountInput(e.target.value)}
                  placeholder={discountType === 'percentage' ? t('invoice.discountPercentPlaceholder') : t('invoice.discountFixedPlaceholder')}
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-base" />
                <span className="absolute start-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-bold">
                  {discountType === 'percentage' ? '%' : CURRENCY}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {discountValue > 0 && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('distributorSale.subtotalBeforeDiscount')}</span>
                  <span className="font-bold text-foreground">{subtotal.toLocaleString(locale)} {CURRENCY}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-purple-600 dark:text-purple-400 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5" />
                    {t('distributorSale.discount')} {discountType === 'percentage' ? `(${discountPercentage.toFixed(1)}%)` : ''}
                  </span>
                  <span className="font-bold text-purple-600 dark:text-purple-400">-{discountValue.toLocaleString(locale)} {CURRENCY}</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between">
              <span className="font-bold text-muted-foreground">{t('distributorSale.netTotal')}</span>
              <span className="font-black text-blue-600 text-2xl">
                {grandTotal.toLocaleString(locale)} {CURRENCY}
              </span>
            </div>
          </div>

          <button onClick={handleCreateSale} disabled={loading || !selectedCustomer}
            className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none hover:bg-blue-700 transition-all">
            {loading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> {t('distributorSale.saving')}</>
            ) : (
              <><Check className="w-5 h-5" /> {t('distributorSale.confirmInvoice')} {!isOnline && <WifiOff className="w-4 h-4 opacity-60" />}</>
            )}
          </button>
        </div>
      )}

      <FullScreenModal isOpen={showProductPicker} onClose={() => setShowProductPicker(false)}
        title={t('distributorSale.chooseItem')} icon={<Package size={24} />} headerColor="primary">
        <div className="relative mb-4">
          <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input type="text" placeholder={t('distributorSale.searchProduct')} value={searchProduct}
            onChange={(e) => setSearchProduct(e.target.value)}
            className="w-full bg-muted border border-border rounded-xl ps-12 pe-4 py-4 font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 text-base" />
        </div>
        
        <div className="space-y-2">
          {activeProducts.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="w-20 h-20 mx-auto mb-4 opacity-30" />
              <p className="font-bold text-lg mb-2">{t('distributorSale.noProductsAvailable')}</p>
              <p className="text-sm">{t('distributorSale.contactOwner')}</p>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const upp = Math.max(1, product.units_per_pack ?? 1);
              const showPacks = upp > 1 && product.allow_pack_sales;
              const packsAvail = Math.floor(product.quantity / upp);
              const looseAvail = product.quantity % upp;
              return (
                <button key={product.product_id} onClick={() => addToCart(product)}
                  className="w-full text-start p-5 bg-muted rounded-2xl hover:bg-muted/80 transition-colors active:scale-[0.98]">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-foreground text-lg truncate">{product.product_name}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {showPacks ? (
                          <>
                            <span className="inline-flex items-center gap-1"><Box className="w-3.5 h-3.5" /> {packsAvail} طرد + {looseAvail} قطعة</span>
                            <span className="mx-2">|</span>
                            <span>{(product.pack_price ?? 0).toLocaleString(locale)} {CURRENCY}/طرد</span>
                          </>
                        ) : (
                          <>
                            {t('distributorSale.available')} {product.quantity} | {t('distributorSale.price')} {product.base_price.toLocaleString(locale)} {CURRENCY}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                      <Plus className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </FullScreenModal>
    </div>
  );
};

export default NewSaleTab;
