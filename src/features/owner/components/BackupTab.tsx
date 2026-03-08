import React, { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/store/AppContext';
import { CURRENCY } from '@/constants';
import {
  Database, Download, FileText, Loader2, CheckCircle2,
  Users, Receipt, Wallet, Activity, AlertTriangle, FileSpreadsheet,
  RotateCcw, UserCog
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
  created_at: string;
  distributor_name: string;
  total_purchases: number;
  total_collections: number;
}

interface BackupInvoiceItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
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
  distributor_name: string;
  items: BackupInvoiceItem[];
  subtotal: number;
}

interface BackupReturnItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface BackupReturn {
  id: string;
  sale_id: string | null;
  customer_name: string;
  reason: string | null;
  total_amount: number;
  created_at: string;
  created_by: string | null;
  distributor_name: string;
  items: BackupReturnItem[];
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
  customer_name: string;
  collector_name: string;
  invoice_remaining: number;
}

interface BackupEmployee {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  employee_type: string | null;
  is_active: boolean;
  created_at: string;
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
  returns: BackupReturn[];
  collections: BackupCollection[];
  employees: BackupEmployee[];
  logs: BackupLogEntry[];
}

type PreviewSection = 'customers' | 'invoices' | 'returns' | 'collections' | 'employees' | 'logs';

