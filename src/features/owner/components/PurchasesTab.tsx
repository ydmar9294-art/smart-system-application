import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/store/AppContext';
import { CURRENCY } from '@/constants';
import { ShoppingCart, Package, Calendar, User, Share2, Download, Loader2, CheckCircle2, Receipt } from 'lucide-react';
import FullScreenModal from '@/components/ui/FullScreenModal';
import { escapeHtml, escapeNumber } from '@/lib/htmlEscape';
import { buildLegalInfoHtml, buildStampHtml, INVOICE_PAGE_STYLE, INVOICE_FOOTER_HTML, type InvoiceLegalInfo } from '@/lib/invoiceHtmlHelpers';

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

function buildPurchaseHtml(params: {
  orgName: string;
  purchase: Purchase;
  legalInfo?: InvoiceLegalInfo | null;
}): string {
  const { orgName, purchase, legalInfo } = params;
  const date = new Date(purchase.created_at);
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>فاتورة شراء</title>
  <style>${INVOICE_PAGE_STYLE}</style>
</head>
<body>
  <div style="text-align:center;margin-bottom:10px;border-bottom:1px solid #ccc;padding-bottom:10px;">
    <div style="font-size:18px;font-weight:bold;">${escapeHtml(orgName || 'اسم المنشأة')}</div>
    ${buildLegalInfoHtml(legalInfo)}
  </div>
  <div style="font-size:16px;font-weight:bold;margin:12px 0;text-align:center;">فاتورة شراء</div>
  <div style="display:flex;justify-content:space-between;font-size:12px;margin:4px 0;">
    <span>رقم:</span><span dir="ltr">${escapeHtml(purchase.id.slice(0, 8))}</span>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:12px;margin:4px 0;">
    <span>التاريخ:</span><span>${escapeHtml(date.toLocaleDateString('ar-SA'))}</span>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:12px;margin:4px 0;">
    <span>الوقت:</span><span>${escapeHtml(date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }))}</span>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:12px;margin:4px 0;">
    <span>المورد:</span><span>${escapeHtml(purchase.supplier_name || 'غير محدد')}</span>
  </div>
  <div style="margin:12px 0;border-top:1px solid #ccc;border-bottom:1px solid #ccc;padding:12px 0;">
    <div style="display:flex;justify-content:space-between;font-size:12px;margin:4px 0;">
      <span>المادة:</span><span>${escapeHtml(purchase.product_name)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:12px;margin:4px 0;">
      <span>الكمية:</span><span>${escapeNumber(purchase.quantity)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:12px;margin:4px 0;">
      <span>سعر الوحدة:</span><span>${escapeNumber(purchase.unit_price)}</span>
    </div>
  </div>
  <div style="font-size:16px;font-weight:bold;text-align:center;margin:12px 0;">
    الإجمالي: ${escapeNumber(purchase.total_price)} ${escapeHtml(CURRENCY)}
  </div>
  ${purchase.notes ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #ccc;font-size:11px;color:#555;">ملاحظات: ${escapeHtml(purchase.notes)}</div>` : ''}
  ${buildStampHtml(legalInfo)}
  ${INVOICE_FOOTER_HTML}
</body>
</html>`;
}

// ── Purchase Invoice Preview Modal ──────────────────────────────────────────
const PurchaseInvoiceModal: React.FC<{
  purchase: Purchase;
  orgName: string;
  onClose: () => void;
}> = ({ purchase, orgName, onClose }) => {
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [actionLoading, setActionLoading] = useState<'share' | 'save' | null>(null);
  const [savedOk, setSavedOk] = useState(false);
  const [legalInfo, setLegalInfo] = useState<InvoiceLegalInfo | null>(null);
  const date = new Date(purchase.created_at);

  React.useEffect(() => {
    const generate = async () => {
      setGenerating(true);
      try {
        // Fetch legal info
        const { data: { user } } = await supabase.auth.getUser();
        let fetchedLegal: InvoiceLegalInfo | null = null;
        if (user) {
          const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
          if (profile?.organization_id) {
            const { data } = await supabase.from('organization_legal_info')
              .select('commercial_registration, industrial_registration, tax_identification, trademark_name, stamp_url')
              .eq('organization_id', profile.organization_id).maybeSingle();
            if (data) fetchedLegal = data;
          }
        }
        setLegalInfo(fetchedLegal);

        const html = buildPurchaseHtml({ orgName, purchase, legalInfo: fetchedLegal });
        const { generateInvoicePdf } = await import('@/lib/invoicePdfService');
        const { pdfBase64: b64 } = await generateInvoicePdf(html, 'فاتورة شراء');
        setPdfBase64(b64);
      } catch (err) {
        console.error('[PurchaseInvoice] PDF generation failed:', err);
      } finally {
        setGenerating(false);
      }
    };
    generate();
  }, []); // eslint-disable-line

  const ensurePdf = async (): Promise<string> => {
    if (pdfBase64) return pdfBase64;
    const html = buildPurchaseHtml({ orgName, purchase, legalInfo });
    const { generateInvoicePdf } = await import('@/lib/invoicePdfService');
    const { pdfBase64: b64 } = await generateInvoicePdf(html, 'فاتورة شراء');
    setPdfBase64(b64);
    return b64;
  };

  const handleShare = async () => {
    setActionLoading('share');
    try {
      const b64 = await ensurePdf();
      const { shareInvoicePdf, buildInvoiceFileName } = await import('@/lib/invoicePdfService');
      await shareInvoicePdf(b64, buildInvoiceFileName(purchase.id), 'فاتورة شراء');
    } catch (err) {
      console.error('[PurchaseInvoice] Share failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSave = async () => {
    setActionLoading('save');
    try {
      const b64 = await ensurePdf();
      const { saveInvoicePdf, buildInvoiceFileName } = await import('@/lib/invoicePdfService');
      await saveInvoicePdf(b64, buildInvoiceFileName(purchase.id));
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } catch (err) {
      console.error('[PurchaseInvoice] Save failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <FullScreenModal
      isOpen={true}
      onClose={onClose}
      title="تصدير فاتورة الشراء"
      icon={<Receipt size={24} />}
      headerColor="primary"
      footer={
        <div className="space-y-3">
          {generating && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              جارٍ إنشاء ملف PDF...
            </div>
          )}
          {pdfBase64 && !generating && (
            <div className="flex items-center justify-center gap-2 text-sm text-green-600 py-1">
              <CheckCircle2 className="w-4 h-4" />
              <span className="font-bold">جاهز للمشاركة والحفظ</span>
            </div>
          )}
          <button
            onClick={handleShare}
            disabled={generating || actionLoading !== null}
            className="w-full bg-primary text-primary-foreground font-black py-5 rounded-2xl flex items-center justify-center gap-3 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {actionLoading === 'share'
              ? <><Loader2 className="w-6 h-6 animate-spin" /> جارٍ المشاركة...</>
              : <><Share2 className="w-6 h-6" /> مشاركة الفاتورة</>
            }
          </button>
          <button
            onClick={handleSave}
            disabled={generating || actionLoading !== null}
            className="w-full bg-muted text-foreground font-black py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-muted/80 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {actionLoading === 'save'
              ? <><Loader2 className="w-6 h-6 animate-spin" /> جارٍ الحفظ...</>
              : savedOk
                ? <><CheckCircle2 className="w-6 h-6 text-green-500" /> تم الحفظ بنجاح!</>
                : <><Download className="w-6 h-6" /> حفظ في جهازك</>
            }
          </button>
        </div>
      }
    >
      {/* Invoice Preview */}
      <p className="text-sm text-muted-foreground text-center mb-4">معاينة الفاتورة</p>
      <div className="bg-card border rounded-2xl p-5 text-sm" style={{ fontFamily: 'Segoe UI, Tahoma, sans-serif' }}>
        <div className="text-center border-b border-dashed pb-4 mb-4">
          <div className="text-lg font-bold">{orgName || 'اسم المنشأة'}</div>
        </div>
        <div className="text-center font-bold text-base mb-4">فاتورة شراء</div>
        <div className="text-sm space-y-2 mb-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">رقم:</span>
            <span dir="ltr" className="font-bold">{purchase.id.slice(0, 8)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">التاريخ:</span>
            <span className="font-bold">{date.toLocaleDateString('ar-SA')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">المورد:</span>
            <span className="font-bold">{purchase.supplier_name || 'غير محدد'}</span>
          </div>
        </div>

        <div className="border-t border-b border-dashed py-4 my-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">المادة:</span>
            <span className="font-bold">{purchase.product_name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">الكمية:</span>
            <span className="font-bold">{purchase.quantity}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">سعر الوحدة:</span>
            <span className="font-bold">{purchase.unit_price.toLocaleString()} {CURRENCY}</span>
          </div>
        </div>

        <div className="text-center font-black text-lg py-3 bg-muted rounded-xl">
          الإجمالي: {purchase.total_price.toLocaleString()} {CURRENCY}
        </div>

        {purchase.notes && (
          <div className="mt-4 pt-4 border-t border-dashed text-sm text-muted-foreground">
            ملاحظات: {purchase.notes}
          </div>
        )}

        <div className="text-center text-xs text-muted-foreground mt-6 pt-4 border-t border-dashed">
          <p>Smart Sales System</p>
        </div>
      </div>
    </FullScreenModal>
  );
};

// ── Main PurchasesTab ───────────────────────────────────────────────────────
export const PurchasesTab: React.FC = () => {
  const { products, addPurchase, purchases = [] } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [notes, setNotes] = useState('');
  const [printPurchase, setPrintPurchase] = useState<Purchase | null>(null);
  const [orgName, setOrgName] = useState('');

  // Fetch org name once
  React.useEffect(() => {
    const fetchOrg = async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
        if (!profile?.organization_id) return;
        const { data: org } = await supabase.from('organizations').select('name').eq('id', profile.organization_id).single();
        if (org) setOrgName(org.name);
      } catch (_) { /* ignore */ }
    };
    fetchOrg();
  }, []);

  const handleProductChange = (productId: string) => {
    setSelectedProduct(productId);
    const product = products.find(p => p.id === productId);
    if (product) {
      setUnitPrice(String(product.costPrice));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || quantity <= 0) return;
    try {
      await addPurchase(selectedProduct, quantity, Number(unitPrice), supplierName || undefined, notes || undefined);
      setShowModal(false);
      resetForm();
    } catch (err) {
      console.error('Purchase failed:', err);
    }
  };

  const resetForm = () => {
    setSelectedProduct('');
    setQuantity(1);
    setUnitPrice('');
    setSupplierName('');
    setNotes('');
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Purchase Invoice Modal */}
      {printPurchase && (
        <PurchaseInvoiceModal
          purchase={printPurchase}
          orgName={orgName}
          onClose={() => setPrintPurchase(null)}
        />
      )}

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
                    onClick={() => setPrintPurchase(purchase)}
                    className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors"
                    title="معاينة ومشاركة"
                  >
                    <Receipt size={16} />
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
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0"
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
            <span className="text-3xl font-black text-success">{(quantity * Number(unitPrice)).toLocaleString()} {CURRENCY}</span>
          </div>
        </form>
      </FullScreenModal>
    </div>
  );
};