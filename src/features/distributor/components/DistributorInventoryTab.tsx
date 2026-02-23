import React, { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  Package, 
  Warehouse, 
  ArrowUpFromLine, 
  Check, 
  Loader2, 
  X, 
  Minus, 
  Plus,
  AlertCircle
} from 'lucide-react';
import FullScreenModal from '@/components/ui/FullScreenModal';

interface TransferItem {
  product_id: string;
  product_name: string;
  quantity: number;
  max_quantity: number;
}

const DistributorInventoryTab: React.FC = () => {
  const { distributorInventory, refreshAllData, addNotification } = useApp();
  const [transferMode, setTransferMode] = useState(false);
  const [transferCart, setTransferCart] = useState<TransferItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const totalItems = distributorInventory.reduce((sum, item) => sum + item.quantity, 0);

  // Only show items with quantity > 0
  const availableItems = distributorInventory.filter(item => item.quantity > 0);

  const toggleTransferItem = (item: typeof distributorInventory[0]) => {
    const exists = transferCart.find(c => c.product_id === item.product_id);
    if (exists) {
      setTransferCart(transferCart.filter(c => c.product_id !== item.product_id));
    } else {
      setTransferCart([...transferCart, {
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity, // default: transfer all
        max_quantity: item.quantity,
      }]);
    }
  };

  const updateTransferQty = (productId: string, delta: number) => {
    setTransferCart(transferCart.map(item => {
      if (item.product_id === productId) {
        const newQty = item.quantity + delta;
        if (newQty <= 0 || newQty > item.max_quantity) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const handleTransfer = async () => {
    if (transferCart.length === 0) return;
    setLoading(true);
    try {
      const items = transferCart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
      }));

      const { error } = await supabase.rpc('transfer_to_main_warehouse_rpc', {
        p_items: items,
      });

      if (error) throw error;

      addNotification('تم إرجاع المواد إلى المستودع الرئيسي بنجاح', 'success');
      setTransferCart([]);
      setTransferMode(false);
      setShowConfirm(false);
      await refreshAllData();
    } catch (err: any) {
      addNotification(err.message || 'حدث خطأ أثناء التحويل', 'error');
    } finally {
      setLoading(false);
    }
  };

  const cancelTransfer = () => {
    setTransferCart([]);
    setTransferMode(false);
  };

  const totalTransferItems = transferCart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-black text-lg flex items-center gap-2">
          <Warehouse className="w-5 h-5 text-primary" />
          مخزني
        </h2>
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold">
            {availableItems.length} صنف • {totalItems} قطعة
          </div>
        </div>
      </div>

      {/* Transfer Mode Toggle */}
      {availableItems.length > 0 && (
        <div>
          {!transferMode ? (
            <button
              onClick={() => setTransferMode(true)}
              className="w-full flex items-center justify-center gap-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold py-3 rounded-2xl hover:bg-amber-500/20 transition-colors"
            >
              <ArrowUpFromLine className="w-5 h-5" />
              إرجاع مواد إلى المستودع الرئيسي
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={cancelTransfer}
                className="flex-1 flex items-center justify-center gap-2 bg-muted text-muted-foreground font-bold py-3 rounded-2xl hover:bg-accent transition-colors"
              >
                <X className="w-4 h-4" />
                إلغاء
              </button>
              <button
                onClick={() => setShowConfirm(true)}
                disabled={transferCart.length === 0}
                className="flex-1 flex items-center justify-center gap-2 bg-amber-500 text-white font-bold py-3 rounded-2xl hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                <Check className="w-4 h-4" />
                تأكيد ({transferCart.length})
              </button>
            </div>
          )}
        </div>
      )}

      {/* Inventory List */}
      {availableItems.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-bold">لا توجد مواد في مخزنك</p>
          <p className="text-muted-foreground/70 text-sm mt-2">
            سيتم إضافة المواد تلقائياً عند استلامها من صاحب المنشأة
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {availableItems.map((item) => {
            const isSelected = transferCart.find(c => c.product_id === item.product_id);
            return (
              <div
                key={item.id}
                className={`rounded-2xl p-4 flex items-center justify-between transition-colors ${
                  transferMode
                    ? isSelected
                      ? 'bg-amber-500/10 border-2 border-amber-500'
                      : 'bg-muted cursor-pointer hover:bg-accent'
                    : 'bg-muted'
                }`}
                onClick={transferMode ? () => toggleTransferItem(item) : undefined}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    isSelected ? 'bg-amber-500 text-white' : 'bg-primary/10'
                  }`}>
                    {isSelected ? (
                      <Check className="w-6 h-6" />
                    ) : (
                      <Package className="w-6 h-6 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      آخر تحديث: {new Date(item.updated_at).toLocaleDateString('ar-EG')}
                    </p>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-2xl font-black text-primary">{item.quantity}</p>
                  <p className="text-xs text-muted-foreground">قطعة</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Transfer Confirmation Modal */}
      <FullScreenModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="تأكيد الإرجاع للمستودع الرئيسي"
        icon={<ArrowUpFromLine size={24} />}
        headerColor="warning"
      >
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 p-4 rounded-2xl flex items-start gap-2 border border-amber-200 dark:border-amber-500/20">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <p className="text-sm font-medium">
              سيتم نقل المواد التالية من مخزنك إلى المستودع الرئيسي. هذه العملية لا يمكن التراجع عنها.
            </p>
          </div>

          {transferCart.map((item) => (
            <div key={item.product_id} className="bg-muted rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-foreground">{item.product_name}</span>
                <button
                  onClick={() => setTransferCart(transferCart.filter(c => c.product_id !== item.product_id))}
                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 bg-card rounded-xl p-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); updateTransferQty(item.product_id, -1); }}
                    className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center hover:bg-accent"
                  >
                    <Minus className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <span className="font-black w-8 text-center text-lg text-foreground">{item.quantity}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); updateTransferQty(item.product_id, 1); }}
                    className="w-9 h-9 bg-amber-500 rounded-lg flex items-center justify-center hover:bg-amber-600"
                  >
                    <Plus className="w-4 h-4 text-white" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">الحد الأقصى: {item.max_quantity}</p>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <span className="font-bold text-muted-foreground">إجمالي القطع</span>
            <span className="font-black text-amber-600 dark:text-amber-400 text-2xl">{totalTransferItems}</span>
          </div>

          <button
            onClick={handleTransfer}
            disabled={loading || transferCart.length === 0}
            className="w-full bg-amber-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none hover:bg-amber-600 transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                جارٍ التحويل...
              </>
            ) : (
              <>
                <ArrowUpFromLine className="w-5 h-5" />
                تأكيد الإرجاع
              </>
            )}
          </button>
        </div>
      </FullScreenModal>
    </div>
  );
};

export default DistributorInventoryTab;
