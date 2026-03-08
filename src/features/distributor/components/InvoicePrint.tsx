/**
 * InvoicePrint — builds a CLEAN HTML string from data (never from DOM.innerHTML).
 * Supports discount display in preview and PDF export.
 * Fully localized with i18n.
 */
import React, { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { useTranslation } from 'react-i18next';
import { Share2, Download, Loader2, Receipt, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cacheOrgInfo, getCachedOrgInfo } from '../services/distributorOfflineService';
import { CURRENCY } from '@/constants';
import FullScreenModal from '@/components/ui/FullScreenModal';
import { escapeHtml, escapeNumber } from '@/lib/htmlEscape';
import { buildLegalInfoHtml, buildStampHtml, INVOICE_PAGE_STYLE, INVOICE_FOOTER_HTML } from '@/lib/invoiceHtmlHelpers';

interface LegalInfo {
  commercial_registration: string | null;
  industrial_registration: string | null;
  tax_identification: string | null;
  trademark_name: string | null;
  stamp_url?: string | null;
}

interface InvoiceItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  consumer_price?: number;
  unit?: string;
}

interface InvoicePrintProps {
  invoiceType: 'sale' | 'return' | 'collection';
  invoiceId: string;
  customerName: string;
  date: Date;
  items?: InvoiceItem[];
  grandTotal: number;
  subtotal?: number;
  discountType?: 'percentage' | 'fixed' | null;
  discountPercentage?: number;
  discountValue?: number;
  paidAmount?: number;
  remaining?: number;
  notes?: string;
  paymentType?: 'CASH' | 'CREDIT';
  onClose: () => void;
}

// Translation labels interface for HTML builder
interface InvoiceLabels {
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
  unit: string;
  consumerPrice: string;
  total: string;
  subtotalBeforeDiscount: string;
  discount: string;
  netTotal: string;
  collectedAmount: string;
  paid: string;
  remaining: string;
  notes: string;
  thankYou: string;
  orgDefault: string;
  trademark: string;
  commercialReg: string;
  industrialReg: string;
  taxId: string;
  paymentStatus: string;
}