// ── Component ────────────────────────────────────────────────────
const BackupTab: React.FC = () => {
  const { organization, users } = useApp();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [backupData, setBackupData] = useState<BackupData | null>(null);
  const [previewSection, setPreviewSection] = useState<PreviewSection>('customers');

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
      const orgId = organization.id;

      // 1. Customers
      setProgress('جاري تحميل بيانات الزبائن...');
      const { data: customersRaw } = await supabase
        .from('customers')
        .select('id, name, phone, location, balance, created_by, created_at')
        .eq('organization_id', orgId)
        .order('name');

      // 2. Sales
      setProgress('جاري تحميل الفواتير...');
      const { data: salesRaw } = await supabase
        .from('sales')
        .select('id, customer_name, customer_id, grand_total, paid_amount, remaining, payment_type, is_voided, void_reason, created_at, created_by, discount_type, discount_percentage, discount_value')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      // 3. Sale Items (batched)
      setProgress('جاري تحميل أصناف الفواتير...');
      const saleIds = (salesRaw || []).map(s => s.id);
      let allSaleItems: any[] = [];
      for (let i = 0; i < saleIds.length; i += 100) {
        const batch = saleIds.slice(i, i + 100);
        const { data: itemsBatch } = await supabase
          .from('sale_items')
          .select('sale_id, product_name, quantity, unit_price, total_price')
          .in('sale_id', batch);
        if (itemsBatch) allSaleItems = [...allSaleItems, ...itemsBatch];
      }

      // 4. Sales Returns
      setProgress('جاري تحميل المرتجعات...');
      const { data: returnsRaw } = await supabase
        .from('sales_returns')
        .select('id, sale_id, customer_name, reason, total_amount, created_at, created_by')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      // 5. Return Items (batched)
      const returnIds = (returnsRaw || []).map(r => r.id);
      let allReturnItems: any[] = [];
      for (let i = 0; i < returnIds.length; i += 100) {
        const batch = returnIds.slice(i, i + 100);
        const { data: itemsBatch } = await supabase
          .from('sales_return_items')
          .select('return_id, product_name, quantity, unit_price, total_price')
          .in('return_id', batch);
        if (itemsBatch) allReturnItems = [...allReturnItems, ...itemsBatch];
      }

      // 6. Collections
      setProgress('جاري تحميل التحصيلات...');
      const { data: collectionsRaw } = await supabase
        .from('collections')
        .select('id, sale_id, amount, notes, is_reversed, reverse_reason, created_at, collected_by')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      // 7. Employees (profiles in same org)
      setProgress('جاري تحميل بيانات الموظفين...');
      const { data: profilesRaw } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, role, employee_type, is_active, created_at')
        .eq('organization_id', orgId)
        .order('created_at');

      // 8. Audit logs + price changes
      setProgress('جاري تحميل سجل العمليات...');
      const { data: auditRaw } = await supabase
        .from('audit_logs')
        .select('action, entity_type, user_id, created_at, details')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(500);

      const { data: priceChangesRaw } = await supabase
        .from('price_change_history')
        .select('product_name, field_changed, old_value, new_value, changed_by_name, created_at')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(200);

      // ── Transform data ──────────────────────────────────────────
      setProgress('جاري تنظيم البيانات...');

      // Sale items grouped
      const itemsBySale: Record<string, BackupInvoiceItem[]> = {};
      allSaleItems.forEach((item: any) => {
        if (!itemsBySale[item.sale_id]) itemsBySale[item.sale_id] = [];
        itemsBySale[item.sale_id].push({
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
          total_price: Number(item.total_price),
        });
      });

      // Return items grouped
      const itemsByReturn: Record<string, BackupReturnItem[]> = {};
      allReturnItems.forEach((item: any) => {
        if (!itemsByReturn[item.return_id]) itemsByReturn[item.return_id] = [];
        itemsByReturn[item.return_id].push({
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
          total_price: Number(item.total_price),
        });
      });

      // Invoices
      const invoices: BackupInvoice[] = (salesRaw || []).map(s => {
        const gt = Number(s.grand_total);
        const dv = Number(s.discount_value || 0);
        return {
          ...s,
          grand_total: gt,
          paid_amount: Number(s.paid_amount),
          remaining: Number(s.remaining),
          discount_percentage: Number(s.discount_percentage || 0),
          discount_value: dv,
          subtotal: gt + dv,
          distributor_name: getUserName(s.created_by),
          items: itemsBySale[s.id] || [],
        };
      });

      // Sale customer map for collections
      const saleCustomerMap: Record<string, string> = {};
      const saleRemainingMap: Record<string, number> = {};
      invoices.forEach(inv => {
        saleCustomerMap[inv.id] = inv.customer_name;
        saleRemainingMap[inv.id] = inv.remaining;
      });

      // Customer aggregates
      const customerTotalPurchases: Record<string, number> = {};
      const customerTotalCollections: Record<string, number> = {};
      invoices.forEach(inv => {
        if (!inv.is_voided) {
          customerTotalPurchases[inv.customer_id] = (customerTotalPurchases[inv.customer_id] || 0) + inv.grand_total;
        }
      });
      (collectionsRaw || []).forEach(c => {
        const custId = invoices.find(inv => inv.id === c.sale_id)?.customer_id;
        if (custId && !c.is_reversed) {
          customerTotalCollections[custId] = (customerTotalCollections[custId] || 0) + Number(c.amount);
        }
      });

      const customers: BackupCustomer[] = (customersRaw || []).map(c => ({
        ...c,
        balance: Number(c.balance),
        distributor_name: getUserName(c.created_by),
        total_purchases: customerTotalPurchases[c.id] || 0,
        total_collections: customerTotalCollections[c.id] || 0,
      }));

      const returns: BackupReturn[] = (returnsRaw || []).map(r => ({
        ...r,
        total_amount: Number(r.total_amount),
        distributor_name: getUserName(r.created_by),
        items: itemsByReturn[r.id] || [],
      }));

      const collections: BackupCollection[] = (collectionsRaw || []).map(c => ({
        ...c,
        amount: Number(c.amount),
        customer_name: saleCustomerMap[c.sale_id] || '—',
        collector_name: getUserName(c.collected_by),
        invoice_remaining: saleRemainingMap[c.sale_id] ?? 0,
      }));

      const employees: BackupEmployee[] = (profilesRaw || []).map(p => ({
        id: p.id,
        full_name: p.full_name || '—',
        email: p.email,
        phone: p.phone,
        role: p.role,
        employee_type: p.employee_type,
        is_active: p.is_active,
        created_at: p.created_at,
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

      setBackupData({
        orgName: organization.name || 'الشركة',
        exportDate: new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        customers,
        invoices,
        returns,
        collections,
        employees,
        logs,
      });

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

      const addHeader = () => {
        pdf.setFillColor(30, 41, 59);
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

        pdf.setFillColor(241, 245, 249);
        pdf.rect(margin, y, contentW, headerH, 'F');
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        let xPos = pageW - margin;
        headers.forEach((h, i) => {
          xPos -= colWidths[i];
          pdf.text(h, xPos + colWidths[i] / 2, y + 5.5, { align: 'center' });
        });
        y += headerH;

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
            const truncated = cell.length > 35 ? cell.slice(0, 33) + '..' : cell;
            pdf.text(truncated, xPos + colWidths[ci] / 2, y + 4.5, { align: 'center' });
          });
          y += rowH;
        });

        pdf.setDrawColor(200, 200, 200);
        pdf.line(margin, y, pageW - margin, y);
        y += 4;
      };

      const addSectionTitle = (title: string) => {
        checkNewPage(16);
        pdf.setFillColor(59, 130, 246);
        pdf.roundedRect(margin, y, contentW, 10, 2, 2, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text(title, pageW - margin - 4, y + 7, { align: 'right' });
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'normal');
        y += 14;
      };

      // ── Cover page ──────────────────────────────────────────────
      addHeader();
      y = pageH / 2 - 30;
      pdf.setFontSize(22);
      pdf.setFont('helvetica', 'bold');
      pdf.text(backupData.orgName, pageW / 2, y, { align: 'center' });
      y += 12;
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Full Operational Data Backup', pageW / 2, y, { align: 'center' });
      y += 8;
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(backupData.exportDate, pageW / 2, y, { align: 'center' });
      y += 14;
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(9);
      const summaryLines = [
        `Customers: ${backupData.customers.length}`,
        `Invoices: ${backupData.invoices.length}`,
        `Sales Returns: ${backupData.returns.length}`,
        `Collections: ${backupData.collections.length}`,
        `Employees: ${backupData.employees.length}`,
        `Activity Logs: ${backupData.logs.length}`,
      ];
      summaryLines.forEach(line => { pdf.text(line, pageW / 2, y, { align: 'center' }); y += 6; });
      addFooter();

      // ── Table 1: Customers ──────────────────────────────────────
      pdf.addPage(); pageNum++;
      addHeader();
      addSectionTitle('Table 1 — Customers Database');
      const custHeaders = ['Total Collections', 'Total Purchases', 'Balance', 'Distributor', 'Location', 'Phone', 'Name', 'ID'];
      const custW = [28, 28, 25, 32, 32, 28, 40, contentW - 213];
      drawTable(custHeaders, backupData.customers.map(c => [
        c.total_collections.toLocaleString(), c.total_purchases.toLocaleString(),
        `${c.balance.toLocaleString()}`, c.distributor_name, c.location || '—',
        c.phone || '—', c.name, c.id.slice(0, 8),
      ]), custW);
      addFooter();

      // ── Table 2: Invoices ───────────────────────────────────────
      pdf.addPage(); pageNum++;
      addHeader();
      addSectionTitle('Table 2 — Sales Invoices');
      const invHeaders = ['Status', 'Net Total', 'Discount', 'Subtotal', 'Type', 'Distributor', 'Date', 'Customer', 'No.'];
      const invW = [18, 25, 22, 25, 16, 32, 28, 40, contentW - 206];
      drawTable(invHeaders, backupData.invoices.map(inv => [
        inv.is_voided ? 'Voided' : 'Active',
        inv.grand_total.toLocaleString(),
        inv.discount_value > 0 ? inv.discount_value.toLocaleString() : '—',
        inv.subtotal.toLocaleString(),
        inv.payment_type === 'CASH' ? 'Cash' : 'Credit',
        inv.distributor_name,
        formatDateShort(inv.created_at),
        inv.customer_name,
        inv.id.slice(0, 8),
      ]), invW);
      addFooter();

      // ── Table 3: Invoice Items ──────────────────────────────────
      const invoicesWithItems = backupData.invoices.filter(inv => inv.items.length > 0);
      if (invoicesWithItems.length > 0) {
        pdf.addPage(); pageNum++;
        addHeader();
        addSectionTitle('Table 3 — Invoice Items Detail');
        const itemHeaders = ['Line Total', 'Unit Price', 'Qty', 'Product'];
        const itemW = [30, 30, 20, contentW - 80];

        invoicesWithItems.forEach(inv => {
          checkNewPage(20);
          pdf.setFontSize(7);
          pdf.setFont('helvetica', 'bold');
          pdf.text(`Invoice: ${inv.id.slice(0, 8)} | ${inv.customer_name} | ${formatDateShort(inv.created_at)}`, pageW - margin, y, { align: 'right' });
          pdf.setFont('helvetica', 'normal');
          y += 5;
          drawTable(itemHeaders, inv.items.map(it => [
            it.total_price.toLocaleString(), it.unit_price.toLocaleString(),
            it.quantity.toString(), it.product_name,
          ]), itemW);
          y += 2;
        });
        addFooter();
      }

      // ── Table 4: Sales Returns ──────────────────────────────────
      if (backupData.returns.length > 0) {
        pdf.addPage(); pageNum++;
        addHeader();
        addSectionTitle('Table 4 — Sales Returns');
        const retHeaders = ['Total', 'Reason', 'Distributor', 'Date', 'Customer', 'Invoice', 'No.'];
        const retW = [25, 40, 32, 28, 38, contentW - 193, 30];
        drawTable(retHeaders, backupData.returns.map(r => [
          r.total_amount.toLocaleString(),
          r.reason || '—',
          r.distributor_name,
          formatDateShort(r.created_at),
          r.customer_name,
          r.sale_id?.slice(0, 8) || '—',
          r.id.slice(0, 8),
        ]), retW);

        // Return items detail
        const returnsWithItems = backupData.returns.filter(r => r.items.length > 0);
        if (returnsWithItems.length > 0) {
          y += 4;
          addSectionTitle('Table 4b — Return Items Detail');
          const riHeaders = ['Total', 'Unit Price', 'Qty', 'Product'];
          const riW = [30, 30, 20, contentW - 80];
          returnsWithItems.forEach(r => {
            checkNewPage(20);
            pdf.setFontSize(7);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`Return: ${r.id.slice(0, 8)} | ${r.customer_name} | ${formatDateShort(r.created_at)}`, pageW - margin, y, { align: 'right' });
            pdf.setFont('helvetica', 'normal');
            y += 5;
            drawTable(riHeaders, r.items.map(it => [
              it.total_price.toLocaleString(), it.unit_price.toLocaleString(),
              it.quantity.toString(), it.product_name,
            ]), riW);
            y += 2;
          });
        }
        addFooter();
      }

      // ── Table 5: Collections ────────────────────────────────────
      pdf.addPage(); pageNum++;
      addHeader();
      addSectionTitle('Table 5 — Collections / Payments');
      const colHeaders = ['Status', 'Remaining', 'Amount', 'Collector', 'Date', 'Customer', 'Invoice'];
      const colW = [20, 25, 25, 32, 28, 40, contentW - 170];
      drawTable(colHeaders, backupData.collections.map(c => [
        c.is_reversed ? 'Reversed' : 'Active',
        c.invoice_remaining.toLocaleString(),
        c.amount.toLocaleString(),
        c.collector_name,
        formatDateShort(c.created_at),
        c.customer_name,
        c.sale_id.slice(0, 8),
      ]), colW);
      addFooter();

      // ── Table 6: Employees ──────────────────────────────────────
      pdf.addPage(); pageNum++;
      addHeader();
      addSectionTitle('Table 6 — Employees');
      const empHeaders = ['Status', 'Joined', 'Role', 'Type', 'Phone', 'Email', 'Name'];
      const empW = [18, 26, 22, 30, 28, 45, contentW - 169];
      drawTable(empHeaders, backupData.employees.map(e => [
        e.is_active ? 'Active' : 'Inactive',
        formatDateShort(e.created_at),
        translateRole(e.role),
        translateEmployeeType(e.employee_type),
        e.phone || '—',
        e.email || '—',
        e.full_name,
      ]), empW);
      addFooter();

      // ── Table 7: Activity Logs ──────────────────────────────────
      pdf.addPage(); pageNum++;
      addHeader();
      addSectionTitle('Table 7 — Operational Activity Log');
      const logHeaders = ['Details', 'Date', 'User', 'Operation'];
      const logW = [contentW - 100, 30, 35, 35];
      drawTable(logHeaders, backupData.logs.slice(0, 500).map(l => [
        l.details, l.date, l.user_name, l.type,
      ]), logW);
      addFooter();

      // ── Save ────────────────────────────────────────────────────
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

  // ── CSV Export ─────────────────────────────────────────────────
  const exportCSV = useCallback(() => {
    if (!backupData) return;

    const sheets: { name: string; headers: string[]; rows: string[][] }[] = [
      {
        name: 'Customers',
        headers: ['ID', 'Name', 'Phone', 'Location', 'Balance', 'Distributor', 'Total Purchases', 'Total Collections'],
        rows: backupData.customers.map(c => [c.id, c.name, c.phone || '', c.location || '', c.balance.toString(), c.distributor_name, c.total_purchases.toString(), c.total_collections.toString()]),
      },
      {
        name: 'Invoices',
        headers: ['ID', 'Customer', 'Date', 'Payment Type', 'Subtotal', 'Discount Type', 'Discount %', 'Discount Value', 'Net Total', 'Paid', 'Remaining', 'Voided', 'Distributor'],
        rows: backupData.invoices.map(inv => [
          inv.id, inv.customer_name, inv.created_at, inv.payment_type,
          inv.subtotal.toString(), inv.discount_type || '', (inv.discount_percentage || 0).toString(),
          (inv.discount_value || 0).toString(), inv.grand_total.toString(),
          inv.paid_amount.toString(), inv.remaining.toString(),
          inv.is_voided ? 'Yes' : 'No', inv.distributor_name,
        ]),
      },
      {
        name: 'Invoice_Items',
        headers: ['Invoice ID', 'Product', 'Qty', 'Unit Price', 'Total'],
        rows: backupData.invoices.flatMap(inv => inv.items.map(it => [
          inv.id, it.product_name, it.quantity.toString(), it.unit_price.toString(), it.total_price.toString(),
        ])),
      },
      {
        name: 'Sales_Returns',
        headers: ['ID', 'Invoice ID', 'Customer', 'Reason', 'Total', 'Distributor', 'Date'],
        rows: backupData.returns.map(r => [
          r.id, r.sale_id || '', r.customer_name, r.reason || '', r.total_amount.toString(), r.distributor_name, r.created_at,
        ]),
      },
      {
        name: 'Return_Items',
        headers: ['Return ID', 'Product', 'Qty', 'Unit Price', 'Total'],
        rows: backupData.returns.flatMap(r => r.items.map(it => [
          r.id, it.product_name, it.quantity.toString(), it.unit_price.toString(), it.total_price.toString(),
        ])),
      },
      {
        name: 'Collections',
        headers: ['ID', 'Invoice ID', 'Customer', 'Amount', 'Date', 'Collector', 'Reversed', 'Notes'],
        rows: backupData.collections.map(c => [
          c.id, c.sale_id, c.customer_name, c.amount.toString(), c.created_at, c.collector_name, c.is_reversed ? 'Yes' : 'No', c.notes || '',
        ]),
      },
      {
        name: 'Employees',
        headers: ['ID', 'Name', 'Email', 'Phone', 'Role', 'Type', 'Active', 'Joined'],
        rows: backupData.employees.map(e => [
          e.id, e.full_name, e.email || '', e.phone || '', e.role, e.employee_type || '', e.is_active ? 'Yes' : 'No', e.created_at,
        ]),
      },
      {
        name: 'Activity_Logs',
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
  const tabs: { id: PreviewSection; label: string; icon: React.ReactNode }[] = [
    { id: 'customers', label: 'الزبائن', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'invoices', label: 'الفواتير', icon: <Receipt className="w-3.5 h-3.5" /> },
    { id: 'returns', label: 'المرتجعات', icon: <RotateCcw className="w-3.5 h-3.5" /> },
    { id: 'collections', label: 'التحصيلات', icon: <Wallet className="w-3.5 h-3.5" /> },
    { id: 'employees', label: 'الموظفين', icon: <UserCog className="w-3.5 h-3.5" /> },
    { id: 'logs', label: 'السجل', icon: <Activity className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header Card */}
      <div className="bg-card p-5 rounded-2xl border shadow-sm text-center">
        <div className="w-14 h-14 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center mb-3">
          <Database className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-lg font-black text-foreground mb-1">مركز النسخ الاحتياطي</h2>
        <p className="text-xs text-muted-foreground mb-4">
          توليد نسخة احتياطية تشغيلية كاملة لجميع بيانات الشركة
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
              توليد النسخة الاحتياطية التشغيلية الكاملة
            </>
          )}
        </button>
      </div>

      {backupData && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-2">
            <SummaryCard icon={<Users className="w-4 h-4" />} label="الزبائن" value={backupData.customers.length} color="blue" />
            <SummaryCard icon={<Receipt className="w-4 h-4" />} label="الفواتير" value={backupData.invoices.length} color="emerald" />
            <SummaryCard icon={<RotateCcw className="w-4 h-4" />} label="المرتجعات" value={backupData.returns.length} color="orange" />
            <SummaryCard icon={<Wallet className="w-4 h-4" />} label="التحصيلات" value={backupData.collections.length} color="amber" />
            <SummaryCard icon={<UserCog className="w-4 h-4" />} label="الموظفين" value={backupData.employees.length} color="purple" />
            <SummaryCard icon={<Activity className="w-4 h-4" />} label="سجل العمليات" value={backupData.logs.length} color="blue" />
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
            <div className="flex border-b border-border overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setPreviewSection(tab.id)}
                  className={`flex-1 min-w-[60px] flex items-center justify-center gap-1 py-2.5 text-[10px] font-bold transition-all whitespace-nowrap ${
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

            <div className="p-3 max-h-[60vh] overflow-y-auto">
              {previewSection === 'customers' && <CustomersPreview data={backupData.customers} />}
              {previewSection === 'invoices' && <InvoicesPreview data={backupData.invoices} />}
              {previewSection === 'returns' && <ReturnsPreview data={backupData.returns} />}
              {previewSection === 'collections' && <CollectionsPreview data={backupData.collections} />}
              {previewSection === 'employees' && <EmployeesPreview data={backupData.employees} />}
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
    orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  };
  return (
    <div className="bg-card p-3 rounded-xl border shadow-sm flex items-center gap-2">
      <div className={`p-2 rounded-lg ${colorMap[color]}`}>{icon}</div>
      <div>
        <p className="text-base font-black text-foreground">{value.toLocaleString()}</p>
        <p className="text-[9px] font-bold text-muted-foreground">{label}</p>
      </div>
    </div>
  );
};

const CustomersPreview: React.FC<{ data: BackupCustomer[] }> = ({ data }) => (
  <div className="space-y-1.5">
    {data.length === 0 && <EmptyState />}
    {data.slice(0, 50).map(c => (
      <div key={c.id} className="bg-muted p-2.5 rounded-xl">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-bold text-foreground">{c.name}</p>
            <p className="text-[9px] text-muted-foreground">{c.phone || '—'} • {c.distributor_name} • {c.location || '—'}</p>
          </div>
          <p className={`text-xs font-black ${c.balance > 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {c.balance.toLocaleString()} {CURRENCY}
          </p>
        </div>
        <div className="flex gap-3 mt-1 text-[9px] text-muted-foreground">
          <span>مشتريات: {c.total_purchases.toLocaleString()}</span>
          <span>تحصيلات: {c.total_collections.toLocaleString()}</span>
        </div>
      </div>
    ))}
    {data.length > 50 && <MoreIndicator count={data.length - 50} label="زبون" />}
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
              {formatDateShort(inv.created_at)} • {inv.payment_type === 'CASH' ? 'نقدي' : 'آجل'} • {inv.distributor_name}
              {inv.is_voided && ' • ملغية'}
            </p>
          </div>
          <div className="text-left">
            <p className="text-xs font-black text-foreground">{inv.grand_total.toLocaleString()} {CURRENCY}</p>
            {inv.discount_value > 0 && (
              <p className="text-[9px] text-amber-600 dark:text-amber-400">
                خصم: {inv.discount_value.toLocaleString()} ({inv.discount_percentage}%)
              </p>
            )}
          </div>
        </div>
        {inv.items.length > 0 && (
          <div className="text-[9px] text-muted-foreground">
            {inv.items.map(it => `${it.product_name} (${it.quantity}×${it.unit_price.toLocaleString()})`).join(' • ')}
          </div>
        )}
      </div>
    ))}
    {data.length > 30 && <MoreIndicator count={data.length - 30} label="فاتورة" />}
  </div>
);

