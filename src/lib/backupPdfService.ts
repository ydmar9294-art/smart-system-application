/**
 * backupPdfService — Generates a professional bilingual backup PDF
 * 
 * Uses html2canvas + jsPDF to properly render Arabic/English text.
 * Accepts a translations object so all labels follow the current app language.
 */
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { CURRENCY } from '@/constants';

// ── Types ────────────────────────────────────────────────────────
interface PdfBackupData {
  orgName: string;
  exportDate: string;
  customers: Array<{
    id: string; name: string; phone: string | null;
    location: string | null; balance: number;
    distributor_name?: string;
  }>;
  invoices: Array<{
    id: string; customer_name: string; grand_total: number;
    paid_amount: number; remaining: number; payment_type: string;
    is_voided: boolean; void_reason: string | null; created_at: string;
    discount_type: string | null; discount_percentage: number | null;
    discount_value: number | null; distributor_name?: string;
    items: Array<{ product_name: string; quantity: number; unit_price: number; total_price: number }>;
  }>;
  collections: Array<{
    id: string; sale_id: string; amount: number; notes: string | null;
    is_reversed: boolean; reverse_reason: string | null;
    created_at: string; customer_name?: string; collector_name?: string;
  }>;
  purchases: Array<{
    id: string; product_name: string; quantity: number; unit_price: number;
    total_price: number; supplier_name: string | null; created_at: string;
    notes: string | null; creator_name?: string;
  }>;
  salesReturns: Array<{
    id: string; customer_name: string; sale_id: string | null; reason: string | null;
    total_amount: number; created_at: string; creator_name?: string;
    items: Array<{ product_name: string; quantity: number; unit_price: number; total_price: number }>;
  }>;
  purchaseReturns: Array<{
    id: string; supplier_name: string | null; reason: string | null;
    total_amount: number; created_at: string; creator_name?: string;
    items: Array<{ product_name: string; quantity: number; unit_price: number; total_price: number }>;
  }>;
  logs: Array<{
    type: string; user_name: string; date: string; details: string;
  }>;
}

export interface PdfTranslations {
  pdfFullBackup: string;
  pdfExportDate: string;
  pdfTotalRevenue: string;
  pdfTotalCollections: string;
  pdfTotalRemaining: string;
  pdfTotalDebts: string;
  pdfCashCreditVoided: string;
  pdfCustomerDatabase: string;
  pdfId: string;
  pdfCustomerName: string;
  pdfPhone: string;
  pdfLocation: string;
  pdfDistributor: string;
  pdfBalance: string;
  pdfCustomersPage: string;
  pdfInvoiceLog: string;
  pdfNumber: string;
  pdfCustomer: string;
  pdfDate: string;
  pdfType: string;
  pdfTotal: string;
  pdfDiscount: string;
  pdfNet: string;
  pdfPaid: string;
  pdfRemaining: string;
  pdfInvoicesPage: string;
  pdfInvoiceItemsDetail: string;
  pdfInvoice: string;
  pdfProduct: string;
  pdfQuantity: string;
  pdfUnitPrice: string;
  pdfItemTotal: string;
  pdfItemsPage: string;
  pdfCollectionLog: string;
  pdfInvoiceNumber: string;
  pdfAmount: string;
  pdfCollector: string;
  pdfStatus: string;
  pdfNotes: string;
  pdfCollectionsPage: string;
  pdfActivityLog: string;
  pdfOperation: string;
  pdfUser: string;
  pdfDetails: string;
  pdfLogsPage: string;
  pdfAdditionalRecords: string;
  pdfCash: string;
  pdfCredit: string;
  pdfVoided: string;
  pdfActive: string;
  pdfReversed: string;
  pdfPreparingDoc: string;
  pdfSavingFile: string;
  customers: string;
  invoices: string;
  collections: string;
  activityLog: string;
  // New sections
  purchases: string;
  pdfPurchasesLog: string;
  pdfSupplier: string;
  pdfPurchasesPage: string;
  pdfTotalPurchases: string;
  salesReturns: string;
  pdfSalesReturnsLog: string;
  pdfReason: string;
  pdfSalesReturnsPage: string;
  pdfTotalSalesReturns: string;
  pdfOriginalInvoice: string;
  purchaseReturns: string;
  pdfPurchaseReturnsLog: string;
  pdfPurchaseReturnsPage: string;
  pdfTotalPurchaseReturns: string;
}

