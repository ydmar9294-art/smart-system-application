import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  discount_type?: 'percentage' | 'fixed' | null;
  discount_percentage?: number;
  discount_value?: number;
  subtotal?: number;
}

interface InvoiceHistoryPrintProps {
  invoice: InvoiceSnapshot;
  onClose: () => void;
}

interface HtmlLabels {
  title: string;
  invoiceNumber: string;
  date: string;
  time: string;
  customer: string;
  cashPaid: string;
  creditDeferred: string;
  item: string;
  qty: string;
  price: string;
  consumerPrice: string;
  total: string;
  subtotalBeforeDiscount: string;
  discount: string;
  netTotal: string;
  collectedAmount: string;
  paid: string;
  remaining: string;
  returnReason: string;
  notes: string;
  orgDefault: string;
}

function buildHistoryHtml(invoice: InvoiceSnapshot, labels: HtmlLabels, locale: string, isRtl: boolean): string {
  const invoiceDate = new Date(invoice.invoice_date);
  const dateStr = invoiceDate.toLocaleDateString(locale);
  const timeStr = invoiceDate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const dir = isRtl ? 'rtl' : 'ltr';
  const lang = isRtl ? 'ar' : 'en';
  const textAlign = isRtl ? 'right' : 'left';
  const textAlignEnd = isRtl ? 'left' : 'right';

  const legalHtml = buildLegalInfoHtml(invoice.legal_info);

  const paymentBadge = invoice.invoice_type === 'sale' && invoice.payment_type ? `
    <div style="text-align:center;padding:4px;margin:6px 0;font-weight:bold;font-size:11px;
      background:${invoice.payment_type === 'CASH' ? '#d1fae5' : '#ffedd5'};
      color:${invoice.payment_type === 'CASH' ? '#047857' : '#c2410c'};">
      ${invoice.payment_type === 'CASH' ? escapeHtml(labels.cashPaid) : escapeHtml(labels.creditDeferred)}
    </div>` : '';

  const itemsHtml = invoice.items && invoice.items.length > 0 ? `
    <div style="margin:10px 0;border-top:1px dashed #000;border-bottom:1px dashed #000;padding:10px 0;">
      <table style="width:100%;border-collapse:collapse;font-size:10px;">
        <thead>
          <tr style="font-weight:bold;font-size:9px;color:#555;border-bottom:1px dashed #ccc;">
            <th style="text-align:${textAlign};padding:3px 2px;">${escapeHtml(labels.item)}</th>
            <th style="text-align:center;padding:3px 2px;">${escapeHtml(labels.qty)}</th>
            <th style="text-align:center;padding:3px 2px;">${escapeHtml(labels.price)}</th>
            <th style="text-align:center;padding:3px 2px;">${escapeHtml(labels.consumerPrice)}</th>
            <th style="text-align:${textAlignEnd};padding:3px 2px;">${escapeHtml(labels.total)}</th>
          </tr>
        </thead>
        <tbody>
          ${invoice.items.map((item: any) => `
            <tr style="font-size:11px;border-bottom:1px dashed #eee;">
              <td style="text-align:${textAlign};padding:3px 2px;">${escapeHtml(item.product_name)}</td>
              <td style="text-align:center;padding:3px 2px;font-weight:bold;">${escapeNumber(item.quantity)}</td>
              <td style="text-align:center;padding:3px 2px;">${escapeNumber(item.unit_price)}</td>
              <td style="text-align:center;padding:3px 2px;">${item.consumer_price ? escapeNumber(item.consumer_price) : '-'}</td>
              <td style="text-align:${textAlignEnd};padding:3px 2px;font-weight:bold;">${escapeNumber(item.total_price)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>` : '';

  const hasDiscount = invoice.discount_value && invoice.discount_value > 0;
  const discountHtml = hasDiscount ? `
    <div style="font-size:11px;margin:5px 0;">
      <div style="display:flex;justify-content:space-between;margin:3px 0;">
        <span>${escapeHtml(labels.subtotalBeforeDiscount)}:</span><span>${escapeNumber(invoice.subtotal || invoice.grand_total + (invoice.discount_value || 0))} ${escapeHtml(CURRENCY)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin:3px 0;color:#7c3aed;font-weight:bold;">
        <span>${escapeHtml(labels.discount)} ${invoice.discount_type === 'percentage' ? `(${(invoice.discount_percentage || 0).toFixed(1)}%)` : ''}:</span>
        <span>-${escapeNumber(invoice.discount_value || 0)} ${escapeHtml(CURRENCY)}</span>
      </div>
    </div>` : '';

  const totalLabel = invoice.invoice_type === 'collection' ? labels.collectedAmount : labels.netTotal;

  const totalsHtml = `
    ${discountHtml}
    <div style="font-size:14px;font-weight:bold;text-align:center;margin:10px 0;${hasDiscount ? 'border-top:1px dashed #7c3aed;padding-top:8px;' : ''}">
      ${escapeHtml(totalLabel)}: ${escapeNumber(invoice.grand_total)} ${escapeHtml(CURRENCY)}
    </div>
    ${invoice.invoice_type === 'sale' && invoice.payment_type === 'CREDIT' ? `
      <div style="display:flex;justify-content:space-between;font-size:11px;margin:3px 0;">
        <span>${escapeHtml(labels.paid)}:</span><span>${escapeNumber(invoice.paid_amount)} ${escapeHtml(CURRENCY)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:bold;color:#c2410c;margin:3px 0;">
        <span>${escapeHtml(labels.remaining)}:</span><span>${escapeNumber(invoice.remaining)} ${escapeHtml(CURRENCY)}</span>
      </div>` : ''}`;

  const notesHtml = (invoice.notes || invoice.reason) ? `
    <div style="margin-top:10px;padding-top:10px;border-top:1px dashed #000;font-size:10px;color:#555;">
      ${invoice.reason ? `<div>${escapeHtml(labels.returnReason)}: ${escapeHtml(invoice.reason)}</div>` : ''}
      ${invoice.notes ? `<div>${escapeHtml(labels.notes)}: ${escapeHtml(invoice.notes)}</div>` : ''}
    </div>` : '';

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(labels.title)} - ${escapeHtml(invoice.invoice_number)}</title>
  <style>${INVOICE_PAGE_STYLE}</style>
</head>
<body>
  <div style="text-align:center;margin-bottom:10px;border-bottom:1px dashed #000;padding-bottom:10px;">
    <div style="font-size:16px;font-weight:bold;">${escapeHtml(invoice.org_name || labels.orgDefault)}</div>
    ${legalHtml}
  </div>
  <div style="font-size:14px;font-weight:bold;margin:10px 0;text-align:center;">${escapeHtml(labels.title)}</div>
  <div style="font-size:11px;text-align:center;color:#555;margin-bottom:10px;font-family:monospace;">${escapeHtml(invoice.invoice_number)}</div>
  <div style="display:flex;justify-content:space-between;font-size:11px;margin:3px 0;">
    <span>${escapeHtml(labels.date)}:</span><span>${escapeHtml(dateStr)}</span>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:11px;margin:3px 0;">
    <span>${escapeHtml(labels.time)}:</span><span>${escapeHtml(timeStr)}</span>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:11px;margin:3px 0;">
    <span>${escapeHtml(labels.customer)}:</span><span>${escapeHtml(invoice.customer_name)}</span>
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
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const locale = isRtl ? 'ar-SA' : 'en-US';

  const [generating, setGenerating]       = useState(false);
  const [pdfBase64, setPdfBase64]         = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<'share' | 'save' | null>(null);
  const [savedOk, setSavedOk]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  const getInvoiceTitle = () => {
    switch (invoice.invoice_type) {
      case 'sale':       return t('invoice.saleInvoice');
      case 'return':     return t('invoice.returnNotice');
      case 'collection': return t('invoice.receiptVoucher');
      default:           return t('invoice.document');
    }
  };

  const getLabels = (): HtmlLabels => ({
    title: getInvoiceTitle(),
    invoiceNumber: t('invoice.invoiceNumber'),
    date: t('invoice.dateLabel'),
    time: t('invoice.timeLabel'),
    customer: t('invoice.customerLabel'),
    cashPaid: t('invoice.cashPaid'),
    creditDeferred: t('invoice.creditDeferred'),
    item: t('invoice.itemLabel'),
    qty: t('invoice.quantity'),
    price: t('invoice.price'),
    consumerPrice: t('invoice.consumerPrice'),
    total: t('invoice.totalLabel'),
    subtotalBeforeDiscount: t('invoice.subtotalBeforeDiscount'),
    discount: t('invoice.discountLabel'),
    netTotal: t('invoice.netTotalLabel'),
    collectedAmount: t('invoice.collectedAmount'),
    paid: t('invoice.paidLabel'),
    remaining: t('invoice.remainingLabel'),
    returnReason: t('invoice.returnReason'),
    notes: t('invoice.notesLabel'),
    orgDefault: t('invoice.orgNameDefault'),
  });

  useEffect(() => {
    const generate = async () => {
      setGenerating(true);
      setError(null);
      try {
        const html = buildHistoryHtml(invoice, getLabels(), locale, isRtl);
        const { generateInvoicePdf } = await import('@/lib/invoicePdfService');
        const { pdfBase64: b64 } = await generateInvoicePdf(html, getInvoiceTitle());
        setPdfBase64(b64);
      } catch (err) {
        console.error('[InvoiceHistoryPrint] PDF generation failed:', err);
        setError(t('invoice.pdfError'));
      } finally {
        setGenerating(false);
      }
    };
    generate();
  }, []); // eslint-disable-line

  const ensurePdf = async (): Promise<string> => {
    if (pdfBase64) return pdfBase64;
    const html = buildHistoryHtml(invoice, getLabels(), locale, isRtl);
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
      setError(t('invoice.shareError'));
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
      setError(t('invoice.saveError'));
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
          ? <><Loader2 className="w-6 h-6 animate-spin" /> {t('invoice.sharing')}</>
          : <><Share2 className="w-6 h-6" /> {t('invoice.shareInvoice')}</>}
      </button>
      <button onClick={handleSave} disabled={generating || actionLoading !== null}
        className="w-full bg-muted text-foreground font-black py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-muted/80 transition-all active:scale-[0.98] disabled:opacity-50">
        {actionLoading === 'save'
          ? <><Loader2 className="w-6 h-6 animate-spin" /> {t('invoice.savingFile')}</>
          : savedOk
            ? <><CheckCircle2 className="w-6 h-6 text-green-600" /> {t('invoice.savedSuccess')}</>
            : <><Download className="w-6 h-6" /> {t('invoice.saveToDevice')}</>}
      </button>
    </div>
  );

  return (
    <FullScreenModal isOpen={true} onClose={onClose}
      title={`${t('invoice.exportInvoice')} - ${invoice.invoice_number}`}
      icon={<FileText className="w-5 h-5" />}
      headerColor="primary" footer={footerContent}>
      {generating && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="w-4 h-4 animate-spin" /> {t('invoice.generatingPdf')}
        </div>
      )}
      {pdfBase64 && !generating && (
        <div className="flex items-center justify-center gap-2 text-sm text-green-600 py-2">
          <CheckCircle2 className="w-4 h-4" />
          <span className="font-bold">{t('invoice.readyToShare')}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      <p className="text-sm text-muted-foreground text-center">{t('invoice.previewInvoice')}</p>
      <div className="bg-background border rounded-xl p-4 text-xs" dir={isRtl ? 'rtl' : 'ltr'} style={{ fontFamily: 'Segoe UI, Tahoma, sans-serif' }}>
        <div className="text-center border-b border-dashed pb-3 mb-3">
          <div className="text-base font-bold mb-2">{invoice.org_name || t('invoice.orgNameDefault')}</div>
          {invoice.legal_info && (
            <div className="text-[10px] text-muted-foreground space-y-1">
              {invoice.legal_info.trademark_name && <div>{invoice.legal_info.trademark_name}</div>}
              {invoice.legal_info.commercial_registration && <div>{invoice.legal_info.commercial_registration}</div>}
              {invoice.legal_info.industrial_registration && <div>{invoice.legal_info.industrial_registration}</div>}
              {invoice.legal_info.tax_identification && <div>{invoice.legal_info.tax_identification}</div>}
            </div>
          )}
        </div>

        <div className="text-center font-bold text-sm mb-1">{getInvoiceTitle()}</div>
        <div className="text-center text-[10px] text-muted-foreground font-mono mb-3">{invoice.invoice_number}</div>

        <div className="text-[11px] space-y-1 mb-3">
          <div className="flex justify-between"><span>{t('invoice.dateLabel')}:</span><span>{invoiceDate.toLocaleDateString(locale)}</span></div>
          <div className="flex justify-between"><span>{t('invoice.timeLabel')}:</span><span>{invoiceDate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</span></div>
          <div className="flex justify-between"><span>{t('invoice.customerLabel')}:</span><span>{invoice.customer_name}</span></div>
        </div>

        {invoice.invoice_type === 'sale' && invoice.payment_type && (
          <div className={`text-center py-2 rounded-lg font-bold text-xs mb-3 ${
            invoice.payment_type === 'CASH' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
          }`}>
            {invoice.payment_type === 'CASH' ? t('invoice.cashPaid') : t('invoice.creditDeferred')}
          </div>
        )}

        {invoice.items && invoice.items.length > 0 && (
          <div className="border-t border-b border-dashed py-3 my-3">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="font-bold text-muted-foreground border-b border-dashed">
                  <th className="text-start pb-1">{t('invoice.itemLabel')}</th>
                  <th className="text-center pb-1">{t('invoice.quantity')}</th>
                  <th className="text-center pb-1">{t('invoice.price')}</th>
                  <th className="text-center pb-1">{t('invoice.consumerPrice')}</th>
                  <th className="text-start pb-1">{t('invoice.totalLabel')}</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item: any, idx: number) => (
                  <tr key={idx} className="text-[11px]">
                    <td className="py-1">{item.product_name}</td>
                    <td className="text-center py-1">{item.quantity}</td>
                    <td className="text-center py-1">{Number(item.unit_price).toLocaleString(locale)}</td>
                    <td className="text-center py-1">{item.consumer_price ? Number(item.consumer_price).toLocaleString(locale) : '-'}</td>
                    <td className="py-1">{Number(item.total_price).toLocaleString(locale)}</td>
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
                <span>{t('invoice.subtotalBeforeDiscount')}:</span>
                <span>{Number(invoice.subtotal || invoice.grand_total + (invoice.discount_value || 0)).toLocaleString(locale)} {CURRENCY}</span>
              </div>
              <div className="flex justify-between text-purple-600 font-bold">
                <span>{t('invoice.discountLabel')} {invoice.discount_type === 'percentage' ? `(${(invoice.discount_percentage || 0).toFixed(1)}%)` : ''}:</span>
                <span>-{Number(invoice.discount_value || 0).toLocaleString(locale)} {CURRENCY}</span>
              </div>
            </>
          )}
          <div className={`text-center font-bold text-sm py-2 ${hasDiscount ? 'border-t border-purple-300 mt-1' : ''}`}>
            {invoice.invoice_type === 'collection' ? t('invoice.collectedAmount') : t('invoice.netTotalLabel')}: {Number(invoice.grand_total).toLocaleString(locale)} {CURRENCY}
          </div>
          {invoice.invoice_type === 'sale' && invoice.payment_type === 'CREDIT' && (
            <>
              <div className="flex justify-between"><span>{t('invoice.paidLabel')}:</span><span>{Number(invoice.paid_amount).toLocaleString(locale)} {CURRENCY}</span></div>
              <div className="flex justify-between font-bold text-orange-600"><span>{t('invoice.remainingLabel')}:</span><span>{Number(invoice.remaining).toLocaleString(locale)} {CURRENCY}</span></div>
            </>
          )}
        </div>

        {(invoice.notes || invoice.reason) && (
          <div className="mt-3 pt-3 border-t border-dashed text-[10px] text-muted-foreground">
            {invoice.reason && <div>{t('invoice.returnReason')}: {invoice.reason}</div>}
            {invoice.notes && <div>{t('invoice.notesLabel')}: {invoice.notes}</div>}
          </div>
        )}

        <div className="text-center text-[9px] text-muted-foreground mt-4 pt-3 border-t border-dashed">
          <p>{t('invoice.thankYou')}</p>
          <p className="mt-1">Smart System</p>
        </div>
      </div>
    </FullScreenModal>
  );
};

export default InvoiceHistoryPrint;