const ReturnsPreview: React.FC<{ data: BackupReturn[] }> = ({ data }) => (
  <div className="space-y-1.5">
    {data.length === 0 && <EmptyState />}
    {data.slice(0, 30).map(r => (
      <div key={r.id} className="bg-muted p-2.5 rounded-xl">
        <div className="flex justify-between items-start mb-1">
          <div>
            <p className="text-xs font-bold text-foreground">{r.customer_name}</p>
            <p className="text-[9px] text-muted-foreground">
              {formatDateShort(r.created_at)} • {r.distributor_name}
              {r.sale_id && ` • فاتورة: ${r.sale_id.slice(0, 8)}`}
            </p>
          </div>
          <p className="text-xs font-black text-orange-600 dark:text-orange-400">
            {r.total_amount.toLocaleString()} {CURRENCY}
          </p>
        </div>
        {r.reason && <p className="text-[9px] text-muted-foreground">السبب: {r.reason}</p>}
        {r.items.length > 0 && (
          <div className="text-[9px] text-muted-foreground mt-0.5">
            {r.items.map(it => `${it.product_name} (${it.quantity})`).join(' • ')}
          </div>
        )}
      </div>
    ))}
    {data.length > 30 && <MoreIndicator count={data.length - 30} label="مرتجع" />}
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
        <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">{c.amount.toLocaleString()} {CURRENCY}</p>
      </div>
    ))}
    {data.length > 30 && <MoreIndicator count={data.length - 30} label="عملية" />}
  </div>
);