// ── Shared styles ────────────────────────────────────────────────
function getBaseStyles(isRtl: boolean): string {
  const dir = isRtl ? 'rtl' : 'ltr';
  const textAlign = isRtl ? 'right' : 'left';
  return `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body, html { 
    font-family: ${isRtl ? "'Tajawal', " : ""}'Segoe UI', Tahoma, Arial, sans-serif;
    direction: ${dir}; text-align: ${textAlign}; color: #1e293b;
    background: #fff; font-size: 11px; line-height: 1.5;
  }
  .page { 
    width: 1100px; padding: 24px 32px; background: #fff;
    page-break-after: always; min-height: 750px;
  }
  .header-bar {
    background: #1e293b; color: #fff; padding: 10px 20px;
    display: flex; justify-content: space-between; align-items: center;
    border-radius: 8px; margin-bottom: 16px; font-size: 11px;
  }
  .section-title {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: #fff; padding: 8px 16px; border-radius: 8px;
    font-size: 13px; font-weight: 800; margin-bottom: 10px;
  }
  .section-title-orange {
    background: linear-gradient(135deg, #f97316, #ea580c);
    color: #fff; padding: 8px 16px; border-radius: 8px;
    font-size: 13px; font-weight: 800; margin-bottom: 10px;
  }
  .section-title-red {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: #fff; padding: 8px 16px; border-radius: 8px;
    font-size: 13px; font-weight: 800; margin-bottom: 10px;
  }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th {
    background: #f1f5f9; padding: 6px 8px; font-size: 10px;
    font-weight: 800; border-bottom: 2px solid #e2e8f0; text-align: center;
  }
  td {
    padding: 5px 8px; font-size: 10px; text-align: center;
    border-bottom: 1px solid #f1f5f9;
  }
  tr:nth-child(even) { background: #fafbfc; }
  .text-danger { color: #dc2626; }
  .text-success { color: #16a34a; }
  .text-muted { color: #94a3b8; font-size: 9px; }
  .badge {
    display: inline-block; padding: 2px 8px; border-radius: 10px;
    font-size: 9px; font-weight: 700;
  }
  .badge-cash { background: #dcfce7; color: #16a34a; }
  .badge-credit { background: #fef3c7; color: #d97706; }
  .badge-void { background: #fee2e2; color: #dc2626; }
  .badge-active { background: #dcfce7; color: #16a34a; }
  .badge-reversed { background: #fee2e2; color: #dc2626; }
  .cover-center {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; min-height: 600px; text-align: center;
  }
  .stat-grid {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 12px; margin-top: 24px; max-width: 800px;
  }
  .stat-card {
    background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;
    padding: 16px; text-align: center;
  }
  .stat-value { font-size: 22px; font-weight: 900; color: #1e293b; }
  .stat-label { font-size: 10px; color: #94a3b8; margin-top: 4px; }
  .inv-group-title {
    font-size: 11px; font-weight: 800; color: #3b82f6;
    padding: 4px 0; border-bottom: 1px dashed #e2e8f0; margin-bottom: 4px;
  }
  .footer {
    text-align: center; font-size: 8px; color: #cbd5e1;
    padding-top: 8px; border-top: 1px solid #f1f5f9; margin-top: 16px;
  }
`;
}

function fmtDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return iso; }
}

function fmtNum(n: number, locale: string): string {
  return n.toLocaleString(locale);
}

