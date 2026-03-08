/**
 * backupPdfService — Generates a professional Arabic/English backup PDF
 * 
 * Uses html2canvas + jsPDF to properly render Arabic text with RTL support.
 * Flow: Build HTML → render offscreen → capture pages → assemble PDF
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
  logs: Array<{
    type: string; user_name: string; date: string; details: string;
  }>;
}

// ── Shared styles ────────────────────────────────────────────────
const baseStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body, html { 
    font-family: 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif;
    direction: rtl; text-align: right; color: #1e293b;
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
  .text-warning { color: #d97706; }
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
    gap: 12px; margin-top: 24px; max-width: 600px;
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

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ar-SA', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return iso; }
}

function fmtNum(n: number): string {
  return n.toLocaleString('ar-SA');
}

// ── Build HTML pages ─────────────────────────────────────────────
function buildBackupHtml(data: PdfBackupData): string {
  const totalDebt = data.customers.reduce((s, c) => s + c.balance, 0);
  const totalRevenue = data.invoices.reduce((s, i) => s + i.grand_total, 0);
  const totalCollected = data.collections.filter(c => !c.is_reversed).reduce((s, c) => s + c.amount, 0);
  const totalRemaining = data.invoices.reduce((s, i) => s + i.remaining, 0);
  const voidedCount = data.invoices.filter(i => i.is_voided).length;
  const cashCount = data.invoices.filter(i => i.payment_type === 'CASH' && !i.is_voided).length;
  const creditCount = data.invoices.filter(i => i.payment_type === 'CREDIT' && !i.is_voided).length;

  // ── Cover page ──────────────────────────────────────────────
  const coverPage = `
    <div class="page">
      <div class="cover-center">
        <div style="font-size: 32px; font-weight: 900; color: #1e293b; margin-bottom: 8px;">${data.orgName}</div>
        <div style="font-size: 16px; color: #64748b; margin-bottom: 4px;">نسخة احتياطية شاملة لبيانات المنشأة</div>
        <div style="font-size: 12px; color: #94a3b8; margin-bottom: 24px;">تاريخ التصدير: ${data.exportDate}</div>
        <div class="stat-grid">
          <div class="stat-card"><div class="stat-value">${data.customers.length}</div><div class="stat-label">الزبائن</div></div>
          <div class="stat-card"><div class="stat-value">${data.invoices.length}</div><div class="stat-label">الفواتير</div></div>
          <div class="stat-card"><div class="stat-value">${data.collections.length}</div><div class="stat-label">التحصيلات</div></div>
          <div class="stat-card"><div class="stat-value">${data.logs.length}</div><div class="stat-label">سجل العمليات</div></div>
        </div>
        <div style="margin-top: 24px; max-width: 500px;">
          <table>
            <tr><td style="text-align: right; font-weight: 700;">إجمالي الإيرادات</td><td style="text-align: left; font-weight: 800;">${fmtNum(totalRevenue)} ${CURRENCY}</td></tr>
            <tr><td style="text-align: right; font-weight: 700;">إجمالي التحصيلات</td><td style="text-align: left; font-weight: 800; color: #16a34a;">${fmtNum(totalCollected)} ${CURRENCY}</td></tr>
            <tr><td style="text-align: right; font-weight: 700;">إجمالي المتبقي</td><td style="text-align: left; font-weight: 800; color: #dc2626;">${fmtNum(totalRemaining)} ${CURRENCY}</td></tr>
            <tr><td style="text-align: right; font-weight: 700;">إجمالي الديون</td><td style="text-align: left; font-weight: 800; color: #d97706;">${fmtNum(totalDebt)} ${CURRENCY}</td></tr>
            <tr><td style="text-align: right; font-weight: 700;">فواتير نقدية / آجلة / ملغاة</td><td style="text-align: left;">${cashCount} / ${creditCount} / ${voidedCount}</td></tr>
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
      <td style="font-weight: 800; color: ${c.balance > 0 ? '#dc2626' : '#16a34a'};">${fmtNum(c.balance)} ${CURRENCY}</td>
    </tr>`).join('');

  const customersPage = `
    <div class="page">
      <div class="header-bar"><span>${data.exportDate}</span><span>${data.orgName}</span></div>
      <div class="section-title">📋 قاعدة بيانات الزبائن (${data.customers.length})</div>
      <table>
        <thead><tr>
          <th>المعرّف</th><th>اسم الزبون</th><th>رقم الهاتف</th>
          <th>الموقع</th><th>الموزع</th><th>الرصيد</th>
        </tr></thead>
        <tbody>${custRows}</tbody>
      </table>
      <div class="footer">صفحة الزبائن — ${data.orgName}</div>
    </div>`;

  // ── Invoices page ───────────────────────────────────────────
  const invRows = data.invoices.map(inv => {
    const subtotal = inv.grand_total + (inv.discount_value || 0);
    const typeClass = inv.is_voided ? 'badge-void' : inv.payment_type === 'CASH' ? 'badge-cash' : 'badge-credit';
    const typeLabel = inv.is_voided ? 'ملغاة' : inv.payment_type === 'CASH' ? 'نقدي' : 'آجل';
    return `
    <tr ${inv.is_voided ? 'style="opacity: 0.5;"' : ''}>
      <td>${inv.id.slice(0, 8)}</td>
      <td style="font-weight: 700;">${inv.customer_name}</td>
      <td>${fmtDate(inv.created_at)}</td>
      <td><span class="badge ${typeClass}">${typeLabel}</span></td>
      <td>${fmtNum(subtotal)}</td>
      <td>${inv.discount_value > 0 ? fmtNum(inv.discount_value) : '—'}</td>
      <td style="font-weight: 800;">${fmtNum(inv.grand_total)}</td>
      <td class="text-success">${fmtNum(inv.paid_amount)}</td>
      <td class="${inv.remaining > 0 ? 'text-danger' : ''}" style="font-weight: 700;">${fmtNum(inv.remaining)}</td>
      <td>${inv.distributor_name || '—'}</td>
    </tr>`;
  }).join('');

  const invoicesPage = `
    <div class="page">
      <div class="header-bar"><span>${data.exportDate}</span><span>${data.orgName}</span></div>
      <div class="section-title">🧾 سجل الفواتير (${data.invoices.length})</div>
      <table>
        <thead><tr>
          <th>الرقم</th><th>الزبون</th><th>التاريخ</th><th>النوع</th>
          <th>المجموع</th><th>الخصم</th><th>الصافي</th>
          <th>المدفوع</th><th>المتبقي</th><th>الموزع</th>
        </tr></thead>
        <tbody>${invRows}</tbody>
      </table>
      <div class="footer">صفحة الفواتير — ${data.orgName}</div>
    </div>`;

  // ── Invoice Items Detail pages ──────────────────────────────
  const invoicesWithItems = data.invoices.filter(i => i.items.length > 0).slice(0, 100);
  let itemsHtml = '';
  if (invoicesWithItems.length > 0) {
    const groupsHtml = invoicesWithItems.map(inv => {
      const rows = inv.items.map(it => `
        <tr>
          <td style="text-align: right; font-weight: 600;">${it.product_name}</td>
          <td>${it.quantity}</td>
          <td>${fmtNum(it.unit_price)} ${CURRENCY}</td>
          <td style="font-weight: 700;">${fmtNum(it.total_price)} ${CURRENCY}</td>
        </tr>`).join('');
      return `
        <div class="inv-group-title">فاتورة: ${inv.id.slice(0, 8)} | ${inv.customer_name} | ${fmtDate(inv.created_at)} | ${inv.payment_type === 'CASH' ? 'نقدي' : 'آجل'}</div>
        <table>
          <thead><tr><th style="text-align: right;">المنتج</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    }).join('');

    itemsHtml = `
      <div class="page">
        <div class="header-bar"><span>${data.exportDate}</span><span>${data.orgName}</span></div>
        <div class="section-title">📦 تفاصيل أصناف الفواتير</div>
        ${groupsHtml}
        <div class="footer">صفحة تفاصيل الأصناف — ${data.orgName}</div>
      </div>`;
  }

  // ── Collections page ────────────────────────────────────────
  const colRows = data.collections.map(c => {
    const statusClass = c.is_reversed ? 'badge-reversed' : 'badge-active';
    const statusLabel = c.is_reversed ? 'معكوسة' : 'نشطة';
    return `
    <tr ${c.is_reversed ? 'style="opacity: 0.5;"' : ''}>
      <td>${c.sale_id.slice(0, 8)}</td>
      <td style="font-weight: 700;">${c.customer_name || '—'}</td>
      <td>${fmtDate(c.created_at)}</td>
      <td style="font-weight: 800; color: #16a34a;">${fmtNum(c.amount)} ${CURRENCY}</td>
      <td>${c.collector_name || '—'}</td>
      <td><span class="badge ${statusClass}">${statusLabel}</span></td>
      <td class="text-muted">${c.notes || '—'}</td>
    </tr>`;
  }).join('');

  const collectionsPage = `
    <div class="page">
      <div class="header-bar"><span>${data.exportDate}</span><span>${data.orgName}</span></div>
      <div class="section-title">💰 سجل التحصيلات (${data.collections.length})</div>
      <table>
        <thead><tr>
          <th>رقم الفاتورة</th><th>الزبون</th><th>التاريخ</th>
          <th>المبلغ</th><th>المحصّل</th><th>الحالة</th><th>ملاحظات</th>
        </tr></thead>
        <tbody>${colRows}</tbody>
      </table>
      <div class="footer">صفحة التحصيلات — ${data.orgName}</div>
    </div>`;

  // ── Logs page ───────────────────────────────────────────────
  const logRows = data.logs.slice(0, 300).map(l => `
    <tr>
      <td><span class="badge" style="background: #eff6ff; color: #3b82f6;">${l.type}</span></td>
      <td style="font-weight: 600;">${l.user_name}</td>
      <td>${l.date}</td>
      <td style="text-align: right; font-size: 9px;">${l.details.length > 80 ? l.details.slice(0, 78) + '...' : l.details}</td>
    </tr>`).join('');

  const logsPage = `
    <div class="page">
      <div class="header-bar"><span>${data.exportDate}</span><span>${data.orgName}</span></div>
      <div class="section-title">📊 سجل العمليات والنشاطات (${Math.min(data.logs.length, 300)})</div>
      <table>
        <thead><tr><th>العملية</th><th>المستخدم</th><th>التاريخ</th><th style="text-align: right;">التفاصيل</th></tr></thead>
        <tbody>${logRows}</tbody>
      </table>
      ${data.logs.length > 300 ? '<p style="text-align: center; color: #94a3b8; font-size: 9px;">... و ' + (data.logs.length - 300) + ' سجل إضافي</p>' : ''}
      <div class="footer">صفحة سجل العمليات — ${data.orgName}</div>
    </div>`;

  return `<!DOCTYPE html><html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
      <style>${baseStyles}</style>
    </head>
    <body>${coverPage}${customersPage}${invoicesPage}${itemsHtml}${collectionsPage}${logsPage}</body>
    </html>`;
}

// ── Main export function ─────────────────────────────────────────
export async function generateBackupPdf(
  data: PdfBackupData,
  onProgress?: (msg: string) => void
): Promise<void> {
  const html = buildBackupHtml(data);

  onProgress?.('جاري تجهيز المستند...');

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

  // Wait for Tajawal font
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
    onProgress?.(`جاري معالجة الصفحة ${i + 1} من ${pages.length}...`);

    const pageEl = pages[i] as HTMLElement;
    // Ensure page is visible for rendering
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

  onProgress?.('جاري حفظ الملف...');

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  pdf.save(`backup_${data.orgName}_${ts}.pdf`);

  document.body.removeChild(container);
}
