import React, { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/store/AppContext';
import { CURRENCY } from '@/constants';
import {
  Database, Download, FileText, Loader2, CheckCircle2,
  Users, Receipt, Wallet, Activity, AlertTriangle, FileSpreadsheet
} from 'lucide-react';
import jsPDF from 'jspdf';

// ── Types ────────────────────────────────────────────────────────
interface BackupCustomer {
  id: string;
  name: string;
  phone: string | null;
  location: string | null;
  balance: number;
  created_by: string | null;
  distributor_name?: string;
}

interface BackupInvoice {
  id: string;
  customer_name: string;
  customer_id: string;
  grand_total: number;
  paid_amount: number;
  remaining: number;
  payment_type: string;
  is_voided: boolean;
  void_reason: string | null;
  created_at: string;
  created_by: string | null;
  discount_type: string | null;
  discount_percentage: number | null;
  discount_value: number | null;
  distributor_name?: string;
  items: BackupInvoiceItem[];
}

interface BackupInvoiceItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface BackupCollection {
  id: string;
  sale_id: string;
  amount: number;
  notes: string | null;
  is_reversed: boolean;
  reverse_reason: string | null;
  created_at: string;
  collected_by: string | null;
  customer_name?: string;
  collector_name?: string;
}

interface BackupLogEntry {
  type: string;
  user_name: string;
  date: string;
  details: string;
}

interface BackupData {
  orgName: string;
  exportDate: string;
  customers: BackupCustomer[];
  invoices: BackupInvoice[];
  collections: BackupCollection[];
  logs: BackupLogEntry[];
}

// ── Component ────────────────────────────────────────────────────
const BackupTab: React.FC = () => {
  const { organization, users } = useApp();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [backupData, setBackupData] = useState<BackupData | null>(null);
  const [previewSection, setPreviewSection] = useState<'customers' | 'invoices' | 'collections' | 'logs'>('customers');

  const userNameMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach(u => { map[u.id] = u.name || u.email || 'غير معروف'; });
    return map;
  }, [users]);

  const getUserName = useCallback((id: string | null) => {
    if (!id) return '—';
    return userNameMap[id] || id.slice(0, 8);
  }, [userNameMap]);

  // ── Fetch all data ──────────────────────────────────────────────
  const generateBackup = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    setBackupData(null);

    try {
      setProgress('جاري تحميل بيانات الزبائن...');
      const { data: customersRaw } = await supabase
        .from('customers')
        .select('id, name, phone, location, balance, created_by')
        .eq('organization_id', organization.id)
        .order('name');

      setProgress('جاري تحميل الفواتير...');
      const { data: salesRaw } = await supabase
        .from('sales')
        .select('id, customer_name, customer_id, grand_total, paid_amount, remaining, payment_type, is_voided, void_reason, created_at, created_by, discount_type, discount_percentage, discount_value')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });

      setProgress('جاري تحميل أصناف الفواتير...');
      const saleIds = (salesRaw || []).map(s => s.id);
      let allItems: any[] = [];
      for (let i = 0; i < saleIds.length; i += 100) {
        const batch = saleIds.slice(i, i + 100);
        const { data: itemsBatch } = await supabase
          .from('sale_items')
          .select('sale_id, product_name, quantity, unit_price, total_price')
          .in('sale_id', batch);
        if (itemsBatch) allItems = [...allItems, ...itemsBatch];
      }

      setProgress('جاري تحميل التحصيلات...');
      const { data: collectionsRaw } = await supabase
        .from('collections')
        .select('id, sale_id, amount, notes, is_reversed, reverse_reason, created_at, collected_by')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });

      setProgress('جاري تحميل سجل العمليات...');
      const { data: auditRaw } = await supabase
        .from('audit_logs')
        .select('action, entity_type, user_id, created_at, details')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })
        .limit(500);

      const { data: priceChangesRaw } = await supabase
        .from('price_change_history')
        .select('product_name, field_changed, old_value, new_value, changed_by_name, created_at')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })
        .limit(200);

      // ── Transform data ──────────────────────────────────────────
      setProgress('جاري تنظيم البيانات...');

      const itemsBySale: Record<string, BackupInvoiceItem[]> = {};
      allItems.forEach((item: any) => {
        if (!itemsBySale[item.sale_id]) itemsBySale[item.sale_id] = [];
        itemsBySale[item.sale_id].push({
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
          total_price: Number(item.total_price),
        });
      });

      // Map sales to customer distributors
      const salesByCustId: Record<string, string> = {};
      (salesRaw || []).forEach(s => {
        if (s.created_by && !salesByCustId[s.customer_id]) {
          salesByCustId[s.customer_id] = s.created_by;
        }
      });

      const customers: BackupCustomer[] = (customersRaw || []).map(c => ({
        ...c,
        balance: Number(c.balance),
        distributor_name: c.created_by ? getUserName(c.created_by) : '—',
      }));

      const invoices: BackupInvoice[] = (salesRaw || []).map(s => ({
        ...s,
        grand_total: Number(s.grand_total),
        paid_amount: Number(s.paid_amount),
        remaining: Number(s.remaining),
        discount_percentage: Number(s.discount_percentage || 0),
        discount_value: Number(s.discount_value || 0),
        distributor_name: getUserName(s.created_by),
        items: itemsBySale[s.id] || [],
      }));

      // Map sale_id → customer_name for collections
      const saleCustomerMap: Record<string, string> = {};
      invoices.forEach(inv => { saleCustomerMap[inv.id] = inv.customer_name; });

      const collections: BackupCollection[] = (collectionsRaw || []).map(c => ({
        ...c,
        amount: Number(c.amount),
        customer_name: saleCustomerMap[c.sale_id] || '—',
        collector_name: getUserName(c.collected_by),
      }));

      const logs: BackupLogEntry[] = [
        ...(auditRaw || []).map(a => ({
          type: translateAction(a.action, a.entity_type),
          user_name: getUserName(a.user_id),
          date: formatDate(a.created_at),
          details: summarizeAuditDetails(a.details as any, a.action),
        })),
        ...(priceChangesRaw || []).map(p => ({
          type: 'تعديل سعر',
          user_name: p.changed_by_name,
          date: formatDate(p.created_at),
          details: `${p.product_name}: ${translateField(p.field_changed)} من ${Number(p.old_value).toLocaleString()} إلى ${Number(p.new_value).toLocaleString()}`,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const backup: BackupData = {
        orgName: organization.name || 'الشركة',
        exportDate: new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        customers,
        invoices,
        collections,
        logs,
      };

      setBackupData(backup);
      setProgress('');
    } catch (err) {
      console.error('[Backup] Error:', err);
      setProgress('حدث خطأ أثناء توليد النسخة الاحتياطية');
    } finally {
      setLoading(false);
    }
  }, [organization, getUserName]);

  // ── PDF Export ──────────────────────────────────────────────────
  const exportPDF = useCallback(async () => {
    if (!backupData) return;
    setLoading(true);
    setProgress('جاري إنشاء ملف PDF...');

    try {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 12;
      const contentW = pageW - margin * 2;
      let y = margin;
      let pageNum = 1;

      // Load Arabic font - use built-in helvetica as fallback
      // jsPDF doesn't natively support Arabic, so we'll use html rendering approach
      
      const addHeader = () => {
        pdf.setFillColor(30, 41, 59); // slate-800
        pdf.rect(0, 0, pageW, 18, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(10);
        pdf.text(backupData.exportDate, margin, 11);
        pdf.text(backupData.orgName, pageW - margin, 11, { align: 'right' });
        pdf.setTextColor(0, 0, 0);
        y = 24;
      };

      const addFooter = () => {
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`${pageNum}`, pageW / 2, pageH - 6, { align: 'center' });
        pdf.setTextColor(0, 0, 0);
      };

      const checkNewPage = (needed: number) => {
        if (y + needed > pageH - 14) {
          addFooter();
          pdf.addPage();
          pageNum++;
          addHeader();
        }
      };

      const drawTable = (headers: string[], rows: string[][], colWidths: number[]) => {
        const rowH = 7;
        const headerH = 8;

        checkNewPage(headerH + rowH * Math.min(rows.length, 3));

        // Header row
        pdf.setFillColor(241, 245, 249); // slate-100
        pdf.rect(margin, y, contentW, headerH, 'F');
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        let xPos = pageW - margin;
        headers.forEach((h, i) => {
          xPos -= colWidths[i];
          pdf.text(h, xPos + colWidths[i] / 2, y + 5.5, { align: 'center' });
        });
        y += headerH;

        // Data rows
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(6.5);
        rows.forEach((row, ri) => {
          checkNewPage(rowH);
          if (ri % 2 === 1) {
            pdf.setFillColor(248, 250, 252);
            pdf.rect(margin, y, contentW, rowH, 'F');
          }
          xPos = pageW - margin;
          row.forEach((cell, ci) => {
            xPos -= colWidths[ci];
            const truncated = cell.length > 30 ? cell.slice(0, 28) + '..' : cell;
            pdf.text(truncated, xPos + colWidths[ci] / 2, y + 4.5, { align: 'center' });
          });
          y += rowH;
        });

        // Bottom border
        pdf.setDrawColor(200, 200, 200);
        pdf.line(margin, y, pageW - margin, y);
        y += 4;
      };

      const addSectionTitle = (title: string, icon: string) => {
        checkNewPage(16);
        pdf.setFillColor(59, 130, 246); // blue-500
        pdf.roundedRect(margin, y, contentW, 10, 2, 2, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${icon}  ${title}`, pageW - margin - 4, y + 7, { align: 'right' });
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'normal');
        y += 14;
      };

      // ── Cover page ──────────────────────────────────────────────
      addHeader();
      y = pageH / 2 - 20;
      pdf.setFontSize(22);
      pdf.setFont('helvetica', 'bold');
      pdf.text(backupData.orgName, pageW / 2, y, { align: 'center' });
      y += 12;
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Full Company Data Backup', pageW / 2, y, { align: 'center' });
      y += 8;
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(backupData.exportDate, pageW / 2, y, { align: 'center' });
      y += 12;
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(9);
      const summaryLines = [
        `Customers: ${backupData.customers.length}`,
        `Invoices: ${backupData.invoices.length}`,
        `Collections: ${backupData.collections.length}`,
        `Activity Logs: ${backupData.logs.length}`,
      ];
      summaryLines.forEach(line => {
        pdf.text(line, pageW / 2, y, { align: 'center' });
        y += 6;
      });
      addFooter();

      // ── Customers ──────────────────────────────────────────────
      pdf.addPage(); pageNum++;
      addHeader();
      addSectionTitle('Customers Database', '#');

      const custHeaders = ['Balance', 'Distributor', 'Location', 'Phone', 'Name', 'ID'];
      const custWidths = [25, 35, 35, 30, 45, contentW - 170];
      const custRows = backupData.customers.map(c => [
        `${c.balance.toLocaleString()} ${CURRENCY}`,
        c.distributor_name || '—',
        c.location || '—',
        c.phone || '—',
        c.name,
        c.id.slice(0, 8),
      ]);
      drawTable(custHeaders, custRows, custWidths);
      addFooter();

      // ── Invoices ───────────────────────────────────────────────
      pdf.addPage(); pageNum++;
      addHeader();
      addSectionTitle('Invoices', '#');

      const invHeaders = ['Net Total', 'Discount', 'Paid', 'Total', 'Type', 'Date', 'Customer', 'No.'];
      const invWidths = [28, 22, 25, 25, 18, 30, 45, contentW - 193];
      const invRows = backupData.invoices.map(inv => {
        const subtotal = inv.grand_total + inv.discount_value;
        return [
          `${inv.grand_total.toLocaleString()}`,
          inv.discount_value > 0 ? `${inv.discount_value.toLocaleString()}` : '—',
          `${inv.paid_amount.toLocaleString()}`,
          `${subtotal.toLocaleString()}`,
          inv.payment_type === 'CASH' ? 'Cash' : 'Credit',
          formatDateShort(inv.created_at),
          inv.customer_name,
          inv.id.slice(0, 8),
        ];
      });
      drawTable(invHeaders, invRows, invWidths);
      addFooter();

      // ── Invoice Items detail (grouped by invoice) ───────────────
      const invoicesWithItems = backupData.invoices.filter(inv => inv.items.length > 0).slice(0, 100);
      if (invoicesWithItems.length > 0) {
        pdf.addPage(); pageNum++;
        addHeader();
        addSectionTitle('Invoice Items Detail', '#');

        const itemHeaders = ['Total', 'Unit Price', 'Qty', 'Product'];
        const itemWidths = [30, 30, 20, contentW - 80];

        invoicesWithItems.forEach(inv => {
          checkNewPage(20);
          pdf.setFontSize(7);
          pdf.setFont('helvetica', 'bold');
          pdf.text(`Invoice: ${inv.id.slice(0, 8)} | ${inv.customer_name} | ${formatDateShort(inv.created_at)}`, pageW - margin, y, { align: 'right' });
          pdf.setFont('helvetica', 'normal');
          y += 5;

          const itemRows = inv.items.map(it => [
            it.total_price.toLocaleString(),
            it.unit_price.toLocaleString(),
            it.quantity.toString(),
            it.product_name,
          ]);
          drawTable(itemHeaders, itemRows, itemWidths);
          y += 2;
        });
        addFooter();
      }

      // ── Collections ────────────────────────────────────────────
      pdf.addPage(); pageNum++;
      addHeader();
      addSectionTitle('Collections / Payments', '#');

      const colHeaders = ['Status', 'Collector', 'Amount', 'Date', 'Customer', 'Invoice'];
      const colWidths = [22, 35, 28, 30, 45, contentW - 160];
      const colRows = backupData.collections.map(c => [
        c.is_reversed ? 'Reversed' : 'Active',
        c.collector_name || '—',
        `${c.amount.toLocaleString()}`,
        formatDateShort(c.created_at),
        c.customer_name || '—',
        c.sale_id.slice(0, 8),
      ]);
      drawTable(colHeaders, colRows, colWidths);
      addFooter();

      // ── Activity Logs ──────────────────────────────────────────
      pdf.addPage(); pageNum++;
      addHeader();
      addSectionTitle('Operational Activity Log', '#');

      const logHeaders = ['Details', 'Date', 'User', 'Operation'];
      const logWidths = [contentW - 100, 30, 35, 35];
      const logRows = backupData.logs.slice(0, 300).map(l => [
        l.details,
        l.date,
        l.user_name,
        l.type,
      ]);
      drawTable(logHeaders, logRows, logWidths);
      addFooter();

      // ── Save PDF ───────────────────────────────────────────────
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
      pdf.save(`backup_${backupData.orgName}_${ts}.pdf`);

      setProgress('');
    } catch (err) {
      console.error('[Backup PDF]:', err);
      setProgress('حدث خطأ أثناء إنشاء PDF');
    } finally {
      setLoading(false);
    }
  }, [backupData]);

  // ── Excel CSV Export ───────────────────────────────────────────
  const exportCSV = useCallback(() => {
    if (!backupData) return;

    const sheets: { name: string; headers: string[]; rows: string[][] }[] = [
      {
        name: 'Customers',
        headers: ['ID', 'Name', 'Phone', 'Location', 'Balance', 'Distributor'],
        rows: backupData.customers.map(c => [c.id, c.name, c.phone || '', c.location || '', c.balance.toString(), c.distributor_name || '']),
      },
      {
        name: 'Invoices',
        headers: ['ID', 'Customer', 'Date', 'Payment Type', 'Total', 'Discount Type', 'Discount %', 'Discount Value', 'Net Total', 'Paid', 'Remaining', 'Voided', 'Distributor'],
        rows: backupData.invoices.map(inv => [
          inv.id, inv.customer_name, inv.created_at, inv.payment_type,
          (inv.grand_total + inv.discount_value).toString(),
          inv.discount_type || '', (inv.discount_percentage || 0).toString(),
          (inv.discount_value || 0).toString(), inv.grand_total.toString(),
          inv.paid_amount.toString(), inv.remaining.toString(),
          inv.is_voided ? 'Yes' : 'No', inv.distributor_name || '',
        ]),
      },
      {
        name: 'Collections',
        headers: ['ID', 'Invoice ID', 'Customer', 'Amount', 'Date', 'Collector', 'Reversed', 'Notes'],
        rows: backupData.collections.map(c => [
          c.id, c.sale_id, c.customer_name || '', c.amount.toString(),
          c.created_at, c.collector_name || '', c.is_reversed ? 'Yes' : 'No', c.notes || '',
        ]),
      },
      {
        name: 'Activity Logs',
        headers: ['Type', 'User', 'Date', 'Details'],
        rows: backupData.logs.map(l => [l.type, l.user_name, l.date, l.details]),
      },
    ];

    sheets.forEach(sheet => {
      const csvContent = [
        sheet.headers.join(','),
        ...sheet.rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${backupData.orgName}_${sheet.name}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }, [backupData]);

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header Card */}
      <div className="bg-card p-5 rounded-2xl border shadow-sm text-center">
        <div className="w-14 h-14 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center mb-3">
          <Database className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-lg font-black text-foreground mb-1">مركز النسخ الاحتياطي</h2>
        <p className="text-xs text-muted-foreground mb-4">
          توليد نسخة احتياطية كاملة لجميع بيانات الشركة
        </p>

        <button
          onClick={generateBackup}
          disabled={loading}
          className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-[0.98]"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {progress || 'جاري التوليد...'}
            </>
          ) : backupData ? (
            <>
              <CheckCircle2 className="w-5 h-5" />
              إعادة توليد النسخة الاحتياطية
            </>
          ) : (
            <>
              <Database className="w-5 h-5" />
              توليد النسخة الاحتياطية الكاملة
            </>
          )}
        </button>
      </div>

      {/* Backup Summary & Export */}
      {backupData && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-2">
            <SummaryCard icon={<Users className="w-4 h-4" />} label="الزبائن" value={backupData.customers.length} color="blue" />
            <SummaryCard icon={<Receipt className="w-4 h-4" />} label="الفواتير" value={backupData.invoices.length} color="emerald" />
            <SummaryCard icon={<Wallet className="w-4 h-4" />} label="التحصيلات" value={backupData.collections.length} color="amber" />
            <SummaryCard icon={<Activity className="w-4 h-4" />} label="سجل العمليات" value={backupData.logs.length} color="purple" />
          </div>

          {/* Export Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={exportPDF}
              disabled={loading}
              className="py-3 bg-destructive/10 text-destructive rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-destructive/20 transition-all active:scale-[0.98]"
            >
              <FileText className="w-4 h-4" />
              تصدير PDF (A4)
            </button>
            <button
              onClick={exportCSV}
              disabled={loading}
              className="py-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-emerald-500/20 transition-all active:scale-[0.98]"
            >
              <FileSpreadsheet className="w-4 h-4" />
              تصدير Excel (CSV)
            </button>
          </div>

          {/* Preview Navigation */}
          <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
            <div className="flex border-b border-border">
              {([
                { id: 'customers' as const, label: 'الزبائن', icon: <Users className="w-3.5 h-3.5" /> },
                { id: 'invoices' as const, label: 'الفواتير', icon: <Receipt className="w-3.5 h-3.5" /> },
                { id: 'collections' as const, label: 'التحصيلات', icon: <Wallet className="w-3.5 h-3.5" /> },
                { id: 'logs' as const, label: 'السجل', icon: <Activity className="w-3.5 h-3.5" /> },
              ]).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setPreviewSection(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-bold transition-all ${
                    previewSection === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Preview Content */}
            <div className="p-3 max-h-[60vh] overflow-y-auto">
              {previewSection === 'customers' && <CustomersPreview data={backupData.customers} />}
              {previewSection === 'invoices' && <InvoicesPreview data={backupData.invoices} />}
              {previewSection === 'collections' && <CollectionsPreview data={backupData.collections} />}
              {previewSection === 'logs' && <LogsPreview data={backupData.logs} />}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ── Preview Sub-components ────────────────────────────────────────

const SummaryCard: React.FC<{ icon: React.ReactNode; label: string; value: number; color: string }> = ({ icon, label, value, color }) => {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  };
  return (
    <div className="bg-card p-3 rounded-xl border shadow-sm flex items-center gap-3">
      <div className={`p-2 rounded-lg ${colorMap[color]}`}>{icon}</div>
      <div>
        <p className="text-lg font-black text-foreground">{value.toLocaleString()}</p>
        <p className="text-[9px] font-bold text-muted-foreground">{label}</p>
      </div>
    </div>
  );
};

const CustomersPreview: React.FC<{ data: BackupCustomer[] }> = ({ data }) => (
  <div className="space-y-1.5">
    {data.length === 0 && <EmptyState />}
    {data.slice(0, 50).map(c => (
      <div key={c.id} className="bg-muted p-2.5 rounded-xl flex justify-between items-center">
        <div>
          <p className="text-xs font-bold text-foreground">{c.name}</p>
          <p className="text-[9px] text-muted-foreground">{c.phone || '—'} • {c.distributor_name}</p>
        </div>
        <p className={`text-xs font-black ${c.balance > 0 ? 'text-destructive' : 'text-success'}`}>
          {c.balance.toLocaleString()} {CURRENCY}
        </p>
      </div>
    ))}
    {data.length > 50 && <p className="text-center text-[10px] text-muted-foreground py-2">+{data.length - 50} زبون آخر</p>}
  </div>
);

const InvoicesPreview: React.FC<{ data: BackupInvoice[] }> = ({ data }) => (
  <div className="space-y-1.5">
    {data.length === 0 && <EmptyState />}
    {data.slice(0, 30).map(inv => (
      <div key={inv.id} className={`bg-muted p-2.5 rounded-xl ${inv.is_voided ? 'opacity-50' : ''}`}>
        <div className="flex justify-between items-start mb-1">
          <div>
            <p className="text-xs font-bold text-foreground">{inv.customer_name}</p>
            <p className="text-[9px] text-muted-foreground">
              {formatDateShort(inv.created_at)} • {inv.payment_type === 'CASH' ? 'نقدي' : 'آجل'}
              {inv.is_voided && ' • ملغية'}
            </p>
          </div>
          <div className="text-left">
            <p className="text-xs font-black text-foreground">{inv.grand_total.toLocaleString()} {CURRENCY}</p>
            {inv.discount_value > 0 && (
              <p className="text-[9px] text-amber-600 dark:text-amber-400">خصم: {inv.discount_value.toLocaleString()}</p>
            )}
          </div>
        </div>
        {inv.items.length > 0 && (
          <div className="text-[9px] text-muted-foreground">
            {inv.items.map(it => it.product_name).join('، ')}
          </div>
        )}
      </div>
    ))}
    {data.length > 30 && <p className="text-center text-[10px] text-muted-foreground py-2">+{data.length - 30} فاتورة أخرى</p>}
  </div>
);

const CollectionsPreview: React.FC<{ data: BackupCollection[] }> = ({ data }) => (
  <div className="space-y-1.5">
    {data.length === 0 && <EmptyState />}
    {data.slice(0, 30).map(c => (
      <div key={c.id} className={`bg-muted p-2.5 rounded-xl flex justify-between items-center ${c.is_reversed ? 'opacity-50' : ''}`}>
        <div>
          <p className="text-xs font-bold text-foreground">{c.customer_name}</p>
          <p className="text-[9px] text-muted-foreground">
            {formatDateShort(c.created_at)} • {c.collector_name}
            {c.is_reversed && ' • معكوسة'}
          </p>
        </div>
        <p className="text-xs font-black text-success">{c.amount.toLocaleString()} {CURRENCY}</p>
      </div>
    ))}
    {data.length > 30 && <p className="text-center text-[10px] text-muted-foreground py-2">+{data.length - 30} عملية أخرى</p>}
  </div>
);

const LogsPreview: React.FC<{ data: BackupLogEntry[] }> = ({ data }) => (
  <div className="space-y-1.5">
    {data.length === 0 && <EmptyState />}
    {data.slice(0, 40).map((l, i) => (
      <div key={i} className="bg-muted p-2.5 rounded-xl">
        <div className="flex justify-between items-start">
          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{l.type}</span>
          <span className="text-[9px] text-muted-foreground">{l.date}</span>
        </div>
        <p className="text-xs text-foreground mt-1">{l.details}</p>
        <p className="text-[9px] text-muted-foreground mt-0.5">{l.user_name}</p>
      </div>
    ))}
    {data.length > 40 && <p className="text-center text-[10px] text-muted-foreground py-2">+{data.length - 40} سجل آخر</p>}
  </div>
);

const EmptyState: React.FC = () => (
  <div className="text-center py-8">
    <AlertTriangle className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
    <p className="text-xs text-muted-foreground">لا توجد بيانات</p>
  </div>
);

// ── Helpers ──────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return iso; }
}

function formatDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch { return iso; }
}

function translateAction(action: string, entity: string): string {
  const map: Record<string, string> = {
    'INSERT': 'إضافة', 'UPDATE': 'تعديل', 'DELETE': 'حذف',
    'CREATE': 'إنشاء', 'VOID': 'إلغاء', 'REVERSE': 'عكس',
  };
  const entityMap: Record<string, string> = {
    'sale': 'فاتورة', 'collection': 'تحصيل', 'product': 'منتج',
    'customer': 'زبون', 'delivery': 'تسليم', 'purchase': 'مشتريات',
    'profile': 'حساب', 'license': 'رخصة',
  };
  return `${map[action] || action} ${entityMap[entity] || entity}`;
}

function translateField(field: string): string {
  const map: Record<string, string> = {
    'cost_price': 'سعر التكلفة',
    'base_price': 'سعر البيع',
    'consumer_price': 'سعر المستهلك',
  };
  return map[field] || field;
}

function summarizeAuditDetails(details: any, action: string): string {
  if (!details) return action;
  if (typeof details === 'string') return details;
  try {
    if (details.customer_name) return `زبون: ${details.customer_name}`;
    if (details.product_name) return `منتج: ${details.product_name}`;
    if (details.amount) return `مبلغ: ${Number(details.amount).toLocaleString()}`;
    return JSON.stringify(details).slice(0, 60);
  } catch { return action; }
}

export default BackupTab;