// ── Build HTML pages ─────────────────────────────────────────────
function buildBackupHtml(data: PdfBackupData, t: PdfTranslations, lang: string): string {
  const isRtl = lang === 'ar';
  const locale = isRtl ? 'ar-SA' : 'en-US';
  const totalDebt = data.customers.reduce((s, c) => s + c.balance, 0);
  const totalRevenue = data.invoices.reduce((s, i) => s + i.grand_total, 0);
  const totalCollected = data.collections.filter(c => !c.is_reversed).reduce((s, c) => s + c.amount, 0);
  const totalRemaining = data.invoices.reduce((s, i) => s + i.remaining, 0);
  const totalPurchases = data.purchases.reduce((s, p) => s + p.total_price, 0);
  const totalSalesReturns = data.salesReturns.reduce((s, sr) => s + sr.total_amount, 0);
  const totalPurchaseReturns = data.purchaseReturns.reduce((s, pr) => s + pr.total_amount, 0);
  const voidedCount = data.invoices.filter(i => i.is_voided).length;
  const cashCount = data.invoices.filter(i => i.payment_type === 'CASH' && !i.is_voided).length;
  const creditCount = data.invoices.filter(i => i.payment_type === 'CREDIT' && !i.is_voided).length;
  const alignEnd = isRtl ? 'right' : 'left';
  const alignStart = isRtl ? 'left' : 'right';

  // ── Cover page ──────────────────────────────────────────────
  const coverPage = `
    <div class="page">
      <div class="cover-center">
        <div style="font-size: 32px; font-weight: 900; color: #1e293b; margin-bottom: 8px;">${data.orgName}</div>
        <div style="font-size: 16px; color: #64748b; margin-bottom: 4px;">${t.pdfFullBackup}</div>
        <div style="font-size: 12px; color: #94a3b8; margin-bottom: 24px;">${t.pdfExportDate}: ${data.exportDate}</div>
        <div class="stat-grid">
          <div class="stat-card"><div class="stat-value">${data.customers.length}</div><div class="stat-label">${t.customers}</div></div>
          <div class="stat-card"><div class="stat-value">${data.invoices.length}</div><div class="stat-label">${t.invoices}</div></div>
          <div class="stat-card"><div class="stat-value">${data.collections.length}</div><div class="stat-label">${t.collections}</div></div>
          <div class="stat-card"><div class="stat-value">${data.purchases.length}</div><div class="stat-label">${t.purchases}</div></div>
          <div class="stat-card"><div class="stat-value">${data.salesReturns.length}</div><div class="stat-label">${t.salesReturns}</div></div>
          <div class="stat-card"><div class="stat-value">${data.purchaseReturns.length}</div><div class="stat-label">${t.purchaseReturns}</div></div>
          <div class="stat-card"><div class="stat-value">${data.logs.length}</div><div class="stat-label">${t.activityLog}</div></div>
        </div>
        <div style="margin-top: 24px; max-width: 500px;">
          <table>
            <tr><td style="text-align: ${alignEnd}; font-weight: 700;">${t.pdfTotalRevenue}</td><td style="text-align: ${alignStart}; font-weight: 800;">${fmtNum(totalRevenue, locale)} ${CURRENCY}</td></tr>
            <tr><td style="text-align: ${alignEnd}; font-weight: 700;">${t.pdfTotalCollections}</td><td style="text-align: ${alignStart}; font-weight: 800; color: #16a34a;">${fmtNum(totalCollected, locale)} ${CURRENCY}</td></tr>
            <tr><td style="text-align: ${alignEnd}; font-weight: 700;">${t.pdfTotalRemaining}</td><td style="text-align: ${alignStart}; font-weight: 800; color: #dc2626;">${fmtNum(totalRemaining, locale)} ${CURRENCY}</td></tr>
            <tr><td style="text-align: ${alignEnd}; font-weight: 700;">${t.pdfTotalDebts}</td><td style="text-align: ${alignStart}; font-weight: 800; color: #d97706;">${fmtNum(totalDebt, locale)} ${CURRENCY}</td></tr>
            <tr><td style="text-align: ${alignEnd}; font-weight: 700;">${t.pdfTotalPurchases}</td><td style="text-align: ${alignStart}; font-weight: 800;">${fmtNum(totalPurchases, locale)} ${CURRENCY}</td></tr>
            <tr><td style="text-align: ${alignEnd}; font-weight: 700;">${t.pdfTotalSalesReturns}</td><td style="text-align: ${alignStart}; font-weight: 800; color: #ea580c;">${fmtNum(totalSalesReturns, locale)} ${CURRENCY}</td></tr>
            <tr><td style="text-align: ${alignEnd}; font-weight: 700;">${t.pdfTotalPurchaseReturns}</td><td style="text-align: ${alignStart}; font-weight: 800; color: #ea580c;">${fmtNum(totalPurchaseReturns, locale)} ${CURRENCY}</td></tr>
            <tr><td style="text-align: ${alignEnd}; font-weight: 700;">${t.pdfCashCreditVoided}</td><td style="text-align: ${alignStart};">${cashCount} / ${creditCount} / ${voidedCount}</td></tr>
          </table>
        </div>
      </div>
    </div>`;

  // ── Customers page ──────────────────────────────────────────
  const custRows = data.customers.map(c => `
    <tr>
      <td>${c.id.slice(0, 8)}</td>
      <td style="font-weight: 700;">${c.name}</td>
      <td>${c.phone || '—'}</td>
      <td>${c.location || '—'}</td>
      <td>${c.distributor_name || '—'}</td>
      <td style="font-weight: 800; color: ${c.balance > 0 ? '#dc2626' : '#16a34a'};">${fmtNum(c.balance, locale)} ${CURRENCY}</td>
    </tr>`).join('');

  const customersPage = `
    <div class="page">
      <div class="header-bar"><span>${data.exportDate}</span><span>${data.orgName}</span></div>
      <div class="section-title">📋 ${t.pdfCustomerDatabase} (${data.customers.length})</div>
      <table>
        <thead><tr>
          <th>${t.pdfId}</th><th>${t.pdfCustomerName}</th><th>${t.pdfPhone}</th>
          <th>${t.pdfLocation}</th><th>${t.pdfDistributor}</th><th>${t.pdfBalance}</th>
        </tr></thead>
        <tbody>${custRows}</tbody>
      </table>
      <div class="footer">${t.pdfCustomersPage} — ${data.orgName}</div>
    </div>`;

  // ── Invoices page ───────────────────────────────────────────
  const invRows = data.invoices.map(inv => {
    const subtotal = inv.grand_total + (inv.discount_value || 0);
    const typeClass = inv.is_voided ? 'badge-void' : inv.payment_type === 'CASH' ? 'badge-cash' : 'badge-credit';
    const typeLabel = inv.is_voided ? t.pdfVoided : inv.payment_type === 'CASH' ? t.pdfCash : t.pdfCredit;
    return `
    <tr ${inv.is_voided ? 'style="opacity: 0.5;"' : ''}>
      <td>${inv.id.slice(0, 8)}</td>
      <td style="font-weight: 700;">${inv.customer_name}</td>
      <td>${fmtDate(inv.created_at, locale)}</td>
      <td><span class="badge ${typeClass}">${typeLabel}</span></td>
      <td>${fmtNum(subtotal, locale)}</td>
      <td>${(inv.discount_value ?? 0) > 0 ? fmtNum(inv.discount_value!, locale) : '—'}</td>
      <td style="font-weight: 800;">${fmtNum(inv.grand_total, locale)}</td>
      <td class="text-success">${fmtNum(inv.paid_amount, locale)}</td>
      <td class="${inv.remaining > 0 ? 'text-danger' : ''}" style="font-weight: 700;">${fmtNum(inv.remaining, locale)}</td>
      <td>${inv.distributor_name || '—'}</td>
    </tr>`;
  }).join('');

  const invoicesPage = `
    <div class="page">
      <div class="header-bar"><span>${data.exportDate}</span><span>${data.orgName}</span></div>
      <div class="section-title">🧾 ${t.pdfInvoiceLog} (${data.invoices.length})</div>
      <table>
        <thead><tr>
          <th>${t.pdfNumber}</th><th>${t.pdfCustomer}</th><th>${t.pdfDate}</th><th>${t.pdfType}</th>
          <th>${t.pdfTotal}</th><th>${t.pdfDiscount}</th><th>${t.pdfNet}</th>
          <th>${t.pdfPaid}</th><th>${t.pdfRemaining}</th><th>${t.pdfDistributor}</th>
        </tr></thead>
        <tbody>${invRows}</tbody>
      </table>
      <div class="footer">${t.pdfInvoicesPage} — ${data.orgName}</div>
    </div>`;

  // ── Invoice Items Detail pages ──────────────────────────────
  const invoicesWithItems = data.invoices.filter(i => i.items.length > 0).slice(0, 100);
  let itemsHtml = '';
  if (invoicesWithItems.length > 0) {
    const groupsHtml = invoicesWithItems.map(inv => {
      const rows = inv.items.map(it => `
        <tr>
          <td style="text-align: ${alignEnd}; font-weight: 600;">${it.product_name}</td>
          <td>${it.quantity}</td>
          <td>${fmtNum(it.unit_price, locale)} ${CURRENCY}</td>
          <td style="font-weight: 700;">${fmtNum(it.total_price, locale)} ${CURRENCY}</td>
        </tr>`).join('');
      return `
        <div class="inv-group-title">${t.pdfInvoice}: ${inv.id.slice(0, 8)} | ${inv.customer_name} | ${fmtDate(inv.created_at, locale)} | ${inv.payment_type === 'CASH' ? t.pdfCash : t.pdfCredit}</div>
        <table>
          <thead><tr><th style="text-align: ${alignEnd};">${t.pdfProduct}</th><th>${t.pdfQuantity}</th><th>${t.pdfUnitPrice}</th><th>${t.pdfItemTotal}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    }).join('');

    itemsHtml = `
      <div class="page">
        <div class="header-bar"><span>${data.exportDate}</span><span>${data.orgName}</span></div>
        <div class="section-title">📦 ${t.pdfInvoiceItemsDetail}</div>
        ${groupsHtml}
        <div class="footer">${t.pdfItemsPage} — ${data.orgName}</div>
      </div>`;
  }

  // ── Collections page ────────────────────────────────────────
  const colRows = data.collections.map(c => {
    const statusClass = c.is_reversed ? 'badge-reversed' : 'badge-active';
    const statusLabel = c.is_reversed ? t.pdfReversed : t.pdfActive;
    return `
    <tr ${c.is_reversed ? 'style="opacity: 0.5;"' : ''}>
      <td>${c.sale_id.slice(0, 8)}</td>
      <td style="font-weight: 700;">${c.customer_name || '—'}</td>
      <td>${fmtDate(c.created_at, locale)}</td>
      <td style="font-weight: 800; color: #16a34a;">${fmtNum(c.amount, locale)} ${CURRENCY}</td>
      <td>${c.collector_name || '—'}</td>
      <td><span class="badge ${statusClass}">${statusLabel}</span></td>
      <td class="text-muted">${c.notes || '—'}</td>
    </tr>`;
  }).join('');

  const collectionsPage = `
    <div class="page">
      <div class="header-bar"><span>${data.exportDate}</span><span>${data.orgName}</span></div>
      <div class="section-title">💰 ${t.pdfCollectionLog} (${data.collections.length})</div>
      <table>
        <thead><tr>
          <th>${t.pdfInvoiceNumber}</th><th>${t.pdfCustomer}</th><th>${t.pdfDate}</th>
          <th>${t.pdfAmount}</th><th>${t.pdfCollector}</th><th>${t.pdfStatus}</th><th>${t.pdfNotes}</th>
        </tr></thead>
        <tbody>${colRows}</tbody>
      </table>
      <div class="footer">${t.pdfCollectionsPage} — ${data.orgName}</div>
    </div>`;

  // ── Purchases page ──────────────────────────────────────────
  let purchasesPage = '';
  if (data.purchases.length > 0) {
    const purchRows = data.purchases.map(p => `
      <tr>
        <td>${p.id.slice(0, 8)}</td>
        <td style="font-weight: 700;">${p.product_name}</td>
        <td>${p.quantity}</td>
        <td>${fmtNum(p.unit_price, locale)} ${CURRENCY}</td>
        <td style="font-weight: 800;">${fmtNum(p.total_price, locale)} ${CURRENCY}</td>
        <td>${p.supplier_name || '—'}</td>
        <td>${fmtDate(p.created_at, locale)}</td>
        <td class="text-muted">${p.notes || '—'}</td>
      </tr>`).join('');

    purchasesPage = `
      <div class="page">
        <div class="header-bar"><span>${data.exportDate}</span><span>${data.orgName}</span></div>
        <div class="section-title">🛒 ${t.pdfPurchasesLog} (${data.purchases.length})</div>
        <table>
          <thead><tr>
            <th>${t.pdfNumber}</th><th>${t.pdfProduct}</th><th>${t.pdfQuantity}</th>
            <th>${t.pdfUnitPrice}</th><th>${t.pdfTotal}</th><th>${t.pdfSupplier}</th>
            <th>${t.pdfDate}</th><th>${t.pdfNotes}</th>
          </tr></thead>
          <tbody>${purchRows}</tbody>
        </table>
        <div class="footer">${t.pdfPurchasesPage} — ${data.orgName}</div>
      </div>`;
  }

  // ── Sales Returns page ──────────────────────────────────────
  let salesReturnsPage = '';
  if (data.salesReturns.length > 0) {
    const srRows = data.salesReturns.map(sr => `
      <tr>
        <td>${sr.id.slice(0, 8)}</td>
        <td style="font-weight: 700;">${sr.customer_name}</td>
        <td>${sr.sale_id ? sr.sale_id.slice(0, 8) : '—'}</td>
        <td style="font-weight: 800; color: #ea580c;">${fmtNum(sr.total_amount, locale)} ${CURRENCY}</td>
        <td class="text-muted">${sr.reason || '—'}</td>
        <td>${fmtDate(sr.created_at, locale)}</td>
        <td>${sr.creator_name || '—'}</td>
      </tr>`).join('');

    // Items detail
    const srWithItems = data.salesReturns.filter(sr => sr.items.length > 0).slice(0, 50);
    const srItemsHtml = srWithItems.map(sr => {
      const rows = sr.items.map(it => `
        <tr>
          <td style="text-align: ${alignEnd}; font-weight: 600;">${it.product_name}</td>
          <td>${it.quantity}</td>
          <td>${fmtNum(it.unit_price, locale)} ${CURRENCY}</td>
          <td style="font-weight: 700;">${fmtNum(it.total_price, locale)} ${CURRENCY}</td>
        </tr>`).join('');
      return `
        <div class="inv-group-title" style="color: #ea580c;">${sr.customer_name} | ${sr.id.slice(0, 8)} | ${fmtDate(sr.created_at, locale)}</div>
        <table>
          <thead><tr><th style="text-align: ${alignEnd};">${t.pdfProduct}</th><th>${t.pdfQuantity}</th><th>${t.pdfUnitPrice}</th><th>${t.pdfItemTotal}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    }).join('');

    salesReturnsPage = `
      <div class="page">
        <div class="header-bar"><span>${data.exportDate}</span><span>${data.orgName}</span></div>
        <div class="section-title-orange">↩️ ${t.pdfSalesReturnsLog} (${data.salesReturns.length})</div>
        <table>
          <thead><tr>
            <th>${t.pdfNumber}</th><th>${t.pdfCustomer}</th><th>${t.pdfOriginalInvoice}</th>
            <th>${t.pdfTotal}</th><th>${t.pdfReason}</th><th>${t.pdfDate}</th><th>${t.pdfUser}</th>
          </tr></thead>
          <tbody>${srRows}</tbody>
        </table>
        ${srItemsHtml}
        <div class="footer">${t.pdfSalesReturnsPage} — ${data.orgName}</div>
      </div>`;
  }

  // ── Purchase Returns page ───────────────────────────────────
  let purchaseReturnsPage = '';
  if (data.purchaseReturns.length > 0) {
    const prRows = data.purchaseReturns.map(pr => `
      <tr>
        <td>${pr.id.slice(0, 8)}</td>
        <td style="font-weight: 700;">${pr.supplier_name || '—'}</td>
        <td style="font-weight: 800; color: #dc2626;">${fmtNum(pr.total_amount, locale)} ${CURRENCY}</td>
        <td class="text-muted">${pr.reason || '—'}</td>
        <td>${fmtDate(pr.created_at, locale)}</td>
        <td>${pr.creator_name || '—'}</td>
      </tr>`).join('');

    const prWithItems = data.purchaseReturns.filter(pr => pr.items.length > 0).slice(0, 50);
    const prItemsHtml = prWithItems.map(pr => {
      const rows = pr.items.map(it => `
        <tr>
          <td style="text-align: ${alignEnd}; font-weight: 600;">${it.product_name}</td>
          <td>${it.quantity}</td>
          <td>${fmtNum(it.unit_price, locale)} ${CURRENCY}</td>
          <td style="font-weight: 700;">${fmtNum(it.total_price, locale)} ${CURRENCY}</td>
        </tr>`).join('');
      return `
        <div class="inv-group-title" style="color: #dc2626;">${pr.supplier_name || '—'} | ${pr.id.slice(0, 8)} | ${fmtDate(pr.created_at, locale)}</div>
        <table>
          <thead><tr><th style="text-align: ${alignEnd};">${t.pdfProduct}</th><th>${t.pdfQuantity}</th><th>${t.pdfUnitPrice}</th><th>${t.pdfItemTotal}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    }).join('');

    purchaseReturnsPage = `
      <div class="page">
        <div class="header-bar"><span>${data.exportDate}</span><span>${data.orgName}</span></div>
        <div class="section-title-red">📦↩️ ${t.pdfPurchaseReturnsLog} (${data.purchaseReturns.length})</div>
        <table>
          <thead><tr>
            <th>${t.pdfNumber}</th><th>${t.pdfSupplier}</th><th>${t.pdfTotal}</th>
            <th>${t.pdfReason}</th><th>${t.pdfDate}</th><th>${t.pdfUser}</th>
          </tr></thead>
          <tbody>${prRows}</tbody>
        </table>
        ${prItemsHtml}
        <div class="footer">${t.pdfPurchaseReturnsPage} — ${data.orgName}</div>
      </div>`;
  }

  // ── Logs page ───────────────────────────────────────────────
  const logRows = data.logs.slice(0, 300).map(l => `
    <tr>
      <td><span class="badge" style="background: #eff6ff; color: #3b82f6;">${l.type}</span></td>
      <td style="font-weight: 600;">${l.user_name}</td>
      <td>${l.date}</td>
      <td style="text-align: ${alignEnd}; font-size: 9px;">${l.details.length > 80 ? l.details.slice(0, 78) + '...' : l.details}</td>
    </tr>`).join('');

  const logsPage = `
    <div class="page">
      <div class="header-bar"><span>${data.exportDate}</span><span>${data.orgName}</span></div>
      <div class="section-title">📊 ${t.pdfActivityLog} (${Math.min(data.logs.length, 300)})</div>
      <table>
        <thead><tr><th>${t.pdfOperation}</th><th>${t.pdfUser}</th><th>${t.pdfDate}</th><th style="text-align: ${alignEnd};">${t.pdfDetails}</th></tr></thead>
        <tbody>${logRows}</tbody>
      </table>
      ${data.logs.length > 300 ? '<p style="text-align: center; color: #94a3b8; font-size: 9px;">... ' + (data.logs.length - 300) + ' ' + t.pdfAdditionalRecords + '</p>' : ''}
      <div class="footer">${t.pdfLogsPage} — ${data.orgName}</div>
    </div>`;

  const dir = isRtl ? 'rtl' : 'ltr';
  const htmlLang = isRtl ? 'ar' : 'en';
  const fontLink = isRtl 
    ? '<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">'
    : '';

  return `<!DOCTYPE html><html dir="${dir}" lang="${htmlLang}">
    <head>
      <meta charset="UTF-8">
      ${fontLink}
      <style>${getBaseStyles(isRtl)}</style>
    </head>
    <body>${coverPage}${customersPage}${invoicesPage}${itemsHtml}${collectionsPage}${purchasesPage}${salesReturnsPage}${purchaseReturnsPage}${logsPage}</body>
    </html>`;
}

// ── Main export function ─────────────────────────────────────────
export async function generateBackupPdf(
  data: PdfBackupData,
  translations: PdfTranslations,
  lang: string,
  onProgress?: (msg: string) => void
): Promise<void> {
  const html = buildBackupHtml(data, translations, lang);

  onProgress?.(translations.pdfPreparingDoc);

  // Create hidden container
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    top: '-99999px',
    left: '-99999px',
    width: '1100px',
    background: '#ffffff',
    zIndex: '-1',
  });
  document.body.appendChild(container);

  // Create iframe for isolated rendering
  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, {
    width: '1100px',
    height: '1px',
    border: 'none',
    overflow: 'hidden',
  });
  container.appendChild(iframe);

  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve();
    iframe.srcdoc = html;
  });

  // Wait for fonts to load
  await new Promise(r => setTimeout(r, 800));

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(container);
    throw new Error('Failed to create PDF document');
  }

  // Wait for font
  try {
    await (iframeDoc as any).fonts?.ready;
  } catch { /* fallback */ }

  const pages = iframeDoc.querySelectorAll('.page');
  if (pages.length === 0) {
    document.body.removeChild(container);
    throw new Error('No pages found');
  }

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < pages.length; i++) {
    onProgress?.(`${translations.pdfPreparingDoc} (${i + 1}/${pages.length})`);

    const pageEl = pages[i] as HTMLElement;
    pageEl.style.pageBreakAfter = 'auto';

    const canvas = await html2canvas(pageEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      allowTaint: true,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const imgW = pageW;
    const imgH = (canvas.height / canvas.width) * imgW;

    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, 0, imgW, Math.min(imgH, pageH));
  }

  onProgress?.(translations.pdfSavingFile);

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  pdf.save(`backup_${data.orgName}_${ts}.pdf`);

  document.body.removeChild(container);
}
