/**
 * Shared invoice HTML helpers — legal info block, stamp, and page wrapper.
 * All invoice builders import from here for consistency.
 * 
 * Format: 80mm thermal receipt (printable area 72–76mm)
 */
import { escapeHtml } from '@/lib/htmlEscape';

export interface InvoiceLegalInfo {
  commercial_registration?: string | null;
  industrial_registration?: string | null;
  tax_identification?: string | null;
  trademark_name?: string | null;
  stamp_url?: string | null;
}

/** Render the legal info block under org name */
export function buildLegalInfoHtml(legalInfo: InvoiceLegalInfo | null | undefined): string {
  if (!legalInfo) return '';
  const lines: string[] = [];
  if (legalInfo.trademark_name) lines.push(`العلامة التجارية: ${escapeHtml(legalInfo.trademark_name)}`);
  if (legalInfo.commercial_registration) lines.push(`سجل تجاري: ${escapeHtml(legalInfo.commercial_registration)}`);
  if (legalInfo.industrial_registration) lines.push(`سجل صناعي: ${escapeHtml(legalInfo.industrial_registration)}`);
  if (legalInfo.tax_identification) lines.push(`رقم ضريبي: ${escapeHtml(legalInfo.tax_identification)}`);
  if (lines.length === 0) return '';
  return `<div style="font-size:10px;color:#555;margin-top:6px;">${lines.map(l => `<div>${l}</div>`).join('')}</div>`;
}

/** Render the stamp image if available */
export function buildStampHtml(legalInfo: InvoiceLegalInfo | null | undefined): string {
  if (!legalInfo?.stamp_url) return '';
  return `<div style="text-align:center;margin-top:10px;padding-top:6px;">
    <img src="${escapeHtml(legalInfo.stamp_url)}" alt="ختم الشركة" style="max-width:40mm;max-height:20mm;object-fit:contain;opacity:0.85;" crossorigin="anonymous" />
  </div>`;
}

/** The CSS + <head> for 80mm thermal receipt */
export const INVOICE_PAGE_STYLE = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; width: 80mm; padding: 3mm; font-size: 12px; line-height: 1.4; }
    @media print {
      @page { size: 80mm auto; margin: 0; }
      body { width: 80mm; padding: 3mm; }
      html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }`;

/** Footer HTML */
export const INVOICE_FOOTER_HTML = `
  <div style="text-align:center;font-size:11px;color:#555;margin-top:18px;border-top:1px solid #ccc;padding-top:10px;">
    <p>شكراً لتعاملكم معنا</p>
    <p style="margin-top:3px;font-size:10px;">Smart Sales System</p>
  </div>`;
