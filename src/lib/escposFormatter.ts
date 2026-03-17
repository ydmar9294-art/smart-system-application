/**
 * ESC/POS Formatter — Generates ESC/POS commands for thermal printers
 * Supports 58mm and 80mm paper widths.
 */

const ESC = '\x1B';
const GS = '\x1D';
const LF = '\x0A';

// Text alignment
const ALIGN_LEFT = `${ESC}a\x00`;
const ALIGN_CENTER = `${ESC}a\x01`;
const ALIGN_RIGHT = `${ESC}a\x02`;

// Text size
const TEXT_NORMAL = `${GS}!\x00`;
const TEXT_DOUBLE_HEIGHT = `${GS}!\x01`;
const TEXT_DOUBLE_WIDTH = `${GS}!\x10`;
const TEXT_DOUBLE = `${GS}!\x11`;

// Bold
const BOLD_ON = `${ESC}E\x01`;
const BOLD_OFF = `${ESC}E\x00`;

// Cut paper
const CUT = `${GS}V\x00`;
const PARTIAL_CUT = `${GS}V\x01`;

// Initialize printer
const INIT = `${ESC}@`;

interface InvoiceItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface InvoiceData {
  invoiceNumber: string;
  date: string;
  customerName: string;
  items: InvoiceItem[];
  grandTotal: number;
  paidAmount: number;
  remaining: number;
  paymentType: string;
  orgName?: string;
  distributorName?: string;
  notes?: string;
}

/**
 * Format an invoice for ESC/POS thermal printing
 */
export function formatInvoiceEscPos(invoice: InvoiceData, paperWidth: 58 | 80 = 58): string {
  const lineWidth = paperWidth === 58 ? 32 : 48;
  const separator = '-'.repeat(lineWidth);
  
  let output = INIT; // Reset printer

  // Header
  output += ALIGN_CENTER;
  output += TEXT_DOUBLE;
  output += (invoice.orgName || 'Smart System') + LF;
  output += TEXT_NORMAL;
  output += LF;

  // Invoice info
  output += BOLD_ON;
  output += `فاتورة رقم: ${invoice.invoiceNumber}` + LF;
  output += BOLD_OFF;
  output += `التاريخ: ${invoice.date}` + LF;
  output += `العميل: ${invoice.customerName}` + LF;
  if (invoice.distributorName) {
    output += `المندوب: ${invoice.distributorName}` + LF;
  }
  output += separator + LF;

  // Items header
  output += ALIGN_RIGHT;
  output += BOLD_ON;
  output += padLine('الإجمالي', 'الكمية×السعر', 'المنتج', lineWidth) + LF;
  output += BOLD_OFF;
  output += separator + LF;

  // Items
  for (const item of invoice.items) {
    const priceStr = `${item.quantity}×${item.unitPrice}`;
    const totalStr = item.totalPrice.toLocaleString();
    output += padLine(totalStr, priceStr, item.name, lineWidth) + LF;
  }

  output += separator + LF;

  // Totals
  output += ALIGN_RIGHT;
  output += BOLD_ON;
  output += TEXT_DOUBLE_HEIGHT;
  output += `الإجمالي: ${invoice.grandTotal.toLocaleString()} ل.س` + LF;
  output += TEXT_NORMAL;
  output += BOLD_OFF;
  output += `المدفوع: ${invoice.paidAmount.toLocaleString()} ل.س` + LF;
  if (invoice.remaining > 0) {
    output += BOLD_ON;
    output += `المتبقي: ${invoice.remaining.toLocaleString()} ل.س` + LF;
    output += BOLD_OFF;
  }
  output += `نوع الدفع: ${invoice.paymentType === 'CASH' ? 'نقدي' : 'آجل'}` + LF;

  if (invoice.notes) {
    output += separator + LF;
    output += `ملاحظات: ${invoice.notes}` + LF;
  }

  // Footer
  output += LF;
  output += ALIGN_CENTER;
  output += 'شكراً لتعاملكم معنا' + LF;
  output += LF + LF + LF;
  output += PARTIAL_CUT;

  return output;
}

function padLine(right: string, center: string, left: string, width: number): string {
  const used = left.length + center.length + right.length;
  const padding = Math.max(1, width - used);
  const leftPad = Math.floor(padding / 2);
  const rightPad = padding - leftPad;
  return left + ' '.repeat(leftPad) + center + ' '.repeat(rightPad) + right;
}

/**
 * Convert ESC/POS string to Uint8Array for Bluetooth transmission
 */
export function escPosToBytes(escPosStr: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(escPosStr);
}
