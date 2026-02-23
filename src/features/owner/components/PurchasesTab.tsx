import React, { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { CURRENCY } from '@/constants';
import { ShoppingCart, Package, Calendar, User, Printer } from 'lucide-react';
import FullScreenModal from '@/components/ui/FullScreenModal';
import { escapeHtml, escapeNumber } from '@/lib/htmlEscape';

interface Purchase {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  supplier_name?: string;
  notes?: string;
  created_at: number;
}

export const PurchasesTab: React.FC = () => {
  const { products, addPurchase, purchases = [] } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [supplierName, setSupplierName] = useState('');
  const [notes, setNotes] = useState('');

  const handleProductChange = (productId: string) => {
    setSelectedProduct(productId);
    const product = products.find(p => p.id === productId);
    if (product) {
      setUnitPrice(product.costPrice);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || quantity <= 0) return;
    try {
      await addPurchase(selectedProduct, quantity, unitPrice, supplierName || undefined, notes || undefined);
      setShowModal(false);
      resetForm();
    } catch (err) {
      console.error('Purchase failed:', err);
    }
  };

  const resetForm = () => {
    setSelectedProduct('');
    setQuantity(1);
    setUnitPrice(0);
    setSupplierName('');
    setNotes('');
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <button 
        onClick={() => setShowModal(true)} 
        className="w-full py-5 bg-success text-white rounded-[1.8rem] font-black text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
      >
        <ShoppingCart size={18}/> تسجيل عملية شراء
      </button>

      {/* قائمة المشتريات */}
      <div className="space-y-3">
        {purchases.length === 0 ? (
          <div className="bg-card p-8 rounded-[2.5rem] border text-center">
            <Package size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground font-bold">لا توجد مشتريات مسجلة</p>
          </div>
        ) : (
          purchases.map((purchase: Purchase) => (
            <div key={purchase.id} className="bg-card p-5 rounded-[2.2rem] border shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-black text-foreground">{purchase.product_name}</h3>
                  <p className="text-[10px] text-muted-foreground font-bold flex items-center gap-1 mt-1">
                    <Calendar size={12} />
                    {new Date(purchase.created_at).toLocaleDateString('ar-EG')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      const date = new Date(purchase.created_at);
                      const htmlContent = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>فاتورة شراء</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Segoe UI',Tahoma,sans-serif;width:80mm;padding:5mm;font-size:12px;}.header{text-align:center;margin-bottom:10px;border-bottom:1px dashed #000;padding-bottom:10px;}.org-name{font-size:16px;font-weight:bold;}.invoice-title{font-size:14px;font-weight:bold;margin:10px 0;text-align:center;}.info-row{display:flex;justify-content:space-between;font-size:11px;margin:3px 0;}.total{font-size:14px;font-weight:bold;text-align:center;margin:10px 0;}.footer{text-align:center;font-size:10px;color:#555;margin-top:15px;border-top:1px dashed #000;padding-top:10px;}@media print{body{width:80mm;}}</style></head><body><div class="invoice-title">فاتورة شراء</div><div class="info"><div class="info-row"><span>رقم:</span><span>${escapeHtml(purchase.id.slice(0,8))}</span></div><div class="info-row"><span>التاريخ:</span><span>${escapeHtml(date.toLocaleDateString('ar-SA'))}</span></div><div class="info-row"><span>المورد:</span><span>${escapeHtml(purchase.supplier_name || 'غير محدد')}</span></div></div><div style="margin:10px 0;border-top:1px dashed #000;border-bottom:1px dashed #000;padding:10px 0;"><div class="info-row"><span>المادة:</span><span>${escapeHtml(purchase.product_name)}</span></div><div class="info-row"><span>الكمية:</span><span>${escapeNumber(purchase.quantity)}</span></div><div class="info-row"><span>سعر الوحدة:</span><span>${escapeNumber(purchase.unit_price)}</span></div></div><div class="total">الإجمالي: ${escapeNumber(purchase.total_price)} ${escapeHtml(CURRENCY)}</div><div class="footer"><p>Smart Sales System</p></div></body></html>`;
                      const { printHTML } = await import('@/lib/printService');
                      await printHTML(htmlContent, 'print-iframe-purchase');
                    }}
                    className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors"
                    title="طباعة"
                  >
                    <Printer size={16} />
                  </button>
                  <span className="badge badge-success">{purchase.quantity} وحدة</span>
                </div>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-bold flex items-center gap-1">
                  <User size={14} />
                  {purchase.supplier_name || 'غير محدد'}
                </span>
                <span className="font-black text-success">{purchase.total_price.toLocaleString()} {CURRENCY}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal إضافة شراء - Full Screen */}
      <FullScreenModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); resetForm(); }}
        title="تسجيل شراء مواد"
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
            تأكيد الشراء وزيادة المخزون
          </button>
        }
      >
        <form id="purchase-form" onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">المادة</label>
            <select 
              value={selectedProduct} 
              onChange={(e) => handleProductChange(e.target.value)}
              required
              className="input-field text-base py-4"
            >
              <option value="">اختر المادة...</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.stock} {p.unit})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-muted-foreground uppercase">الكمية</label>
              <input 
                type="number" 
                min="1"
                value={quantity} 
                onChange={(e) => setQuantity(Number(e.target.value))}
                required
                className="input-field text-center text-xl font-black py-4" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-muted-foreground uppercase">سعر الوحدة</label>
              <input 
                type="number" 
                min="0"
                step="0.01"
                value={unitPrice} 
                onChange={(e) => setUnitPrice(Number(e.target.value))}
                required
                className="input-field text-center text-xl font-black py-4" 
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">المورد (اختياري)</label>
            <input 
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="اسم المورد"
              className="input-field py-4" 
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">ملاحظات (اختياري)</label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي ملاحظات إضافية..."
              className="input-field min-h-[100px] resize-none py-4" 
            />
          </div>

          {/* ملخص */}
          <div className="bg-success/10 p-5 rounded-2xl border border-success/20 flex justify-between items-center">
            <span className="font-bold text-muted-foreground">الإجمالي:</span>
            <span className="text-3xl font-black text-success">{(quantity * unitPrice).toLocaleString()} {CURRENCY}</span>
          </div>
        </form>
      </FullScreenModal>
    </div>
  );
};
