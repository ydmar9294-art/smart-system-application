/**
 * invoicePdfService — Enterprise PDF Export + Share + Save
 *
 * Flow: Invoice HTML → hidden iframe → html2canvas → jsPDF → Uint8Array
 *       → Share (Capacitor Share) or Save (Capacitor Filesystem / browser download)
 *
 * Layout: Uses the EXACT same 80mm width the thermal-print HTML uses.
 *         Nothing about the invoice design is changed.
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ── Detect Capacitor Android ────────────────────────────────────────────────
const isCapacitor = (): boolean =>
  typeof (window as any).Capacitor !== 'undefined' &&
  (window as any).Capacitor?.isNativePlatform?.() === true;

// ── PDF dimensions (matches the 80mm thermal invoice width) ────────────────
// jsPDF 'mm' units; keep width exactly 80mm, height auto-calculated from content
const PDF_WIDTH_MM = 80;

// ─────────────────────────────────────────────────────────────────────────────
// generateInvoicePdf
//   Renders htmlContent into an off-screen element, captures via html2canvas,
//   and returns a jsPDF document + base64 string.
// ─────────────────────────────────────────────────────────────────────────────
export async function generateInvoicePdf(
  htmlContent: string,
  invoiceTitle = 'فاتورة'
): Promise<{ pdfBase64: string; pdfBlob: Blob }> {
  return new Promise((resolve, reject) => {
    // ── 1. Create a hidden container that matches the invoice width ──────────
    const container = document.createElement('div');
    Object.assign(container.style, {
      position:   'fixed',
      top:        '-99999px',
      left:       '-99999px',
      width:      '302px',   // 80mm ≈ 302px at 96dpi
      background: '#ffffff',
      zIndex:     '-1',
      direction:  'rtl',
      fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif",
    });

    // ── 2. Inject invoice HTML (same HTML string used for printing) ──────────
    // We render it inside a shadow iframe then capture the body
    const iframe = document.createElement('iframe');
    Object.assign(iframe.style, {
      width:  '302px',
      height: '1px',
      border: 'none',
    });

    document.body.appendChild(container);
    container.appendChild(iframe);

    iframe.addEventListener('load', async () => {
      try {
        const iDoc = iframe.contentDocument!;

        // Let browser paint before capturing
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        await new Promise(r => setTimeout(r, 300));

        const body = iDoc.body;
        const scrollH = body.scrollHeight;

        // Resize iframe to full content height so nothing is clipped
        iframe.style.height = scrollH + 'px';
        await new Promise(r => setTimeout(r, 100));

        // ── 3. html2canvas capture ───────────────────────────────────────────
        const canvas = await html2canvas(body, {
          scale:           2,            // retina quality
          useCORS:         true,
          backgroundColor: '#ffffff',
          logging:         false,
          width:           302,
          height:          body.scrollHeight,
          windowWidth:     302,
        });

        // ── 4. jsPDF: 80mm wide, auto height ────────────────────────────────
        const imgW  = PDF_WIDTH_MM;
        const imgH  = (canvas.height * imgW) / canvas.width;

        const pdf = new jsPDF({
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
// shareInvoicePdf  — opens native share sheet (Android/iOS) or browser fallback
// ─────────────────────────────────────────────────────────────────────────────
export async function shareInvoicePdf(
  pdfBase64: string,
  fileName: string,
  title = 'مشاركة الفاتورة'
): Promise<void> {
  if (isCapacitor()) {
    try {
      // Save to temp location first, then share
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');

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

      // Clean up temp file after share
      try {
        await Filesystem.deleteFile({ path: tempPath, directory: Directory.Cache });
      } catch (_) { /* ignore */ }

      return;
    } catch (err) {
      console.error('[invoicePdfService] Capacitor share failed:', err);
      // fall through to browser fallback
    }
  }

  // ── Browser fallback: open PDF in new tab ──────────────────────────────
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
// saveInvoicePdf  — saves PDF to device Downloads (Android) or Files (iOS)
// ─────────────────────────────────────────────────────────────────────────────
export async function saveInvoicePdf(
  pdfBase64: string,
  fileName: string
): Promise<void> {
  if (isCapacitor()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');

    try {
      // Android: ExternalStorage → Downloads folder
      // iOS: Documents folder (accessible via Files app)
      await Filesystem.writeFile({
        path:      `invoices/${fileName}`,
        data:      pdfBase64,
        directory: Directory.Documents,
        recursive: true,
      });
      return;
    } catch (err) {
      console.warn('[invoicePdfService] Documents directory failed, trying ExternalStorage:', err);
    }

    try {
      // Android fallback: ExternalStorage
      await Filesystem.writeFile({
        path:      `invoices/${fileName}`,
        data:      pdfBase64,
        directory: Directory.ExternalStorage as any,
        recursive: true,
      });
      return;
    } catch (err) {
      console.error('[invoicePdfService] All Capacitor save attempts failed:', err);
      throw err;
    }
  }

  // ── Browser fallback: trigger download ───────────────────────────────────
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