// ─── Pure function: builds a clean, self-contained HTML string ─────────────────
function buildInvoiceHtml(params: {
  labels: InvoiceLabels;
  locale: string;
  isRtl: boolean;
  orgName: string;
  legalInfo: LegalInfo | null;
  invoiceId: string;
  date: Date;
  customerName: string;
  invoiceType: 'sale' | 'return' | 'collection';
  paymentType?: 'CASH' | 'CREDIT';
  items: InvoiceItem[];
  grandTotal: number;
  subtotal?: number;
  discountType?: 'percentage' | 'fixed' | null;
  discountPercentage?: number;
  discountValue?: number;
  paidAmount?: number;
  remaining?: number;
  notes?: string;
}): string {
  const {
    labels, locale, isRtl, orgName, legalInfo, invoiceId, date,
    customerName, invoiceType, paymentType,
    items, grandTotal, subtotal, discountType, discountPercentage, discountValue,
    paidAmount, remaining, notes
  } = params;

  const dir = isRtl ? 'rtl' : 'ltr';
  const lang = isRtl ? 'ar' : 'en';
  const textAlign = isRtl ? 'right' : 'left';
  const textAlignEnd = isRtl ? 'left' : 'right';

  const dateStr = date.toLocaleDateString(locale);
  const timeStr = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  const legalHtml = buildLegalInfoHtml(legalInfo);

  const paymentBadge = paymentType && invoiceType === 'sale' ? `
    <div style="text-align:center;padding:4px;margin:6px 0;font-weight:bold;font-size:11px;
      background:${paymentType === 'CASH' ? '#d1fae5' : '#ffedd5'};
      color:${paymentType === 'CASH' ? '#047857' : '#c2410c'};">
      ${paymentType === 'CASH' ? escapeHtml(labels.cashPaid) : escapeHtml(labels.creditDeferred)}
    </div>` : '';

  const itemsHtml = items.length > 0 ? `
    <div style="margin:10px 0;border-top:1px dashed #000;border-bottom:1px dashed #000;padding:10px 0;">
      <table style="width:100%;border-collapse:collapse;font-size:10px;">
        <thead>
          <tr style="font-weight:bold;font-size:9px;color:#555;border-bottom:1px dashed #ccc;">
            <th style="text-align:${textAlign};padding:3px 2px;">${escapeHtml(labels.item)}</th>
            <th style="text-align:center;padding:3px 2px;">${escapeHtml(labels.qty)}</th>
            <th style="text-align:center;padding:3px 2px;">${escapeHtml(labels.price)}</th>
            ${items.some((i) => i.unit) ? `<th style="text-align:center;padding:3px 2px;">${escapeHtml(labels.unit)}</th>` : ''}
            ${items.some((i) => i.consumer_price) ? `<th style="text-align:center;padding:3px 2px;">${escapeHtml(labels.consumerPrice)}</th>` : ''}
            <th style="text-align:${textAlignEnd};padding:3px 2px;">${escapeHtml(labels.total)}</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item) => `
            <tr style="font-size:11px;border-bottom:1px dashed #eee;">
              <td style="text-align:${textAlign};padding:3px 2px;">${escapeHtml(item.product_name)}</td>
              <td style="text-align:center;padding:3px 2px;font-weight:bold;">${escapeNumber(item.quantity)}</td>
              <td style="text-align:center;padding:3px 2px;">${escapeNumber(item.unit_price)}</td>
              ${items.some((i) => i.unit) ? `<td style="text-align:center;padding:3px 2px;">${escapeHtml(item.unit || '-')}</td>` : ''}
              ${items.some((i) => i.consumer_price) ? `<td style="text-align:center;padding:3px 2px;">${item.consumer_price ? escapeNumber(item.consumer_price) : '-'}</td>` : ''}
              <td style="text-align:${textAlignEnd};padding:3px 2px;font-weight:bold;">${escapeNumber(item.total_price)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>` : '';

  // Discount HTML for PDF
  const hasDiscount = discountValue && discountValue > 0;
  const discountHtml = hasDiscount ? `
    <div style="font-size:11px;margin:5px 0;">
      <div style="display:flex;justify-content:space-between;margin:3px 0;">
        <span>${escapeHtml(labels.subtotalBeforeDiscount)}:</span><span>${escapeNumber(subtotal || grandTotal + discountValue)} ${escapeHtml(CURRENCY)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin:3px 0;color:#7c3aed;font-weight:bold;">
        <span>${escapeHtml(labels.discount)} ${discountType === 'percentage' ? `(${(discountPercentage || 0).toFixed(1)}%)` : ''}:</span>
        <span>-${escapeNumber(discountValue)} ${escapeHtml(CURRENCY)}</span>
      </div>
    </div>` : '';

  const totalLabelText = invoiceType === 'collection' ? labels.collectedAmount : labels.netTotal;

  const totalsHtml = `
    ${discountHtml}
    <div style="font-size:14px;font-weight:bold;text-align:center;margin:10px 0;${hasDiscount ? 'border-top:1px dashed #7c3aed;padding-top:8px;' : ''}">
      ${escapeHtml(totalLabelText)}: ${escapeNumber(grandTotal)} ${escapeHtml(CURRENCY)}
    </div>
    ${invoiceType === 'sale' && paymentType === 'CREDIT' && paidAmount !== undefined ? `
      <div style="display:flex;justify-content:space-between;font-size:11px;margin:3px 0;">
        <span>${escapeHtml(labels.paid)}:</span><span>${escapeNumber(paidAmount)} ${escapeHtml(CURRENCY)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:bold;color:#c2410c;margin:3px 0;">
        <span>${escapeHtml(labels.remaining)}:</span><span>${escapeNumber(remaining ?? 0)} ${escapeHtml(CURRENCY)}</span>
      </div>
    ` : ''}`;

  const notesHtml = notes ? `
    <div style="margin-top:10px;padding-top:10px;border-top:1px dashed #000;font-size:10px;color:#555;">
      ${escapeHtml(labels.notes)}: ${escapeHtml(notes)}
    </div>` : '';

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(labels.title)}</title>
  <style>${INVOICE_PAGE_STYLE}</style>
</head>
<body>
  <div style="text-align:center;margin-bottom:10px;border-bottom:1px dashed #000;padding-bottom:10px;">
    <div style="font-size:16px;font-weight:bold;">${escapeHtml(orgName || labels.orgDefault)}</div>
    ${legalHtml}
  </div>
  <div style="font-size:14px;font-weight:bold;margin:10px 0;text-align:center;">${escapeHtml(labels.title)}</div>
  <div style="display:flex;justify-content:space-between;font-size:11px;margin:3px 0;">
    <span>${escapeHtml(labels.invoiceNumber)}:</span><span dir="ltr">${escapeHtml(invoiceId.slice(0, 8))}</span>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:11px;margin:3px 0;">
    <span>${escapeHtml(labels.date)}:</span><span>${escapeHtml(dateStr)}</span>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:11px;margin:3px 0;">
    <span>${escapeHtml(labels.time)}:</span><span>${escapeHtml(timeStr)}</span>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:11px;margin:3px 0;">
    <span>${escapeHtml(labels.customer)}:</span><span>${escapeHtml(customerName)}</span>
  </div>
  ${paymentBadge}
  ${itemsHtml}
  ${totalsHtml}
  ${notesHtml}
  ${buildStampHtml(legalInfo)}
  ${INVOICE_FOOTER_HTML}
</body>
</html>`;
}

// ─── Component ─────────────────────────────────────────────────────────────────

const InvoicePrint: React.FC<InvoicePrintProps> = ({
  invoiceType,
  invoiceId,
  customerName,
  date,
  items = [],
  grandTotal,
  subtotal,
  discountType,
  discountPercentage,
  discountValue,
  paidAmount,
  remaining,
  notes,
  paymentType,
  onClose
}) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const locale = isRtl ? 'ar-SA' : 'en-US';

  const [legalInfo, setLegalInfo] = useState<LegalInfo | null>(null);
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<'share' | 'save' | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    const fetchLegalInfo = async () => {
      setLoading(true);
      try {
        const cached = await getCachedOrgInfo();
        if (cached) {
          setOrgName(cached.orgName);
          setLegalInfo(cached.legalInfo);
          setLoading(false);
        }

        if (!navigator.onLine) {
          setLoading(false);
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        const { data: profile } = await supabase
          .from('profiles').select('organization_id').eq('id', user.id).single();
        if (!profile?.organization_id) { setLoading(false); return; }
        const [orgRes, legalRes] = await Promise.all([
          supabase.from('organizations').select('name').eq('id', profile.organization_id).single(),
          supabase.from('organization_legal_info')
            .select('commercial_registration, industrial_registration, tax_identification, trademark_name, stamp_url')
            .eq('organization_id', profile.organization_id).maybeSingle()
        ]);
        if (orgRes.data) setOrgName(orgRes.data.name);
        if (legalRes.data) setLegalInfo(legalRes.data);
        
        try {
          await cacheOrgInfo(orgRes.data?.name || '', legalRes.data || null);
        } catch { /* ignore */ }
      } catch (err) {
        logger.error('fetchLegalInfo error', 'InvoicePrint');
      } finally {
        setLoading(false);
      }
    };
    fetchLegalInfo();
  }, []);

  const getInvoiceTitle = () => {
    switch (invoiceType) {
      case 'sale': return t('invoice.saleInvoice');
      case 'return': return t('invoice.returnNotice');
      case 'collection': return t('invoice.receiptVoucher');
      default: return t('invoice.document');
    }
  };

  const getLabels = (): InvoiceLabels => ({
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
    unit: t('invoice.unitLabel'),
    consumerPrice: t('invoice.consumerPrice'),
    total: t('invoice.totalLabel'),
    subtotalBeforeDiscount: t('invoice.subtotalBeforeDiscount'),
    discount: t('invoice.discountLabel'),
    netTotal: t('invoice.netTotalLabel'),
    collectedAmount: t('invoice.collectedAmount'),
    paid: t('invoice.paidLabel'),
    remaining: t('invoice.remainingLabel'),
    notes: t('invoice.notesLabel'),
    thankYou: t('invoice.thankYou'),
    orgDefault: t('invoice.orgNameDefault'),
    trademark: '',
    commercialReg: '',
    industrialReg: '',
    taxId: '',
    paymentStatus: t('invoice.paymentStatus'),
  });

  const ensurePdf = async (): Promise<string> => {
    if (pdfBase64) return pdfBase64;

    const html = buildInvoiceHtml({
      labels: getLabels(), locale, isRtl, orgName, legalInfo, invoiceId,
      date, customerName, invoiceType, paymentType,
      items, grandTotal, subtotal, discountType, discountPercentage, discountValue,
      paidAmount, remaining, notes
    });

    const { generateInvoicePdf } = await import('@/lib/invoicePdfService');
    const { pdfBase64: b64 } = await generateInvoicePdf(html, getInvoiceTitle());
    setPdfBase64(b64);
    return b64;
  };

  const handleGeneratePdf = async () => {
    if (generating || pdfBase64) return;
    setGenerating(true);
    try {
      await ensurePdf();
    } catch (err) {
      console.error('[InvoicePrint] PDF generation failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (!loading) handleGeneratePdf();
  }, [loading]); // eslint-disable-line

  const handleShare = async () => {
    setActionLoading('share');
    try {
      const b64 = await ensurePdf();
      const { shareInvoicePdf, buildInvoiceFileName } = await import('@/lib/invoicePdfService');
      await shareInvoicePdf(b64, buildInvoiceFileName(invoiceId), getInvoiceTitle());
    } catch (err) {
      console.error('[InvoicePrint] Share failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSave = async () => {
    setActionLoading('save');
    try {
      const b64 = await ensurePdf();
      const { saveInvoicePdf, buildInvoiceFileName } = await import('@/lib/invoicePdfService');
      await saveInvoicePdf(b64, buildInvoiceFileName(invoiceId));
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } catch (err) {
      console.error('[InvoicePrint] Save failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const hasDiscount = discountValue && discountValue > 0;

  if (loading) {
    return (
      <FullScreenModal isOpen={true} onClose={onClose} title={t('invoice.loadingInvoice')}
      icon={<Receipt size={24} />} headerColor="primary">
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
          <p className="font-bold text-muted-foreground">{t('invoice.loadingInvoiceData')}</p>
        </div>
      </FullScreenModal>);
  }

  return (
    <FullScreenModal isOpen={true} onClose={onClose}
    title={t('invoice.exportInvoice')} icon={<Receipt size={24} />} headerColor="primary"
    footer={
    <div className="space-y-3">
          {generating &&
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('invoice.generatingPdf')}
            </div>
      }
          <button
        onClick={handleShare}
        disabled={generating || actionLoading !== null}
        className="w-full bg-primary text-primary-foreground font-black py-5 rounded-2xl flex items-center justify-center gap-3 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50">
            {actionLoading === 'share' ?
        <><Loader2 className="w-6 h-6 animate-spin" /> {t('invoice.sharing')}</> :
        <><Share2 className="w-6 h-6" /> {t('invoice.shareInvoice')}</>
        }
          </button>
          <button
        onClick={handleSave}
        disabled={generating || actionLoading !== null}
        className="w-full bg-muted text-foreground font-black py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-muted/80 transition-all active:scale-[0.98] disabled:opacity-50">
            {actionLoading === 'save' ?
        <><Loader2 className="w-6 h-6 animate-spin" /> {t('invoice.savingFile')}</> :
        savedOk ?
        <><CheckCircle2 className="w-6 h-6 text-green-500" /> {t('invoice.savedSuccess')}</> :
        <><Download className="w-6 h-6" /> {t('invoice.saveToDevice')}</>
        }
          </button>
        </div>
    }>

      {pdfBase64 && !generating &&
      <div className="flex items-center justify-center gap-2 text-sm text-green-600 mb-3">
          <CheckCircle2 className="w-4 h-4" />
          <span className="font-bold">{t('invoice.readyToShare')}</span>
        </div>
      }

      <p className="text-sm text-muted-foreground text-center mb-4">{t('invoice.previewInvoice')}</p>
      <div className="bg-card border rounded-2xl p-5 text-sm" dir={isRtl ? 'rtl' : 'ltr'} style={{ fontFamily: 'Segoe UI, Tahoma, sans-serif' }}>
        {/* Header */}
        <div className="text-center border-b border-dashed pb-4 mb-4">
          <div className="text-lg font-bold mb-2">{orgName || t('invoice.orgNameDefault')}</div>
          {legalInfo &&
          <div className="text-xs text-muted-foreground space-y-1">
              {legalInfo.trademark_name && <div>{legalInfo.trademark_name}</div>}
              {legalInfo.commercial_registration && <div>{legalInfo.commercial_registration}</div>}
              {legalInfo.industrial_registration && <div>{legalInfo.industrial_registration}</div>}
              {legalInfo.tax_identification && <div>{legalInfo.tax_identification}</div>}
            </div>
          }
        </div>

        <div className="text-center font-bold text-base mb-4">{getInvoiceTitle()}</div>

        <div className="text-sm space-y-2 mb-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('invoice.invoiceNumber')}:</span>
            <span dir="ltr" className="font-bold">{invoiceId.slice(0, 8)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('invoice.dateLabel')}:</span>
            <span className="font-bold">{date.toLocaleDateString(locale)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('invoice.customerLabel')}:</span>
            <span className="font-bold">{customerName}</span>
          </div>
          {paymentType && invoiceType === 'sale' &&
          <div className="flex justify-between font-bold">
              <span className="text-muted-foreground">{t('invoice.paymentStatus')}:</span>
              <span className={paymentType === 'CASH' ? 'text-green-600' : 'text-orange-500'}>
                {paymentType === 'CASH' ? t('invoice.cashPaid') : t('invoice.creditDeferred')}
              </span>
            </div>
          }
        </div>

        {items.length > 0 &&
        <div className="border-t border-b border-dashed py-4 my-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground font-bold border-b border-dashed">
                  <th className={`text-${isRtl ? 'start' : 'start'} pb-2`}>{t('invoice.itemLabel')}</th>
                  <th className="text-center pb-2">{t('invoice.quantity')}</th>
                  <th className="text-center pb-2">{t('invoice.price')}</th>
                  {items.some((i) => i.unit) && <th className="text-center pb-2">{t('invoice.unitLabel')}</th>}
                  {items.some((i) => i.consumer_price) && <th className="text-center pb-2">{t('invoice.consumerPrice')}</th>}
                  <th className="text-start pb-2">{t('invoice.totalLabel')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) =>
              <tr key={idx} className="border-b border-dashed/30">
                    <td className="py-1.5">{item.product_name}</td>
                    <td className="text-center font-bold py-1.5">{item.quantity}</td>
                    <td className="text-center py-1.5">{item.unit_price.toLocaleString(locale)}</td>
                    {items.some((i) => i.unit) && <td className="text-center py-1.5">{item.unit || '-'}</td>}
                    {items.some((i) => i.consumer_price) && <td className="text-center py-1.5">{item.consumer_price ? item.consumer_price.toLocaleString(locale) : '-'}</td>}
                    <td className="font-bold py-1.5">{item.total_price.toLocaleString(locale)}</td>
                  </tr>
              )}
              </tbody>
            </table>
          </div>
        }

        <div className="text-sm space-y-2">
          {/* Discount display */}
          {hasDiscount && (
            <>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{t('invoice.subtotalBeforeDiscount')}</span>
                <span className="font-bold">{(subtotal || grandTotal + (discountValue || 0)).toLocaleString(locale)} {CURRENCY}</span>
              </div>
              <div className="flex justify-between text-xs text-purple-600 dark:text-purple-400">
                <span>{t('invoice.discountLabel')} {discountType === 'percentage' ? `(${(discountPercentage || 0).toFixed(1)}%)` : ''}</span>
                <span className="font-bold">-{(discountValue || 0).toLocaleString(locale)} {CURRENCY}</span>
              </div>
            </>
          )}
          <div className={`text-center font-black text-lg py-3 rounded-xl ${hasDiscount ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300' : 'bg-muted'}`}>
            {invoiceType === 'collection' ? t('invoice.collectedAmount') : t('invoice.netTotalLabel')}: {grandTotal.toLocaleString(locale)} {CURRENCY}
          </div>
          {paidAmount !== undefined && invoiceType === 'sale' && paymentType === 'CREDIT' &&
          <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-green-500/10 text-green-600 p-3 rounded-xl text-center">
                <p className="text-xs opacity-70">{t('invoice.paidLabel')}</p>
                <p className="font-black">{paidAmount.toLocaleString(locale)} {CURRENCY}</p>
              </div>
              <div className="bg-orange-500/10 text-orange-500 p-3 rounded-xl text-center">
                <p className="text-xs opacity-70">{t('invoice.remainingLabel')}</p>
                <p className="font-black">{(remaining || 0).toLocaleString(locale)} {CURRENCY}</p>
              </div>
            </div>
          }
        </div>

        {notes &&
        <div className="mt-4 pt-4 border-t border-dashed text-sm text-muted-foreground">
            {t('invoice.notesLabel')}: {notes}
          </div>
        }

        <div className="text-center text-xs text-muted-foreground mt-6 pt-4 border-t border-dashed">
          <p>{t('invoice.thankYou')}</p>
          <p className="mt-1">Smart System</p>
        </div>
      </div>
    </FullScreenModal>);

};

export default InvoicePrint;