const EmployeesPreview: React.FC<{ data: BackupEmployee[] }> = ({ data }) => (
  <div className="space-y-1.5">
    {data.length === 0 && <EmptyState />}
    {data.map(e => (
      <div key={e.id} className={`bg-muted p-2.5 rounded-xl flex justify-between items-center ${!e.is_active ? 'opacity-50' : ''}`}>
        <div>
          <p className="text-xs font-bold text-foreground">{e.full_name}</p>
          <p className="text-[9px] text-muted-foreground">
            {translateRole(e.role)}{e.employee_type ? ` — ${translateEmployeeType(e.employee_type)}` : ''} • {e.email || e.phone || '—'}
          </p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${e.is_active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-destructive/10 text-destructive'}`}>
          {e.is_active ? 'نشط' : 'معطل'}
        </span>
      </div>
    ))}
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
    {data.length > 40 && <MoreIndicator count={data.length - 40} label="سجل" />}
  </div>
);

const EmptyState: React.FC = () => (
  <div className="text-center py-8">
    <AlertTriangle className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
    <p className="text-xs text-muted-foreground">لا توجد بيانات</p>
  </div>
);

const MoreIndicator: React.FC<{ count: number; label: string }> = ({ count, label }) => (
  <p className="text-center text-[10px] text-muted-foreground py-2">+{count} {label} آخر</p>
);

// ── Helpers ──────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return iso; }
}

