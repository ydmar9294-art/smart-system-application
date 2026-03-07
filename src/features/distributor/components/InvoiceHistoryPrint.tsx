import React, { useState, useEffect } from 'react';
import {
  Share2,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import FullScreenModal from '@/components/ui/FullScreenModal';
import { CURRENCY } from '@/constants';
import { escapeHtml, escapeNumber } from '@/lib/htmlEscape';
import { buildLegalInfoHtml, buildStampHtml, INVOICE_PAGE_STYLE, INVOICE_FOOTER_HTML } from '@/lib/invoiceHtmlHelpers';

interface LegalInfo {
  commercial_registration?: string;
  industrial_registration?: string;
  tax_identification?: string;
  trademark_name?: string;
  stamp_url?: string;
}

interface InvoiceItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  consumer_price?: number;
  unit?: string;
}

interface InvoiceSnapshot {
  id: string;
  invoice_type: 'sale' | 'return' | 'collection';
  invoice_number: string;
  customer_name: string;
  grand_total: number;
  paid_amount: number;
  remaining: number;
  payment_type: 'CASH' | 'CREDIT' | null;
  items: InvoiceItem[];
  notes: string | null;
  reason: string | null;
  org_name: string | null;
  legal_info: LegalInfo | null;
  invoice_date: string;
  // Discount fields
  discount_type?: 'percentage' | 'fixed' | null;
  discount_percentage?: number;
  discount_value?: number;
  subtotal?: number;
}

interface InvoiceHistoryPrintProps {
  invoice: InvoiceSnapshot;
  onClose: () => void;
}

