import React, { useState } from 'react';
import { logger } from '@/lib/logger';
import { useApp } from '@/store/AppContext';
import { useCurrency } from '@/store/CurrencyContext';
import { resolveProductBasePriceSYP } from '@/lib/priceConversion';
import { EmployeeType, Product } from '@/types';

import type { DeliveryItem, PurchaseReturnItem, InventorySubTab } from './inventory/types';
import { InventorySummary } from './inventory/InventorySummary';
import { InventorySubTabs } from './inventory/InventorySubTabs';
import { ProductsView } from './inventory/ProductsView';
import { PurchasesView } from './inventory/PurchasesView';
import { PurchaseReturnsView } from './inventory/PurchaseReturnsView';
import { DeliveriesView } from './inventory/DeliveriesView';
import { PurchaseModal } from './inventory/PurchaseModal';
import { DeliveryModal } from './inventory/DeliveryModal';
import { PurchaseReturnModal } from './inventory/PurchaseReturnModal';
import { ProductModal } from './inventory/ProductModal';

type SubTab = InventorySubTab;

interface InventoryTabProps {
  productsOnly?: boolean;
  forceSubTab?: SubTab;
}

export const InventoryTab: React.FC<InventoryTabProps> = ({ productsOnly = false, forceSubTab }) => {
  const {
    products, users, purchases = [], deliveries = [],
    addPurchase, createDelivery, addProduct, updateProduct, deleteProduct,
    createPurchaseReturn, purchaseReturns = [], distributorInventory = []
  } = useApp();
  const [subTab, setSubTab] = useState<SubTab>(forceSubTab || 'products');
  const effectiveSubTab = forceSubTab || (productsOnly ? 'products' : subTab);

  const { usdRate } = useCurrency();
  const inventorySummary = React.useMemo(() => {
    const activeProducts = products.filter(p => !p.isDeleted);
    const warehouseValue = activeProducts.reduce((s, p) => s + (p.stock * resolveProductBasePriceSYP(p, usdRate)), 0);
    const distInv = distributorInventory as any[];
    const distValue = distInv.reduce((s: number, di: any) => {
      const prod = products.find(p => p.id === di.product_id);
      return s + (di.quantity * (prod ? resolveProductBasePriceSYP(prod, usdRate) : 0));
    }, 0);
    const lowStock = activeProducts.filter(p => p.stock <= p.minStock).length;
    return { warehouseValue, distValue, totalValue: warehouseValue + distValue, activeCount: activeProducts.length, lowStock };
  }, [products, distributorInventory, usdRate]);

  // Purchase modal state
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseProduct, setPurchaseProduct] = useState('');
  const [purchaseQty, setPurchaseQty] = useState(1);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseSupplier, setPurchaseSupplier] = useState('');
  const [purchaseNotes, setPurchaseNotes] = useState('');

  // Purchase Return modal state
  const [showPurchaseReturnModal, setShowPurchaseReturnModal] = useState(false);
  const [purchaseReturnItems, setPurchaseReturnItems] = useState<PurchaseReturnItem[]>([]);
  const [purchaseReturnReason, setPurchaseReturnReason] = useState('');
  const [purchaseReturnSupplier, setPurchaseReturnSupplier] = useState('');
  const [selectedReturnProduct, setSelectedReturnProduct] = useState('');
  const [returnItemQty, setReturnItemQty] = useState(1);
  const [returnItemPrice, setReturnItemPrice] = useState('');

  // Delivery modal state
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [selectedDistributorId, setSelectedDistributorId] = useState('');
  const [distributorName, setDistributorName] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [deliveryItems, setDeliveryItems] = useState<DeliveryItem[]>([]);
  const [selectedDeliveryProduct, setSelectedDeliveryProduct] = useState('');
  const [deliveryItemQty, setDeliveryItemQty] = useState(1);

  // Product modal state
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const distributors = users.filter(u => u.employeeType === EmployeeType.FIELD_AGENT);
  const filteredProducts = products.filter(p => p.name.includes(searchTerm) || p.category.includes(searchTerm));
  const lowStockCount = products.filter(p => p.stock <= p.minStock).length;

  // Purchase handlers
  const handlePurchaseProductChange = (productId: string) => {
    setPurchaseProduct(productId);
    const product = products.find(p => p.id === productId);
    if (product) setPurchasePrice(String(resolveProductBasePriceSYP(product, usdRate)));
  };

  const resetPurchaseForm = () => {
    setPurchaseProduct('');
    setPurchaseQty(1);
    setPurchasePrice('');
    setPurchaseSupplier('');
    setPurchaseNotes('');
  };

  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseProduct || purchaseQty <= 0) return;
    try {
      await addPurchase(purchaseProduct, purchaseQty, Number(purchasePrice), purchaseSupplier || undefined, purchaseNotes || undefined);
      setShowPurchaseModal(false);
      resetPurchaseForm();
    } catch {
      logger.error('Purchase failed', 'InventoryTab');
    }
  };

  // Delivery handlers
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
        quantity: deliveryItemQty,
      }]);
    }
    setSelectedDeliveryProduct('');
    setDeliveryItemQty(1);
  };

  const removeDeliveryItem = (productId: string) => {
    setDeliveryItems(deliveryItems.filter(i => i.product_id !== productId));
  };

  const resetDeliveryForm = () => {
    setSelectedDistributorId('');
    setDistributorName('');
    setDeliveryNotes('');
    setDeliveryItems([]);
    setSelectedDeliveryProduct('');
    setDeliveryItemQty(1);
  };

  const handleDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDistributorId || deliveryItems.length === 0) return;
    const selected = distributors.find(d => d.id === selectedDistributorId);
    const officialName = selected?.name || distributorName;
    try {
      await createDelivery(officialName, deliveryItems, deliveryNotes || undefined, selectedDistributorId);
      setShowDeliveryModal(false);
      resetDeliveryForm();
    } catch {
      logger.error('Delivery failed', 'InventoryTab');
    }
  };

  // Purchase Return handlers
  const handleReturnProductChange = (productId: string) => {
    setSelectedReturnProduct(productId);
    const product = products.find(p => p.id === productId);
    if (product) setReturnItemPrice(String(resolveProductBasePriceSYP(product, usdRate)));
  };

  const addPurchaseReturnItem = () => {
    if (!selectedReturnProduct || returnItemQty <= 0) return;
    const product = products.find(p => p.id === selectedReturnProduct);
    if (!product) return;
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
        unit_price: Number(returnItemPrice),
      }]);
    }
    setSelectedReturnProduct('');
    setReturnItemQty(1);
    setReturnItemPrice('');
  };

  const removePurchaseReturnItem = (productId: string) => {
    setPurchaseReturnItems(purchaseReturnItems.filter(i => i.product_id !== productId));
  };

  const resetPurchaseReturnForm = () => {
    setPurchaseReturnItems([]);
    setPurchaseReturnReason('');
    setPurchaseReturnSupplier('');
    setSelectedReturnProduct('');
    setReturnItemQty(1);
    setReturnItemPrice('');
  };

  const handlePurchaseReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (purchaseReturnItems.length === 0) return;
    try {
      await createPurchaseReturn(purchaseReturnItems, purchaseReturnReason || undefined, purchaseReturnSupplier || undefined);
      setShowPurchaseReturnModal(false);
      resetPurchaseReturnForm();
    } catch {
      logger.error('Purchase return failed', 'InventoryTab');
    }
  };

  // Product handlers
  const handleOpenProductModal = (p: Product | null = null) => {
    setEditingProduct(p);
    setShowProductModal(true);
  };

  const handleProductSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const pricingCurrency = (formData.get('pricingCurrency') as string) === 'USD' ? 'USD' : 'SYP';
    const productData = {
      name: formData.get('name') as string,
      category: formData.get('category') as string,
      costPrice: 0,
      basePrice: Number(formData.get('basePrice')),
      consumerPrice: Number(formData.get('consumerPrice') || 0),
      stock: Number(formData.get('stock')),
      minStock: Number(formData.get('minStock')),
      unit: formData.get('unit') as string,
      isDeleted: false,
      pricingCurrency: pricingCurrency as 'SYP' | 'USD',
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
      {!productsOnly && !forceSubTab && (
        <InventorySummary
          warehouseValue={inventorySummary.warehouseValue}
          distValue={inventorySummary.distValue}
          activeCount={inventorySummary.activeCount}
          lowStock={inventorySummary.lowStock}
        />
      )}

      {!productsOnly && !forceSubTab && (
        <InventorySubTabs subTab={subTab} onChange={setSubTab} />
      )}

      {effectiveSubTab === 'products' && (
        <ProductsView
          products={products}
          filteredProducts={filteredProducts}
          lowStockCount={lowStockCount}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onOpenProductModal={handleOpenProductModal}
          onDeleteProduct={deleteProduct}
        />
      )}

      {effectiveSubTab === 'purchases' && (
        <PurchasesView purchases={purchases} onOpen={() => setShowPurchaseModal(true)} />
      )}

      {effectiveSubTab === 'purchase-returns' && (
        <PurchaseReturnsView purchaseReturns={purchaseReturns} onOpen={() => setShowPurchaseReturnModal(true)} />
      )}

      {effectiveSubTab === 'deliveries' && (
        <DeliveriesView deliveries={deliveries} onOpen={() => setShowDeliveryModal(true)} />
      )}

      <PurchaseModal
        isOpen={showPurchaseModal}
        onClose={() => { setShowPurchaseModal(false); resetPurchaseForm(); }}
        products={products}
        purchaseProduct={purchaseProduct}
        purchaseQty={purchaseQty}
        purchasePrice={purchasePrice}
        purchaseSupplier={purchaseSupplier}
        setPurchaseQty={setPurchaseQty}
        setPurchasePrice={setPurchasePrice}
        setPurchaseSupplier={setPurchaseSupplier}
        onProductChange={handlePurchaseProductChange}
        onSubmit={handlePurchaseSubmit}
      />

      <DeliveryModal
        isOpen={showDeliveryModal}
        onClose={() => { setShowDeliveryModal(false); resetDeliveryForm(); }}
        products={products}
        distributors={distributors}
        selectedDistributorId={selectedDistributorId}
        setSelectedDistributorId={setSelectedDistributorId}
        setDistributorName={setDistributorName}
        selectedDeliveryProduct={selectedDeliveryProduct}
        setSelectedDeliveryProduct={setSelectedDeliveryProduct}
        deliveryItemQty={deliveryItemQty}
        setDeliveryItemQty={setDeliveryItemQty}
        deliveryItems={deliveryItems}
        addDeliveryItem={addDeliveryItem}
        removeDeliveryItem={removeDeliveryItem}
        onSubmit={handleDeliverySubmit}
      />

      <PurchaseReturnModal
        isOpen={showPurchaseReturnModal}
        onClose={() => { setShowPurchaseReturnModal(false); resetPurchaseReturnForm(); }}
        products={products}
        purchaseReturnSupplier={purchaseReturnSupplier}
        setPurchaseReturnSupplier={setPurchaseReturnSupplier}
        selectedReturnProduct={selectedReturnProduct}
        onReturnProductChange={handleReturnProductChange}
        returnItemQty={returnItemQty}
        setReturnItemQty={setReturnItemQty}
        returnItemPrice={returnItemPrice}
        setReturnItemPrice={setReturnItemPrice}
        addPurchaseReturnItem={addPurchaseReturnItem}
        removePurchaseReturnItem={removePurchaseReturnItem}
        purchaseReturnItems={purchaseReturnItems}
        purchaseReturnReason={purchaseReturnReason}
        setPurchaseReturnReason={setPurchaseReturnReason}
        purchaseReturnTotal={purchaseReturnTotal}
        onSubmit={handlePurchaseReturnSubmit}
      />

      <ProductModal
        isOpen={showProductModal}
        onClose={() => { setShowProductModal(false); setEditingProduct(null); }}
        editingProduct={editingProduct}
        onSubmit={handleProductSubmit}
      />
    </div>
  );
};