function formatDateShort(iso: string): string {
  try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }); }
  catch { return iso; }
}

function translateAction(action: string, entity: string): string {
  const map: Record<string, string> = { 'INSERT': 'إضافة', 'UPDATE': 'تعديل', 'DELETE': 'حذف', 'CREATE': 'إنشاء', 'VOID': 'إلغاء', 'REVERSE': 'عكس' };
  const entityMap: Record<string, string> = { 'sale': 'فاتورة', 'collection': 'تحصيل', 'product': 'منتج', 'customer': 'زبون', 'delivery': 'تسليم', 'purchase': 'مشتريات', 'profile': 'حساب', 'license': 'رخصة' };
  return `${map[action] || action} ${entityMap[entity] || entity}`;
}

function translateField(field: string): string {
  const map: Record<string, string> = { 'cost_price': 'سعر التكلفة', 'base_price': 'سعر البيع', 'consumer_price': 'سعر المستهلك' };
  return map[field] || field;
}

function translateRole(role: string): string {
  const map: Record<string, string> = { 'OWNER': 'مالك', 'EMPLOYEE': 'موظف', 'DEVELOPER': 'مطور' };
  return map[role] || role;
}

function translateEmployeeType(type: string | null): string {
  if (!type) return '—';
  const map: Record<string, string> = { 'FIELD_AGENT': 'موزع ميداني', 'ACCOUNTANT': 'محاسب', 'SALES_MANAGER': 'مدير مبيعات', 'WAREHOUSE_KEEPER': 'أمين مستودع' };
  return map[type] || type;
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
