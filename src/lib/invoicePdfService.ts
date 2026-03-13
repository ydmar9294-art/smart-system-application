/**
 * invoicePdfService — Enterprise PDF Export + Share + Save
 *
 * Flow: Invoice HTML → hidden iframe → html2canvas → jsPDF → Uint8Array
 *       → Share (Capacitor Share) or browser download
 *
 * Layout: 80mm thermal receipt (printable area ~74mm).
 * 
 * PERFORMANCE: jsPDF and html2canvas are lazy-loaded via dynamic import()
 * to keep them out of the initial bundle (~610KB savings).
 */

import { logger } from '@/lib/logger';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// ── Detect Capacitor Android ────────────────────────────────────────────────
const isCapacitor = (): boolean =>
  typeof (window as any).Capacitor !== 'undefined' &&
  (window as any).Capacitor?.isNativePlatform?.() === true;

// ── PDF dimensions: 80mm thermal receipt ──────────────────────────────────
const PDF_WIDTH_MM = 80;

// ── Lazy loaders ──────────────────────────────────────────────────────────
async function loadJsPDF() {
  const mod = await import('jspdf');
  return mod.default;
}

async function loadHtml2Canvas() {
  const mod = await import('html2canvas');
  return mod.default;
}

// ─────────────────────────────────────────────────────────────────────────────
// generateInvoicePdf
// ─────────────────────────────────────────────────────────────────────────────
export async function generateInvoicePdf(
  htmlContent: string,
  invoiceTitle = 'فاتورة'
): Promise<{ pdfBase64: string; pdfBlob: Blob }> {
  // Load heavy libs on demand
  const [jsPDFClass, html2canvas] = await Promise.all([loadJsPDF(), loadHtml2Canvas()]);

  return new Promise((resolve, reject) => {
    const RENDER_WIDTH = 302;
    const container = document.createElement('div');
    Object.assign(container.style, {
      position:   'fixed',
      top:        '-99999px',
      left:       '-99999px',
      width:      `${RENDER_WIDTH}px`,
      background: '#ffffff',
      zIndex:     '-1',
      direction:  'rtl',
      fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif",
    });

    const iframe = document.createElement('iframe');
    Object.assign(iframe.style, {
      width:  `${RENDER_WIDTH}px`,
      height: '1px',
      border: 'none',
    });

    document.body.appendChild(container);
    container.appendChild(iframe);

    iframe.addEventListener('load', async () => {
      try {
        const iDoc = iframe.contentDocument!;
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        await new Promise(r => setTimeout(r, 300));

        const body = iDoc.body;
        const scrollH = body.scrollHeight;
        iframe.style.height = scrollH + 'px';
        await new Promise(r => setTimeout(r, 100));

        const canvas = await html2canvas(body, {
          scale:           2,
          useCORS:         true,
          backgroundColor: '#ffffff',
          logging:         false,
          width:           RENDER_WIDTH,
          height:          body.scrollHeight,
          windowWidth:     RENDER_WIDTH,
        });

        const imgW  = PDF_WIDTH_MM;
        const imgH  = (canvas.height * imgW) / canvas.width;

        const pdf = new jsPDFClass({
          orientation: 'portrait',
          unit:        'mm',
          format:      [PDF_WIDTH_MM, imgH],
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(imgData, 'JPEG', 0, 0, imgW, imgH);

        const pdfBase64 = pdf.output('datauristring').split(',')[1];
        const pdfBlob   = pdf.output('blob');

        resolve({ pdfBase64, pdfBlob });
      } catch (err) {
        reject(err);
      } finally {
        try { document.body.removeChild(container); } catch (_) { /* ignore */ }
      }
    }, { once: true });

    iframe.addEventListener('error', () => {
      try { document.body.removeChild(container); } catch (_) { /* ignore */ }
      reject(new Error('iframe failed to load'));
    }, { once: true });

    iframe.srcdoc = htmlContent;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// shareInvoicePdf
// ─────────────────────────────────────────────────────────────────────────────
export async function shareInvoicePdf(
  pdfBase64: string,
  fileName: string,
  title = 'مشاركة الفاتورة'
): Promise<void> {
  if (isCapacitor()) {
    try {
      const tempPath = `invoices/temp_${fileName}`;

      await Filesystem.writeFile({
        path:      tempPath,
        data:      pdfBase64,
        directory: Directory.Cache,
        recursive: true,
      });

      const { uri } = await Filesystem.getUri({
        path:      tempPath,
        directory: Directory.Cache,
      });

      await Share.share({
        title,
        text:  title,
        url:   uri,
        dialogTitle: title,
      });

      try {
        await Filesystem.deleteFile({ path: tempPath, directory: Directory.Cache });
      } catch (_) { /* ignore */ }

      return;
    } catch (err) {
      logger.error('Capacitor share failed', 'InvoicePdf');
    }
  }

  const blob = base64ToBlob(pdfBase64, 'application/pdf');
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href:     url,
    target:   '_blank',
    download: fileName,
  });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
// saveInvoicePdf
// ─────────────────────────────────────────────────────────────────────────────
export async function saveInvoicePdf(
  pdfBase64: string,
  fileName: string
): Promise<void> {
  if (isCapacitor()) {
    try {
      await Filesystem.writeFile({
        path:      `invoices/${fileName}`,
        data:      pdfBase64,
        directory: Directory.Documents,
        recursive: true,
      });
      return;
    } catch (err) {
      logger.warn('Documents directory failed, trying ExternalStorage', 'InvoicePdf');
    }

    try {
      await Filesystem.writeFile({
        path:      `invoices/${fileName}`,
        data:      pdfBase64,
        directory: Directory.ExternalStorage as any,
        recursive: true,
      });
      return;
    } catch (err) {
      logger.error('All Capacitor save attempts failed', 'InvoicePdf');
      throw err;
    }
  }

  const blob = base64ToBlob(pdfBase64, 'application/pdf');
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href:     url,
    download: fileName,
  });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

/** Build a safe filename for the PDF */
export function buildInvoiceFileName(invoiceId: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const id = invoiceId.slice(0, 8);
  return `invoice_${id}_${ts}.pdf`;
}