function buildHistoryHtml(invoice: InvoiceSnapshot, title: string): string {
  const invoiceDate = new Date(invoice.invoice_date);
  const dateStr = invoiceDate.toLocaleDateString('ar-SA');
  const timeStr = invoiceDate.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

  const legalHtml = buildLegalInfoHtml(invoice.legal_info);

  const paymentBadge = invoice.invoice_type === 'sale' && invoice.payment_type ? `
    <div style="text-align:center;padding:4px;margin:6px 0;font-weight:bold;font-size:11px;
      background:${invoice.payment_type === 'CASH' ? '#d1fae5' : '#ffedd5'};
      color:${invoice.payment_type === 'CASH' ? '#047857' : '#c2410c'};">
      ${invoice.payment_type === 'CASH' ? '✓ نقداً (مدفوعة)' : '⏳ آجل'}
    </div>` : '';

  const itemsHtml = invoice.items && invoice.items.length > 0 ? `
    <div style="margin:10px 0;border-top:1px dashed #000;border-bottom:1px dashed #000;padding:10px 0;">
      <table style="width:100%;border-collapse:collapse;font-size:10px;">
        <thead>
          <tr style="font-weight:bold;font-size:9px;color:#555;border-bottom:1px dashed #ccc;">
            <th style="text-align:right;padding:3px 2px;">الصنف</th>
            <th style="text-align:center;padding:3px 2px;">الكمية</th>
            <th style="text-align:center;padding:3px 2px;">السعر</th>
            <th style="text-align:center;padding:3px 2px;">سعر المستهلك</th>
            <th style="text-align:left;padding:3px 2px;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${invoice.items.map((item: any) => `
            <tr style="font-size:11px;border-bottom:1px dashed #eee;">
              <td style="text-align:right;padding:3px 2px;">${escapeHtml(item.product_name)}</td>
              <td style="text-align:center;padding:3px 2px;font-weight:bold;">${escapeNumber(item.quantity)}</td>
              <td style="text-align:center;padding:3px 2px;">${escapeNumber(item.unit_price)}</td>
              <td style="text-align:center;padding:3px 2px;">${item.consumer_price ? escapeNumber(item.consumer_price) : '-'}</td>
              <td style="text-align:left;padding:3px 2px;font-weight:bold;">${escapeNumber(item.total_price)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>` : '';

  const hasDiscount = invoice.discount_value && invoice.discount_value > 0;
  const discountHtml = hasDiscount ? `
    <div style="font-size:11px;margin:5px 0;">
      <div style="display:flex;justify-content:space-between;margin:3px 0;">
        <span>المجموع قبل الخصم:</span><span>${escapeNumber(invoice.subtotal || invoice.grand_total + (invoice.discount_value || 0))} ${escapeHtml(CURRENCY)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin:3px 0;color:#7c3aed;font-weight:bold;">
        <span>الخصم ${invoice.discount_type === 'percentage' ? `(${(invoice.discount_percentage || 0).toFixed(1)}%)` : ''}:</span>
        <span>-${escapeNumber(invoice.discount_value || 0)} ${escapeHtml(CURRENCY)}</span>
      </div>
    </div>` : '';

  const totalsHtml = `
    ${discountHtml}
    <div style="font-size:14px;font-weight:bold;text-align:center;margin:10px 0;${hasDiscount ? 'border-top:1px dashed #7c3aed;padding-top:8px;' : ''}">
      ${invoice.invoice_type === 'collection' ? 'المبلغ المحصّل' : 'الإجمالي الصافي'}: ${escapeNumber(invoice.grand_total)} ${escapeHtml(CURRENCY)}
    </div>
    ${invoice.invoice_type === 'sale' && invoice.payment_type === 'CREDIT' ? `
      <div style="display:flex;justify-content:space-between;font-size:11px;margin:3px 0;">
        <span>المدفوع:</span><span>${escapeNumber(invoice.paid_amount)} ${escapeHtml(CURRENCY)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:bold;color:#c2410c;margin:3px 0;">
        <span>المتبقي:</span><span>${escapeNumber(invoice.remaining)} ${escapeHtml(CURRENCY)}</span>
      </div>` : ''}`;

  const notesHtml = (invoice.notes || invoice.reason) ? `
    <div style="margin-top:10px;padding-top:10px;border-top:1px dashed #000;font-size:10px;color:#555;">
      ${invoice.reason ? `<div>سبب المرتجع: ${escapeHtml(invoice.reason)}</div>` : ''}
      ${invoice.notes ? `<div>ملاحظات: ${escapeHtml(invoice.notes)}</div>` : ''}
    </div>` : '';

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)} - ${escapeHtml(invoice.invoice_number)}</title>
  <style>${INVOICE_PAGE_STYLE}</style>
</head>
<body>
  <div style="text-align:center;margin-bottom:10px;border-bottom:1px dashed #000;padding-bottom:10px;">
    <div style="font-size:16px;font-weight:bold;">${escapeHtml(invoice.org_name || 'اسم المنشأة')}</div>
    ${legalHtml}
  </div>
  <div style="font-size:14px;font-weight:bold;margin:10px 0;text-align:center;">${escapeHtml(title)}</div>
  <div style="font-size:11px;text-align:center;color:#555;margin-bottom:10px;font-family:monospace;">${escapeHtml(invoice.invoice_number)}</div>
  <div style="display:flex;justify-content:space-between;font-size:11px;margin:3px 0;">
    <span>التاريخ:</span><span>${escapeHtml(dateStr)}</span>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:11px;margin:3px 0;">
    <span>الوقت:</span><span>${escapeHtml(timeStr)}</span>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:11px;margin:3px 0;">
    <span>العميل:</span><span>${escapeHtml(invoice.customer_name)}</span>
  </div>
  ${paymentBadge}
  ${itemsHtml}
  ${totalsHtml}
  ${notesHtml}
  ${buildStampHtml(invoice.legal_info)}
  ${INVOICE_FOOTER_HTML}
</body>
</html>`;
}

const InvoiceHistoryPrint: React.FC<InvoiceHistoryPrintProps> = ({ invoice, onClose }) => {
  const [generating, setGenerating]       = useState(false);
  const [pdfBase64, setPdfBase64]         = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<'share' | 'save' | null>(null);
  const [savedOk, setSavedOk]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  const getInvoiceTitle = () => {
    switch (invoice.invoice_type) {
      case 'sale':       return 'فاتورة مبيعات';
      case 'return':     return 'إشعار مرتجع';
      case 'collection': return 'سند قبض';
      default:           return 'فاتورة';
    }
  };

  useEffect(() => {
    const generate = async () => {
      setGenerating(true);
      setError(null);
      try {
        const html = buildHistoryHtml(invoice, getInvoiceTitle());
        const { generateInvoicePdf } = await import('@/lib/invoicePdfService');
        const { pdfBase64: b64 } = await generateInvoicePdf(html, getInvoiceTitle());
        setPdfBase64(b64);
      } catch (err) {
        console.error('[InvoiceHistoryPrint] PDF generation failed:', err);
        setError('تعذّر إنشاء ملف PDF. حاول مرة أخرى.');
      } finally {
        setGenerating(false);
      }
    };
    generate();
  }, []); // eslint-disable-line

  const ensurePdf = async (): Promise<string> => {
    if (pdfBase64) return pdfBase64;
    const html = buildHistoryHtml(invoice, getInvoiceTitle());
    const { generateInvoicePdf } = await import('@/lib/invoicePdfService');
    const { pdfBase64: b64 } = await generateInvoicePdf(html, getInvoiceTitle());
    setPdfBase64(b64);
    return b64;
  };

  const handleShare = async () => {
    setActionLoading('share');
    setError(null);
    try {
      const b64 = await ensurePdf();
      const { shareInvoicePdf, buildInvoiceFileName } = await import('@/lib/invoicePdfService');
      await shareInvoicePdf(b64, buildInvoiceFileName(invoice.id), getInvoiceTitle());
    } catch (err) {
      console.error('[InvoiceHistoryPrint] Share failed:', err);
      setError('تعذّرت المشاركة. حاول مرة أخرى.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSave = async () => {
    setActionLoading('save');
    setError(null);
    try {
      const b64 = await ensurePdf();
      const { saveInvoicePdf, buildInvoiceFileName } = await import('@/lib/invoicePdfService');
      await saveInvoicePdf(b64, buildInvoiceFileName(invoice.id));
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } catch (err) {
      console.error('[InvoiceHistoryPrint] Save failed:', err);
      setError('تعذّر حفظ الملف. تحقق من الصلاحيات وحاول مرة أخرى.');
    } finally {
      setActionLoading(null);
    }
  };

  const invoiceDate = new Date(invoice.invoice_date);
  const hasDiscount = invoice.discount_value && invoice.discount_value > 0;

  const footerContent = (
    <div className="space-y-3">
      <button onClick={handleShare} disabled={generating || actionLoading !== null}
        className="w-full bg-primary text-primary-foreground font-black py-4 rounded-2xl flex items-center justify-center gap-3 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50">
        {actionLoading === 'share'
          ? <><Loader2 className="w-6 h-6 animate-spin" /> جارٍ المشاركة...</>
          : <><Share2 className="w-6 h-6" /> مشاركة الفاتورة</>}
      </button>
      <button onClick={handleSave} disabled={generating || actionLoading !== null}
        className="w-full bg-muted text-foreground font-black py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-muted/80 transition-all active:scale-[0.98] disabled:opacity-50">
        {actionLoading === 'save'
          ? <><Loader2 className="w-6 h-6 animate-spin" /> جارٍ الحفظ...</>
          : savedOk
            ? <><CheckCircle2 className="w-6 h-6 text-green-600" /> تم الحفظ بنجاح!</>
            : <><Download className="w-6 h-6" /> حفظ في جهازك</>}
      </button>
    </div>
  );

  return (
    <FullScreenModal isOpen={true} onClose={onClose}
      title={`تصدير الفاتورة - ${invoice.invoice_number}`}
      icon={<FileText className="w-5 h-5" />}
      headerColor="primary" footer={footerContent}>
      {generating && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="w-4 h-4 animate-spin" /> جارٍ إنشاء ملف PDF...
        </div>
      )}
      {pdfBase64 && !generating && (
        <div className="flex items-center justify-center gap-2 text-sm text-green-600 py-2">
          <CheckCircle2 className="w-4 h-4" />
          <span className="font-bold">جاهز للمشاركة والحفظ</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      <p className="text-sm text-muted-foreground text-center">معاينة الفاتورة</p>
      <div className="bg-background border rounded-xl p-4 text-xs" style={{ fontFamily: 'Segoe UI, Tahoma, sans-serif' }}>
        <div className="text-center border-b border-dashed pb-3 mb-3">
          <div className="text-base font-bold mb-2">{invoice.org_name || 'اسم المنشأة'}</div>
          {invoice.legal_info && (
            <div className="text-[10px] text-muted-foreground space-y-1">
              {invoice.legal_info.trademark_name && <div>العلامة التجارية: {invoice.legal_info.trademark_name}</div>}
              {invoice.legal_info.commercial_registration && <div>سجل تجاري: {invoice.legal_info.commercial_registration}</div>}
              {invoice.legal_info.industrial_registration && <div>سجل صناعي: {invoice.legal_info.industrial_registration}</div>}
              {invoice.legal_info.tax_identification && <div>رقم ضريبي: {invoice.legal_info.tax_identification}</div>}
            </div>
          )}
        </div>

        <div className="text-center font-bold text-sm mb-1">{getInvoiceTitle()}</div>
        <div className="text-center text-[10px] text-muted-foreground font-mono mb-3">{invoice.invoice_number}</div>

        <div className="text-[11px] space-y-1 mb-3">
          <div className="flex justify-between"><span>التاريخ:</span><span>{invoiceDate.toLocaleDateString('ar-SA')}</span></div>
          <div className="flex justify-between"><span>الوقت:</span><span>{invoiceDate.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span></div>
          <div className="flex justify-between"><span>العميل:</span><span>{invoice.customer_name}</span></div>
        </div>

        {invoice.invoice_type === 'sale' && invoice.payment_type && (
          <div className={`text-center py-2 rounded-lg font-bold text-xs mb-3 ${
            invoice.payment_type === 'CASH' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
          }`}>
            {invoice.payment_type === 'CASH' ? '✓ نقداً (مدفوعة)' : '⏳ آجل'}
          </div>
        )}

        {invoice.items && invoice.items.length > 0 && (
          <div className="border-t border-b border-dashed py-3 my-3">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="font-bold text-muted-foreground border-b border-dashed">
                  <th className="text-start pb-1">الصنف</th>
                  <th className="text-center pb-1">الكمية</th>
                  <th className="text-center pb-1">السعر</th>
                  <th className="text-center pb-1">سعر المستهلك</th>
                  <th className="text-start pb-1">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item: any, idx: number) => (
                  <tr key={idx} className="text-[11px]">
                    <td className="py-1">{item.product_name}</td>
                    <td className="text-center py-1">{item.quantity}</td>
                    <td className="text-center py-1">{Number(item.unit_price).toLocaleString()}</td>
                    <td className="text-center py-1">{item.consumer_price ? Number(item.consumer_price).toLocaleString() : '-'}</td>
                    <td className="py-1">{Number(item.total_price).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="text-[11px] space-y-1">
          {hasDiscount && (
            <>
              <div className="flex justify-between">
                <span>المجموع قبل الخصم:</span>
                <span>{Number(invoice.subtotal || invoice.grand_total + (invoice.discount_value || 0)).toLocaleString()} {CURRENCY}</span>
              </div>
              <div className="flex justify-between text-purple-600 font-bold">
                <span>الخصم {invoice.discount_type === 'percentage' ? `(${(invoice.discount_percentage || 0).toFixed(1)}%)` : ''}:</span>
                <span>-{Number(invoice.discount_value || 0).toLocaleString()} {CURRENCY}</span>
              </div>
            </>
          )}
          <div className={`text-center font-bold text-sm py-2 ${hasDiscount ? 'border-t border-purple-300 mt-1' : ''}`}>
            {invoice.invoice_type === 'collection' ? 'المبلغ المحصّل' : 'الإجمالي الصافي'}: {Number(invoice.grand_total).toLocaleString()} {CURRENCY}
          </div>
          {invoice.invoice_type === 'sale' && invoice.payment_type === 'CREDIT' && (
            <>
              <div className="flex justify-between"><span>المدفوع:</span><span>{Number(invoice.paid_amount).toLocaleString()} {CURRENCY}</span></div>
              <div className="flex justify-between font-bold text-orange-600"><span>المتبقي:</span><span>{Number(invoice.remaining).toLocaleString()} {CURRENCY}</span></div>
            </>
          )}
        </div>

        {(invoice.notes || invoice.reason) && (
          <div className="mt-3 pt-3 border-t border-dashed text-[10px] text-muted-foreground">
            {invoice.reason && <div>سبب المرتجع: {invoice.reason}</div>}
            {invoice.notes && <div>ملاحظات: {invoice.notes}</div>}
          </div>
        )}

        <div className="text-center text-[9px] text-muted-foreground mt-4 pt-3 border-t border-dashed">
          <p>شكراً لتعاملكم معنا</p>
          <p className="mt-1">Smart System</p>
        </div>
      </div>
    </FullScreenModal>
  );
};

export default InvoiceHistoryPrint;
