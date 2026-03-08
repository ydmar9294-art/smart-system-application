import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/store/AppContext';
import { CURRENCY } from '@/constants';
import { 
  Package, Box, ShoppingCart, Truck, Plus, X, Calendar, User, 
  Check, Trash2, Search, Settings2, AlertTriangle, RotateCcw
} from 'lucide-react';
import { EmployeeType, Product } from '@/types';
import FullScreenModal from '@/components/ui/FullScreenModal';

interface DeliveryItem {
  product_id: string;
  product_name: string;
  quantity: number;
}

interface PurchaseReturnItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

type SubTab = 'products' | 'purchases' | 'purchase-returns' | 'deliveries';

interface InventoryTabProps {
  productsOnly?: boolean;
  forceSubTab?: SubTab;
}

export const InventoryTab: React.FC<InventoryTabProps> = ({ productsOnly = false, forceSubTab }) => {
  const { t } = useTranslation();
  const { 
    products, users, purchases = [], deliveries = [], 
    addPurchase, createDelivery, addProduct, updateProduct, deleteProduct,
    createPurchaseReturn, purchaseReturns = []
  } = useApp();
  const [subTab, setSubTab] = useState<SubTab>(forceSubTab || 'products');
  const effectiveSubTab = forceSubTab || (productsOnly ? 'products' : subTab);

  // Purchases Modal State
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseProduct, setPurchaseProduct] = useState('');
  const [purchaseQty, setPurchaseQty] = useState(1);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseSupplier, setPurchaseSupplier] = useState('');
  const [purchaseNotes, setPurchaseNotes] = useState('');

  // Purchase Return Modal State
  const [showPurchaseReturnModal, setShowPurchaseReturnModal] = useState(false);
  const [purchaseReturnItems, setPurchaseReturnItems] = useState<PurchaseReturnItem[]>([]);
  const [purchaseReturnReason, setPurchaseReturnReason] = useState('');
  const [purchaseReturnSupplier, setPurchaseReturnSupplier] = useState('');
  const [selectedReturnProduct, setSelectedReturnProduct] = useState('');
  const [returnItemQty, setReturnItemQty] = useState(1);
  const [returnItemPrice, setReturnItemPrice] = useState('');

  // Delivery Modal State
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [selectedDistributorId, setSelectedDistributorId] = useState('');
  const [distributorName, setDistributorName] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [deliveryItems, setDeliveryItems] = useState<DeliveryItem[]>([]);
  const [selectedDeliveryProduct, setSelectedDeliveryProduct] = useState('');
  const [deliveryItemQty, setDeliveryItemQty] = useState(1);

  // Products Modal State
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const distributors = users.filter(u => u.employeeType === EmployeeType.FIELD_AGENT);
  const filteredProducts = products.filter(p => p.name.includes(searchTerm) || p.category.includes(searchTerm));
  const lowStockCount = products.filter(p => p.stock <= p.minStock).length;

  // Purchase Handlers
  const handlePurchaseProductChange = (productId: string) => {
    setPurchaseProduct(productId);
    const product = products.find(p => p.id === productId);
    if (product) setPurchasePrice(String(product.costPrice));
  };

  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseProduct || purchaseQty <= 0) return;
    try {
      await addPurchase(purchaseProduct, purchaseQty, Number(purchasePrice), purchaseSupplier || undefined, purchaseNotes || undefined);
      setShowPurchaseModal(false);
      resetPurchaseForm();
    } catch (err) {
      console.error('Purchase failed:', err);
    }
  };

  const resetPurchaseForm = () => {
    setPurchaseProduct('');
    setPurchaseQty(1);
    setPurchasePrice('');
    setPurchaseSupplier('');
    setPurchaseNotes('');
  };

  // Delivery Handlers
  const addDeliveryItem = () => {
    if (!selectedDeliveryProduct || deliveryItemQty <= 0) return;
    const product = products.find(p => p.id === selectedDeliveryProduct);
    if (!product) return;

    const existingItem = deliveryItems.find(i => i.product_id === selectedDeliveryProduct);
    const totalQty = (existingItem?.quantity || 0) + deliveryItemQty;
    if (totalQty > product.stock) return;

    if (existingItem) {
      setDeliveryItems(deliveryItems.map(i => 
        i.product_id === selectedDeliveryProduct 
          ? { ...i, quantity: i.quantity + deliveryItemQty }
          : i
      ));
    } else {
      setDeliveryItems([...deliveryItems, {
        product_id: product.id,
        product_name: product.name,
        quantity: deliveryItemQty
      }]);
    }
    setSelectedDeliveryProduct('');
    setDeliveryItemQty(1);
  };

  const removeDeliveryItem = (productId: string) => {
    setDeliveryItems(deliveryItems.filter(i => i.product_id !== productId));
  };

  const handleDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // بعد إصلاح الفلو: لازم موزع فعلي (id) لضمان تحديث مخزون الموزع
    if (!selectedDistributorId || deliveryItems.length === 0) return;

    const selected = distributors.find(d => d.id === selectedDistributorId);
    const officialName = selected?.name || distributorName;
    try {
      await createDelivery(officialName, deliveryItems, deliveryNotes || undefined, selectedDistributorId);
      setShowDeliveryModal(false);
      resetDeliveryForm();
    } catch (err) {
      // Error already shown via handleError notification — just prevent success path
      console.error('Delivery failed:', err);
    }
  };

  const resetDeliveryForm = () => {
    setSelectedDistributorId('');
    setDistributorName('');
    setDeliveryNotes('');
    setDeliveryItems([]);
    setSelectedDeliveryProduct('');
    setDeliveryItemQty(1);
  };

  // Purchase Return Handlers
  const handleReturnProductChange = (productId: string) => {
    setSelectedReturnProduct(productId);
    const product = products.find(p => p.id === productId);
    if (product) setReturnItemPrice(String(product.costPrice));
  };

  const addPurchaseReturnItem = () => {
    if (!selectedReturnProduct || returnItemQty <= 0) return;
    const product = products.find(p => p.id === selectedReturnProduct);
    if (!product) return;

    // Check stock availability
    if (returnItemQty > product.stock) return;

    const existingItem = purchaseReturnItems.find(i => i.product_id === selectedReturnProduct);
    if (existingItem) {
      setPurchaseReturnItems(purchaseReturnItems.map(i => 
        i.product_id === selectedReturnProduct 
          ? { ...i, quantity: i.quantity + returnItemQty }
          : i
      ));
    } else {
      setPurchaseReturnItems([...purchaseReturnItems, {
        product_id: product.id,
        product_name: product.name,
        quantity: returnItemQty,
        unit_price: Number(returnItemPrice)
      }]);
    }
    setSelectedReturnProduct('');
    setReturnItemQty(1);
    setReturnItemPrice('');
  };

  const removePurchaseReturnItem = (productId: string) => {
    setPurchaseReturnItems(purchaseReturnItems.filter(i => i.product_id !== productId));
  };

  const handlePurchaseReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (purchaseReturnItems.length === 0) return;
    try {
      await createPurchaseReturn(purchaseReturnItems, purchaseReturnReason || undefined, purchaseReturnSupplier || undefined);
      setShowPurchaseReturnModal(false);
      resetPurchaseReturnForm();
    } catch (err) {
      console.error('Purchase return failed:', err);
    }
  };

  const resetPurchaseReturnForm = () => {
    setPurchaseReturnItems([]);
    setPurchaseReturnReason('');
    setPurchaseReturnSupplier('');
    setSelectedReturnProduct('');
    setReturnItemQty(1);
    setReturnItemPrice('');
  };

  // Product Handlers
  const handleOpenProductModal = (p: Product | null = null) => {
    setEditingProduct(p);
    setShowProductModal(true);
  };

  const handleProductSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const productData = {
      name: formData.get('name') as string,
      category: formData.get('category') as string,
      costPrice: Number(formData.get('costPrice')),
      basePrice: Number(formData.get('basePrice')),
      consumerPrice: Number(formData.get('consumerPrice') || 0),
      stock: Number(formData.get('stock')),
      minStock: Number(formData.get('minStock')),
      unit: formData.get('unit') as string,
      isDeleted: false,
    };

    if (editingProduct) {
      updateProduct({ ...productData, id: editingProduct.id, organization_id: editingProduct.organization_id });
    } else {
      addProduct(productData);
    }
    setShowProductModal(false);
    setEditingProduct(null);
  };

  const purchaseReturnTotal = purchaseReturnItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Sub-tabs */}
      {!productsOnly && !forceSubTab && (
        <div className="grid grid-cols-4 gap-1 bg-muted p-1.5 rounded-2xl">
          <button 
            onClick={() => setSubTab('products')} 
            className={`py-2.5 rounded-xl font-black text-[10px] flex items-center justify-center gap-1 transition-all ${subTab === 'products' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
          >
            <Package size={12} /> {t('ownerInventory.products')}
          </button>
          <button 
            onClick={() => setSubTab('purchases')} 
            className={`py-2.5 rounded-xl font-black text-[10px] flex items-center justify-center gap-1 transition-all ${subTab === 'purchases' ? 'bg-card shadow-sm text-success' : 'text-muted-foreground'}`}
          >
            <ShoppingCart size={12} /> {t('ownerInventory.purchases')}
          </button>
          <button 
            onClick={() => setSubTab('purchase-returns')} 
            className={`py-2.5 rounded-xl font-black text-[10px] flex items-center justify-center gap-1 transition-all ${subTab === 'purchase-returns' ? 'bg-card shadow-sm text-destructive' : 'text-muted-foreground'}`}
          >
            <RotateCcw size={12} /> {t('ownerInventory.purchaseReturns')}
          </button>
          <button 
            onClick={() => setSubTab('deliveries')} 
            className={`py-2.5 rounded-xl font-black text-[10px] flex items-center justify-center gap-1 transition-all ${subTab === 'deliveries' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground'}`}
          >
            <Truck size={12} /> {t('ownerInventory.deliveries')}
          </button>
        </div>
      )}

      {/* Products Sub-Tab */}
      {effectiveSubTab === 'products' && (
        <div className="space-y-3">
          {lowStockCount > 0 && (
            <div className="bg-warning/10 p-4 rounded-2xl border border-warning/20 flex items-center gap-3">
              <AlertTriangle size={20} className="text-warning shrink-0" />
              <p className="text-xs font-bold text-warning">{lowStockCount} {t('ownerInventory.lowStockAlert')}</p>
            </div>
          )}

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                placeholder={t('ownerInventory.searchProduct')} 
                className="input-field pr-10" 
              />
            </div>
            <button onClick={() => handleOpenProductModal()} className="px-4 bg-primary text-primary-foreground rounded-2xl flex items-center gap-1">
              <Plus size={18} />
            </button>
          </div>

          <div className="space-y-2">
            {filteredProducts.length === 0 ? (
              <div className="bg-card p-8 rounded-[2.5rem] border text-center">
                <Box size={48} className="mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground font-bold">{t('ownerInventory.noProducts')}</p>
              </div>
            ) : (
              filteredProducts.map(p => (
                <div key={p.id} className="bg-card p-4 rounded-[1.8rem] border shadow-sm flex justify-between items-center">
                  <div>
                    <p className="font-black text-foreground text-sm">{p.name}</p>
                    <p className="text-[9px] text-muted-foreground font-bold">{p.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-black px-2 py-1 rounded-lg ${p.stock <= p.minStock ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                      {p.stock} {p.unit}
                    </span>
                    <button onClick={() => handleOpenProductModal(p)} className="p-2 bg-muted rounded-xl text-muted-foreground hover:text-primary">
                      <Settings2 size={16} />
                    </button>
                    <button onClick={() => deleteProduct(p.id)} className="p-2 bg-destructive/10 rounded-xl text-destructive">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Purchases Sub-Tab */}
      {effectiveSubTab === 'purchases' && (
        <div className="space-y-3">
          <button 
            onClick={() => setShowPurchaseModal(true)} 
            className="w-full py-4 bg-success text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
          >
            <ShoppingCart size={18}/> {t('ownerInventory.registerPurchase')}
          </button>

          {purchases.length === 0 ? (
            <div className="bg-card p-8 rounded-[2.5rem] border text-center">
              <Package size={48} className="mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground font-bold">{t('ownerInventory.noPurchases')}</p>
            </div>
          ) : (
            purchases.map((purchase) => (
              <div key={purchase.id} className="bg-card p-4 rounded-[1.8rem] border shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-black text-foreground text-sm">{purchase.product_name}</h3>
                    <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                      <Calendar size={10} />
                      {new Date(purchase.created_at).toLocaleDateString('ar-EG')}
                    </p>
                  </div>
                  <span className="badge badge-success text-[9px]">{purchase.quantity} {t('ownerInventory.unit')}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <User size={12} />
                    {purchase.supplier_name || t('common.unspecified')}
                  </span>
                  <span className="font-black text-success">{purchase.total_price.toLocaleString()} {CURRENCY}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Purchase Returns Sub-Tab */}
      {effectiveSubTab === 'purchase-returns' && (
        <div className="space-y-3">
          <button 
            onClick={() => setShowPurchaseReturnModal(true)} 
            className="w-full py-4 bg-destructive text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
          >
            <RotateCcw size={18}/> {t('ownerInventory.registerPurchaseReturn')}
          </button>

          <div className="bg-destructive/10 p-4 rounded-2xl border border-destructive/20">
            <p className="text-xs text-destructive font-bold mb-2">{t('ownerInventory.importantWarning')}</p>
            <p className="text-xs text-muted-foreground">
              {t('ownerInventory.purchaseReturnWarning')}
            </p>
          </div>

          {purchaseReturns.length === 0 ? (
            <div className="bg-card p-8 rounded-[2.5rem] border text-center">
              <RotateCcw size={48} className="mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground font-bold">{t('ownerInventory.noPurchaseReturns')}</p>
            </div>
          ) : (
            purchaseReturns.map((ret) => (
              <div key={ret.id} className="bg-card p-4 rounded-[1.8rem] border shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-black text-foreground text-sm">{ret.supplier_name || t('ownerInventory.unknownSupplier')}</h3>
                    <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                      <Calendar size={10} />
                      {new Date(ret.created_at).toLocaleDateString('ar-EG')}
                    </p>
                  </div>
                  <span className="badge bg-destructive/10 text-destructive text-[9px] px-2 py-1 rounded-lg font-black">
                    {Number(ret.total_amount).toLocaleString()} {CURRENCY}
                  </span>
                </div>
                {ret.reason && (
                  <p className="text-xs text-muted-foreground mt-1">{t('ownerInventory.reason')} {ret.reason}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {effectiveSubTab === 'deliveries' && (
        <div className="space-y-3">
          <button 
            onClick={() => setShowDeliveryModal(true)} 
            className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
          >
            <Truck size={18}/> {t('ownerInventory.deliverToDistributor')}
          </button>

          {deliveries.length === 0 ? (
            <div className="bg-card p-8 rounded-[2.5rem] border text-center">
              <Truck size={48} className="mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground font-bold">{t('ownerInventory.noDeliveries')}</p>
            </div>
          ) : (
            deliveries.map((delivery) => (
              <div key={delivery.id} className="bg-card p-4 rounded-[1.8rem] border shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-black text-foreground text-sm flex items-center gap-1">
                      <User size={14} className="text-primary" />
                      {delivery.distributor_name}
                    </h3>
                    <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                      <Calendar size={10} />
                      {new Date(delivery.created_at).toLocaleDateString('ar-EG')}
                    </p>
                  </div>
                  <span className={`badge text-[9px] ${delivery.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                    {delivery.status === 'completed' ? t('ownerInventory.completed') : t('common.pending')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Purchase Modal - Full Screen */}
      <FullScreenModal
        isOpen={showPurchaseModal}
        onClose={() => { setShowPurchaseModal(false); resetPurchaseForm(); }}
        title={t('ownerInventory.purchaseMaterials')}
        icon={<ShoppingCart size={24} />}
        headerColor="success"
        footer={
          <button 
            type="button"
            onClick={() => {
              const form = document.getElementById('purchase-form') as HTMLFormElement;
              if (form) form.requestSubmit();
            }}
            className="w-full bg-success text-white font-black py-5 rounded-2xl shadow-lg active:scale-[0.98] transition-all text-lg"
          >
            {t('ownerInventory.confirmPurchase')}
          </button>
        }
      >
        <form id="purchase-form" onSubmit={handlePurchaseSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.selectProduct')}</label>
            <select 
              value={purchaseProduct} 
              onChange={(e) => handlePurchaseProductChange(e.target.value)} 
              required 
              className="input-field text-base py-4"
            >
              <option value="">{t('ownerInventory.selectProduct')}</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.quantity')}</label>
              <input 
                type="number" 
                min="1" 
                value={purchaseQty} 
                onChange={(e) => setPurchaseQty(Number(e.target.value))} 
                required 
                className="input-field text-center text-xl font-black py-4" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.unitPrice')}</label>
              <input 
                type="number" 
                min="0" 
                step="0.01" 
                value={purchasePrice} 
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="0"
                required 
                className="input-field text-center text-xl font-black py-4" 
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.supplierOptional')}</label>
            <input 
              type="text" 
              value={purchaseSupplier} 
              onChange={(e) => setPurchaseSupplier(e.target.value)} 
              placeholder={t('ownerInventory.supplierName')} 
              className="input-field py-4" 
            />
          </div>
          
          <div className="bg-success/10 p-5 rounded-2xl border border-success/20 flex justify-between items-center">
            <span className="font-bold text-muted-foreground">{t('ownerInventory.totalLabel')}</span>
            <span className="text-3xl font-black text-success">{(purchaseQty * Number(purchasePrice)).toLocaleString()} {CURRENCY}</span>
          </div>
        </form>
      </FullScreenModal>

      {/* Delivery Modal - Full Screen */}
      <FullScreenModal
        isOpen={showDeliveryModal}
        onClose={() => { setShowDeliveryModal(false); resetDeliveryForm(); }}
        title={t('ownerInventory.deliverToAgent')}
        icon={<Truck size={24} />}
        headerColor="primary"
        footer={
          <button 
            type="button"
            onClick={() => {
              const form = document.getElementById('delivery-form') as HTMLFormElement;
              if (form) form.requestSubmit();
            }}
            disabled={deliveryItems.length === 0 || !selectedDistributorId}
            className="w-full bg-primary text-primary-foreground font-black py-5 rounded-2xl shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 text-lg flex items-center justify-center gap-2"
          >
            <Check size={22} />
            {t('ownerInventory.confirmDelivery')}
          </button>
        }
      >
        <form id="delivery-form" onSubmit={handleDeliverySubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.selectDistributor')}</label>
            {distributors.length > 0 ? (
              <select
                value={selectedDistributorId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedDistributorId(id);
                  const d = distributors.find(x => x.id === id);
                  setDistributorName(d?.name || '');
                }}
                required
                className="input-field text-base py-4"
              >
                <option value="">{t('ownerInventory.selectDistributor')}</option>
                {distributors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            ) : (
              <div className="bg-muted p-4 rounded-2xl text-sm text-muted-foreground font-bold text-center">
                {t('ownerInventory.noDistributors')}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <label className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.addItems')}</label>
            <div className="flex gap-3">
              <select 
                value={selectedDeliveryProduct} 
                onChange={(e) => setSelectedDeliveryProduct(e.target.value)} 
                className="input-field flex-1 py-4"
              >
                <option value="">{t('ownerInventory.selectProduct')}</option>
                {products.filter(p => p.stock > 0).map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.stock})</option>
                ))}
              </select>
              <input 
                type="text" 
                inputMode="numeric" 
                pattern="[0-9]*"
                value={deliveryItemQty} 
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setDeliveryItemQty(val ? Number(val) : 1);
                }} 
                className="w-20 text-center text-xl font-black bg-card border-2 border-primary/30 rounded-xl text-foreground focus:border-primary focus:outline-none py-4" 
              />
              <button 
                type="button" 
                onClick={addDeliveryItem} 
                className="px-5 bg-primary text-primary-foreground rounded-xl active:scale-95 transition-transform"
              >
                <Plus size={22} />
              </button>
            </div>
          </div>

          {deliveryItems.length > 0 && (
            <div className="space-y-3 bg-muted p-4 rounded-2xl">
              <p className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.selectedItems')} ({deliveryItems.length}):</p>
              {deliveryItems.map((item) => (
                <div key={item.product_id} className="flex justify-between items-center bg-card p-4 rounded-xl">
                  <span className="font-bold">{item.product_name}</span>
                  <div className="flex items-center gap-3">
                    <span className="bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-black">{item.quantity}</span>
                    <button 
                      type="button" 
                      onClick={() => removeDeliveryItem(item.product_id)} 
                      className="text-destructive p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </form>
      </FullScreenModal>

      {/* Purchase Return Modal - Full Screen */}
      <FullScreenModal
        isOpen={showPurchaseReturnModal}
        onClose={() => { setShowPurchaseReturnModal(false); resetPurchaseReturnForm(); }}
        title={t('ownerInventory.purchaseReturn')}
        icon={<RotateCcw size={24} />}
        headerColor="destructive"
        footer={
          <button 
            type="button"
            onClick={() => {
              const form = document.getElementById('purchase-return-form') as HTMLFormElement;
              if (form) form.requestSubmit();
            }}
            disabled={purchaseReturnItems.length === 0}
            className="w-full bg-destructive text-white font-black py-5 rounded-2xl shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 text-lg flex items-center justify-center gap-2"
          >
            <Check size={22} />
            {t('ownerInventory.confirmReturn')}
          </button>
        }
      >
        <form id="purchase-return-form" onSubmit={handlePurchaseReturnSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.supplierOptional')}</label>
            <input 
              type="text" 
              value={purchaseReturnSupplier} 
              onChange={(e) => setPurchaseReturnSupplier(e.target.value)} 
              placeholder={t('ownerInventory.supplierName')} 
              className="input-field py-4" 
            />
          </div>

          <div className="space-y-3">
            <label className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.addReturnItems')}</label>
            <select 
              value={selectedReturnProduct} 
              onChange={(e) => handleReturnProductChange(e.target.value)} 
              className="input-field py-4"
            >
              <option value="">{t('ownerInventory.selectProductForReturn')}</option>
              {products.filter(p => p.stock > 0).map(p => (
                <option key={p.id} value={p.id}>{p.name} ({t('ownerInventory.availableQty')} {p.stock})</option>
              ))}
            </select>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground">{t('ownerInventory.quantity')}</label>
                <input 
                  type="number" 
                  min="1" 
                  value={returnItemQty} 
                  onChange={(e) => setReturnItemQty(Number(e.target.value))} 
                  className="input-field text-center text-xl font-black py-4" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground">{t('ownerInventory.unitPrice')}</label>
                <input 
                  type="number" 
                  min="0" 
                  step="0.01"
                  value={returnItemPrice} 
                  onChange={(e) => setReturnItemPrice(e.target.value)}
                  placeholder="0"
                  className="input-field text-center text-xl font-black py-4" 
                />
              </div>
            </div>
            
            <button 
              type="button" 
              onClick={addPurchaseReturnItem} 
              disabled={!selectedReturnProduct || returnItemQty <= 0}
              className="w-full py-4 bg-destructive/10 text-destructive rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              <Plus size={20} /> إضافة للمرتجع
            </button>
          </div>

          {purchaseReturnItems.length > 0 && (
            <div className="space-y-3 bg-muted p-4 rounded-2xl">
              <p className="text-xs font-black text-muted-foreground uppercase">أصناف المرتجع ({purchaseReturnItems.length}):</p>
              {purchaseReturnItems.map((item) => (
                <div key={item.product_id} className="flex justify-between items-center bg-card p-4 rounded-xl">
                  <span className="font-bold">{item.product_name}</span>
                  <div className="flex items-center gap-3">
                    <span className="bg-destructive/10 text-destructive px-3 py-1.5 rounded-lg font-black text-sm">
                      {item.quantity} × {item.unit_price.toLocaleString()}
                    </span>
                    <button 
                      type="button" 
                      onClick={() => removePurchaseReturnItem(item.product_id)} 
                      className="text-destructive p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">سبب المرتجع (اختياري)</label>
            <input 
              type="text" 
              value={purchaseReturnReason} 
              onChange={(e) => setPurchaseReturnReason(e.target.value)} 
              placeholder="سبب المرتجع" 
              className="input-field py-4" 
            />
          </div>

          <div className="bg-destructive/10 p-5 rounded-2xl border border-destructive/20 flex justify-between items-center">
            <span className="font-bold text-muted-foreground">إجمالي المرتجع:</span>
            <span className="text-3xl font-black text-destructive">{purchaseReturnTotal.toLocaleString()} {CURRENCY}</span>
          </div>
        </form>
      </FullScreenModal>

      {/* Product Modal - Full Screen */}
      <FullScreenModal
        isOpen={showProductModal}
        onClose={() => { setShowProductModal(false); setEditingProduct(null); }}
        title={editingProduct ? 'تعديل صنف' : 'إضافة صنف جديد'}
        icon={<Package size={24} />}
        headerColor="primary"
        footer={
          <button 
            type="button"
            onClick={() => {
              const form = document.getElementById('product-form') as HTMLFormElement;
              if (form) form.requestSubmit();
            }}
            className="w-full bg-primary text-primary-foreground font-black py-5 rounded-2xl shadow-lg active:scale-[0.98] transition-all text-lg"
          >
            {editingProduct ? 'حفظ التعديلات' : 'حفظ الصنف'}
          </button>
        }
      >
        <form id="product-form" onSubmit={handleProductSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">اسم الصنف</label>
            <input 
              name="name" 
              required 
              defaultValue={editingProduct?.name} 
              placeholder="اسم الصنف" 
              className="input-field py-4 text-base" 
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">الفئة</label>
            <input 
              name="category" 
              defaultValue={editingProduct?.category} 
              placeholder="الفئة" 
              className="input-field py-4" 
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-muted-foreground uppercase">سعر التكلفة</label>
              <input 
                name="costPrice" 
                type="number" 
                step="0.01" 
                defaultValue={editingProduct?.costPrice} 
                placeholder="0" 
                className="input-field py-4 text-center text-xl font-black" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-muted-foreground uppercase">سعر البيع</label>
              <input 
                name="basePrice" 
                type="number" 
                step="0.01" 
                defaultValue={editingProduct?.basePrice} 
                placeholder="0" 
                className="input-field py-4 text-center text-xl font-black" 
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">سعر المستهلك</label>
            <input 
              name="consumerPrice" 
              type="number" 
              step="0.01" 
              defaultValue={editingProduct?.consumerPrice ?? 0} 
              placeholder="0" 
              className="input-field py-4 text-center text-xl font-black" 
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-muted-foreground uppercase">المخزون الحالي</label>
              <input 
                name="stock" 
                type="number" 
                defaultValue={editingProduct?.stock ?? 0} 
                className="input-field py-4 text-center text-xl font-black" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-muted-foreground uppercase">الحد الأدنى</label>
              <input 
                name="minStock" 
                type="number" 
                defaultValue={editingProduct?.minStock ?? 5} 
                className="input-field py-4 text-center text-xl font-black" 
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">الوحدة</label>
            <input 
              name="unit" 
              defaultValue={editingProduct?.unit ?? 'قطعة'} 
              placeholder="قطعة" 
              className="input-field py-4" 
            />
          </div>
        </form>
      </FullScreenModal>
    </div>
  );
};
