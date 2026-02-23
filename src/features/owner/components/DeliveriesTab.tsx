import React, { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { Truck, Plus, Package, Calendar, User, Check, Trash2, Loader2, AlertCircle, Eye } from 'lucide-react';
import { EmployeeType } from '@/types';
import DeliveryDetailsModal from './DeliveryDetailsModal';
import FullScreenModal from '@/components/ui/FullScreenModal';

interface DeliveryItem {
  product_id: string;
  product_name: string;
  quantity: number;
}

interface Delivery {
  id: string;
  distributor_name: string;
  status: string;
  notes?: string;
  created_at: number;
  items?: DeliveryItem[];
}

interface DistributorOption {
  id: string;
  name: string;
}

export const DeliveriesTab: React.FC = () => {
  const { products, users, createDelivery, deliveries = [], addNotification } = useApp();
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedDistributorId, setSelectedDistributorId] = useState('');
  const [distributorName, setDistributorName] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // الموزعين من نفس المنشأة فقط (يتم تصفيتهم تلقائياً عبر RLS في useApp)
  const distributors: DistributorOption[] = users
    .filter(u => u.employeeType === EmployeeType.FIELD_AGENT)
    .map(u => ({ id: u.id, name: u.name }));

  const handleDistributorChange = (distributorId: string) => {
    setSelectedDistributorId(distributorId);
    const distributor = distributors.find(d => d.id === distributorId);
    setDistributorName(distributor?.name || '');
  };

  const addItem = () => {
    if (!selectedProduct || itemQuantity <= 0) {
      setError('يرجى اختيار منتج وإدخال كمية صحيحة');
      return;
    }
    
    const product = products.find(p => p.id === selectedProduct);
    if (!product) {
      setError('المنتج غير موجود');
      return;
    }

    // التحقق من المخزون
    const existingItem = items.find(i => i.product_id === selectedProduct);
    const totalQty = (existingItem?.quantity || 0) + itemQuantity;
    
    if (totalQty > product.stock) {
      setError(`الكمية المطلوبة (${totalQty}) أكبر من المخزون المتوفر (${product.stock})`);
      return;
    }

    setError('');
    
    if (existingItem) {
      setItems(items.map(i => 
        i.product_id === selectedProduct 
          ? { ...i, quantity: i.quantity + itemQuantity }
          : i
      ));
    } else {
      setItems([...items, {
        product_id: product.id,
        product_name: product.name,
        quantity: itemQuantity
      }]);
    }

    setSelectedProduct('');
    setItemQuantity(1);
  };

  const removeItem = (productId: string) => {
    setItems(items.filter(i => i.product_id !== productId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // بعد إصلاح الفلو: لازم اختيار موزع فعلي (id) لضمان ربط المخزون
    if (!selectedDistributorId) {
      setError('يرجى اختيار موزع مُفعّل من القائمة');
      return;
    }
    
    if (items.length === 0) {
      setError('يرجى إضافة منتج واحد على الأقل');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // تمرير distributor_id لربط المخزون بالموزع
      await createDelivery(
        distributorName.trim(), 
        items, 
        notes || undefined,
        selectedDistributorId || undefined
      );
      setShowModal(false);
      resetForm();
      addNotification('تم تسليم البضاعة بنجاح وتحديث مخزون الموزع', 'success');
    } catch (err: any) {
      console.error('Delivery error:', err);
      setError(err.message || 'حدث خطأ أثناء تسليم البضاعة');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedDistributorId('');
    setDistributorName('');
    setNotes('');
    setItems([]);
    setSelectedProduct('');
    setItemQuantity(1);
    setError('');
  };

  const availableProducts = products.filter(p => !p.isDeleted && p.stock > 0);

  return (
    <div className="space-y-4 animate-fade-in">
      <button 
        onClick={() => setShowModal(true)} 
        className="w-full py-5 bg-primary text-primary-foreground rounded-[1.8rem] font-black text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
      >
        <Truck size={18}/> تسليم بضاعة للموزع
      </button>

      {/* قائمة التسليمات */}
      <div className="space-y-3">
        {deliveries.length === 0 ? (
          <div className="bg-card p-8 rounded-[2.5rem] border text-center">
            <Truck size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground font-bold">لا توجد تسليمات مسجلة</p>
          </div>
        ) : (
          deliveries.map((delivery: Delivery) => (
            <div key={delivery.id} className="bg-card p-5 rounded-[2.2rem] border shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-black text-foreground flex items-center gap-2">
                    <User size={16} className="text-primary" />
                    {delivery.distributor_name}
                  </h3>
                  <p className="text-[10px] text-muted-foreground font-bold flex items-center gap-1 mt-1">
                    <Calendar size={12} />
                    {new Date(delivery.created_at).toLocaleDateString('ar-EG')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedDelivery(delivery)}
                    className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors"
                    title="عرض التفاصيل"
                  >
                    <Eye size={18} />
                  </button>
                  <span className={`badge ${delivery.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                    {delivery.status === 'completed' ? 'مكتمل' : 'معلق'}
                  </span>
                </div>
              </div>
              {delivery.notes && (
                <p className="text-xs text-muted-foreground bg-muted p-2 rounded-lg">{delivery.notes}</p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Delivery Details Modal */}
      {selectedDelivery && (
        <DeliveryDetailsModal
          deliveryId={selectedDelivery.id}
          distributorName={selectedDelivery.distributor_name}
          createdAt={selectedDelivery.created_at}
          notes={selectedDelivery.notes}
          onClose={() => setSelectedDelivery(null)}
        />
      )}

      {/* Modal تسليم بضاعة - Full Screen */}
      <FullScreenModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); resetForm(); }}
        title="تسليم بضاعة للموزع"
        icon={<Truck size={24} />}
        headerColor="primary"
        footer={
          <button 
            type="button"
            onClick={(e) => {
              const form = document.getElementById('delivery-form') as HTMLFormElement;
              if (form) form.requestSubmit();
            }}
            disabled={loading || items.length === 0 || !selectedDistributorId}
            className="w-full bg-primary text-primary-foreground font-black py-5 rounded-2xl shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3 text-lg"
          >
            {loading ? (
              <>
                <Loader2 size={22} className="animate-spin" />
                جارٍ التسليم...
              </>
            ) : (
              <>
                <Check size={22} />
                تأكيد التسليم وخصم من المخزون
              </>
            )}
          </button>
        }
      >
        <form id="delivery-form" onSubmit={handleSubmit} className="space-y-5">
          {/* Error Message */}
          {error && (
            <div className="bg-destructive/10 text-destructive p-4 rounded-2xl flex items-center gap-3">
              <AlertCircle className="w-6 h-6 flex-shrink-0" />
              <span className="font-bold">{error}</span>
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">الموزع</label>
            {distributors.length > 0 ? (
              <select
                value={selectedDistributorId}
                onChange={(e) => handleDistributorChange(e.target.value)}
                className="input-field text-base py-4"
                disabled={loading}
              >
                <option value="">اختر الموزع...</option>
                {distributors.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            ) : (
              <div className="bg-muted p-5 rounded-2xl text-muted-foreground font-bold text-center">
                لا يوجد موزعين مُفعّلين حالياً. أضف موزع جديد ثم فعّل حسابه قبل تنفيذ التسليم.
              </div>
            )}
          </div>

          {/* إضافة أصناف */}
          <div className="space-y-3">
            <label className="text-xs font-black text-muted-foreground uppercase">إضافة أصناف</label>
            <div className="flex gap-3">
              <select 
                value={selectedProduct} 
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="input-field flex-1 py-4"
                disabled={loading}
              >
                <option value="">اختر المادة...</option>
                {availableProducts.map(p => (
                  <option key={p.id} value={p.id}>{p.name} (المتوفر: {p.stock})</option>
                ))}
              </select>
              <input 
                type="number" 
                min="1"
                value={itemQuantity}
                onChange={(e) => setItemQuantity(Number(e.target.value))}
                className="w-20 text-center text-xl font-black bg-card border-2 border-primary/30 rounded-xl text-foreground focus:border-primary focus:outline-none py-4"
                disabled={loading}
              />
              <button 
                type="button"
                onClick={addItem}
                disabled={loading || !selectedProduct}
                className="px-5 bg-primary text-primary-foreground rounded-xl disabled:opacity-50 active:scale-95 transition-transform"
              >
                <Plus size={22} />
              </button>
            </div>
          </div>

          {/* قائمة الأصناف المضافة */}
          {items.length > 0 && (
            <div className="space-y-3 bg-muted p-4 rounded-2xl">
              <p className="text-xs font-black text-muted-foreground uppercase">الأصناف المختارة ({items.length}):</p>
              {items.map((item) => (
                <div key={item.product_id} className="flex justify-between items-center bg-card p-4 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Package size={20} className="text-primary" />
                    <span className="font-bold">{item.product_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-black">{item.quantity}</span>
                    <button 
                      type="button"
                      onClick={() => removeItem(item.product_id)}
                      disabled={loading}
                      className="text-destructive p-2 hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">ملاحظات (اختياري)</label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي ملاحظات إضافية..."
              className="input-field min-h-[100px] resize-none py-4"
              disabled={loading}
            />
          </div>
        </form>
      </FullScreenModal>
    </div>
  );
};