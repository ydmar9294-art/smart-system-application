import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/store/AppContext';
import { CURRENCY } from '@/constants';
import {
  Database, Download, FileText, Loader2, CheckCircle2,
  Users, Receipt, Wallet, Activity, AlertTriangle, FileSpreadsheet
} from 'lucide-react';
import { generateBackupPdf, PdfTranslations } from '@/lib/backupPdfService';

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
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const locale = lang === 'ar' ? 'ar-SA' : 'en-US';
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [backupData, setBackupData] = useState<BackupData | null>(null);
  const [previewSection, setPreviewSection] = useState<'customers' | 'invoices' | 'collections' | 'logs'>('customers');

  const userNameMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach(u => { map[u.id] = u.name || u.email || t('backup.pdfUnknown'); });
    return map;
  }, [users, t]);

  const getUserName = useCallback((id: string | null) => {
    if (!id) return '—';
    return userNameMap[id] || id.slice(0, 8);
  }, [userNameMap]);

  // ── Build translations object for PDF service ───────────────
  const getPdfTranslations = useCallback((): PdfTranslations => ({
    pdfFullBackup: t('backup.pdfFullBackup'),
    pdfExportDate: t('backup.pdfExportDate'),
    pdfTotalRevenue: t('backup.pdfTotalRevenue'),
    pdfTotalCollections: t('backup.pdfTotalCollections'),
    pdfTotalRemaining: t('backup.pdfTotalRemaining'),
    pdfTotalDebts: t('backup.pdfTotalDebts'),
    pdfCashCreditVoided: t('backup.pdfCashCreditVoided'),
    pdfCustomerDatabase: t('backup.pdfCustomerDatabase'),
    pdfId: t('backup.pdfId'),
    pdfCustomerName: t('backup.pdfCustomerName'),
    pdfPhone: t('backup.pdfPhone'),
    pdfLocation: t('backup.pdfLocation'),
    pdfDistributor: t('backup.pdfDistributor'),
    pdfBalance: t('backup.pdfBalance'),
    pdfCustomersPage: t('backup.pdfCustomersPage'),
    pdfInvoiceLog: t('backup.pdfInvoiceLog'),
    pdfNumber: t('backup.pdfNumber'),
    pdfCustomer: t('backup.pdfCustomer'),
    pdfDate: t('backup.pdfDate'),
    pdfType: t('backup.pdfType'),
    pdfTotal: t('backup.pdfTotal'),
    pdfDiscount: t('backup.pdfDiscount'),
    pdfNet: t('backup.pdfNet'),
    pdfPaid: t('backup.pdfPaid'),
    pdfRemaining: t('backup.pdfRemaining'),
    pdfInvoicesPage: t('backup.pdfInvoicesPage'),
    pdfInvoiceItemsDetail: t('backup.pdfInvoiceItemsDetail'),
    pdfInvoice: t('backup.pdfInvoice'),
    pdfProduct: t('backup.pdfProduct'),
    pdfQuantity: t('backup.pdfQuantity'),
    pdfUnitPrice: t('backup.pdfUnitPrice'),
    pdfItemTotal: t('backup.pdfItemTotal'),
    pdfItemsPage: t('backup.pdfItemsPage'),
    pdfCollectionLog: t('backup.pdfCollectionLog'),
    pdfInvoiceNumber: t('backup.pdfInvoiceNumber'),
    pdfAmount: t('backup.pdfAmount'),
    pdfCollector: t('backup.pdfCollector'),
    pdfStatus: t('backup.pdfStatus'),
    pdfNotes: t('backup.pdfNotes'),
    pdfCollectionsPage: t('backup.pdfCollectionsPage'),
    pdfActivityLog: t('backup.pdfActivityLog'),
    pdfOperation: t('backup.pdfOperation'),
    pdfUser: t('backup.pdfUser'),
    pdfDetails: t('backup.pdfDetails'),
    pdfLogsPage: t('backup.pdfLogsPage'),
    pdfAdditionalRecords: t('backup.pdfAdditionalRecords'),
    pdfCash: t('backup.pdfCash'),
    pdfCredit: t('backup.pdfCredit'),
    pdfVoided: t('backup.pdfVoided'),
    pdfActive: t('backup.pdfActive'),
    pdfReversed: t('backup.pdfReversed'),
    pdfPreparingDoc: t('backup.pdfPreparingDoc'),
    pdfSavingFile: t('backup.pdfSavingFile'),
    customers: t('backup.customers'),
    invoices: t('backup.invoices'),
    collections: t('backup.collections'),
    activityLog: t('backup.activityLog'),
  }), [t]);

  // ── Fetch all data ──────────────────────────────────────────────
  const generateBackup = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    setBackupData(null);

    try {
      setProgress(t('backup.loadingCustomers'));
      const { data: customersRaw } = await supabase
        .from('customers')
        .select('id, name, phone, location, balance, created_by')
        .eq('organization_id', organization.id)
        .order('name');

      setProgress(t('backup.loadingInvoices'));
      const { data: salesRaw } = await supabase
        .from('sales')
        .select('id, customer_name, customer_id, grand_total, paid_amount, remaining, payment_type, is_voided, void_reason, created_at, created_by, discount_type, discount_percentage, discount_value')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });

      setProgress(t('backup.loadingInvoiceItems'));
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

      setProgress(t('backup.loadingCollections'));
      const { data: collectionsRaw } = await supabase
        .from('collections')
        .select('id, sale_id, amount, notes, is_reversed, reverse_reason, created_at, collected_by')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });

      setProgress(t('backup.loadingLogs'));
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
      setProgress(t('backup.organizingData'));

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
          type: translateAction(a.action, a.entity_type, t),
          user_name: getUserName(a.user_id),
          date: formatDate(a.created_at, locale),
          details: summarizeAuditDetails(a.details as any, a.action, t),
        })),
        ...(priceChangesRaw || []).map(p => ({
          type: t('backup.auditPriceChange'),
          user_name: p.changed_by_name,
          date: formatDate(p.created_at, locale),
          details: `${p.product_name}: ${translateField(p.field_changed, t)} ${t('backup.auditFrom')} ${Number(p.old_value).toLocaleString(locale)} ${t('backup.auditTo')} ${Number(p.new_value).toLocaleString(locale)}`,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const backup: BackupData = {
        orgName: organization.name || t('backup.pdfCompany'),
        exportDate: new Date().toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        customers,
        invoices,
        collections,
        logs,
      };

      setBackupData(backup);
      setProgress('');
    } catch (err) {
      console.error('[Backup] Error:', err);
      setProgress(t('backup.errorGenerating'));
    } finally {
      setLoading(false);
    }
  }, [organization, getUserName, t, locale]);

  // ── PDF Export ─────────────────────────────────────────────────
  const exportPDF = useCallback(async () => {
    if (!backupData) return;
    setLoading(true);
    setProgress(t('backup.creatingPdf'));

    try {
      await generateBackupPdf(backupData, getPdfTranslations(), lang, setProgress);
      setProgress('');
    } catch (err) {
      console.error('[Backup PDF]:', err);
      setProgress(t('backup.errorPdf'));
    } finally {
      setLoading(false);
    }
  }, [backupData, t, lang, getPdfTranslations]);

  // ── Excel CSV Export ───────────────────────────────────────────
  const exportCSV = useCallback(() => {
    if (!backupData) return;

    const sheets: { name: string; headers: string[]; rows: string[][] }[] = [
      {
        name: t('backup.customers'),
        headers: [t('backup.pdfId'), t('backup.pdfCustomerName'), t('backup.pdfPhone'), t('backup.pdfLocation'), t('backup.pdfBalance'), t('backup.pdfDistributor')],
        rows: backupData.customers.map(c => [c.id, c.name, c.phone || '', c.location || '', c.balance.toString(), c.distributor_name || '']),
      },
      {
        name: t('backup.invoices'),
        headers: [t('backup.pdfId'), t('backup.pdfCustomer'), t('backup.pdfDate'), t('backup.csvPaymentType'), t('backup.pdfTotal'), t('backup.csvDiscountType'), t('backup.csvDiscountPercent'), t('backup.csvDiscountValue'), t('backup.pdfNet'), t('backup.pdfPaid'), t('backup.pdfRemaining'), t('backup.csvVoided'), t('backup.pdfDistributor')],
        rows: backupData.invoices.map(inv => [
          inv.id, inv.customer_name, inv.created_at, inv.payment_type === 'CASH' ? t('backup.pdfCash') : t('backup.pdfCredit'),
          (inv.grand_total + inv.discount_value).toString(),
          inv.discount_type || '', (inv.discount_percentage || 0).toString(),
          (inv.discount_value || 0).toString(), inv.grand_total.toString(),
          inv.paid_amount.toString(), inv.remaining.toString(),
          inv.is_voided ? t('backup.csvYes') : t('backup.csvNo'), inv.distributor_name || '',
        ]),
      },
      {
        name: t('backup.collections'),
        headers: [t('backup.pdfId'), t('backup.pdfInvoiceNumber'), t('backup.pdfCustomer'), t('backup.pdfAmount'), t('backup.pdfDate'), t('backup.pdfCollector'), t('backup.csvReversed'), t('backup.pdfNotes')],
        rows: backupData.collections.map(c => [
          c.id, c.sale_id, c.customer_name || '', c.amount.toString(),
          c.created_at, c.collector_name || '', c.is_reversed ? t('backup.csvYes') : t('backup.csvNo'), c.notes || '',
        ]),
      },
      {
        name: t('backup.activityLog'),
        headers: [t('backup.pdfOperation'), t('backup.pdfUser'), t('backup.pdfDate'), t('backup.pdfDetails')],
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
  }, [backupData, t]);

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header Card */}
      <div className="bg-card p-5 rounded-2xl border shadow-sm text-center">
        <div className="w-14 h-14 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center mb-3">
          <Database className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-lg font-black text-foreground mb-1">{t('backup.backupCenter')}</h2>
        <p className="text-xs text-muted-foreground mb-4">
          {t('backup.backupCenterDesc')}
        </p>

        <button
          onClick={generateBackup}
          disabled={loading}
          className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-[0.98]"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {progress || t('backup.generating')}
            </>
          ) : backupData ? (
            <>
              <CheckCircle2 className="w-5 h-5" />
              {t('backup.regenerateBackup')}
            </>
          ) : (
            <>
              <Database className="w-5 h-5" />
              {t('backup.generateFullBackup')}
            </>
          )}
        </button>
      </div>

      {/* Backup Summary & Export */}
      {backupData && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-2">
            <SummaryCard icon={<Users className="w-4 h-4" />} label={t('backup.customers')} value={backupData.customers.length} color="blue" />
            <SummaryCard icon={<Receipt className="w-4 h-4" />} label={t('backup.invoices')} value={backupData.invoices.length} color="emerald" />
            <SummaryCard icon={<Wallet className="w-4 h-4" />} label={t('backup.collections')} value={backupData.collections.length} color="amber" />
            <SummaryCard icon={<Activity className="w-4 h-4" />} label={t('backup.activityLog')} value={backupData.logs.length} color="purple" />
          </div>

          {/* Export Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={exportPDF}
              disabled={loading}
              className="py-3 bg-destructive/10 text-destructive rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-destructive/20 transition-all active:scale-[0.98]"
            >
              <FileText className="w-4 h-4" />
              {t('backup.exportPdfA4')}
            </button>
            <button
              onClick={exportCSV}
              disabled={loading}
              className="py-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-emerald-500/20 transition-all active:scale-[0.98]"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {t('backup.exportExcelCsv')}
            </button>
          </div>

          {/* Preview Navigation */}
          <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
            <div className="flex border-b border-border">
              {([
                { id: 'customers' as const, label: t('backup.customers'), icon: <Users className="w-3.5 h-3.5" /> },
                { id: 'invoices' as const, label: t('backup.invoices'), icon: <Receipt className="w-3.5 h-3.5" /> },
                { id: 'collections' as const, label: t('backup.collections'), icon: <Wallet className="w-3.5 h-3.5" /> },
                { id: 'logs' as const, label: t('backup.logs'), icon: <Activity className="w-3.5 h-3.5" /> },
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
              {previewSection === 'customers' && <CustomersPreview data={backupData.customers} t={t} />}
              {previewSection === 'invoices' && <InvoicesPreview data={backupData.invoices} t={t} lang={lang} />}
              {previewSection === 'collections' && <CollectionsPreview data={backupData.collections} t={t} lang={lang} />}
              {previewSection === 'logs' && <LogsPreview data={backupData.logs} t={t} />}
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

const CustomersPreview: React.FC<{ data: BackupCustomer[]; t: any }> = ({ data, t }) => (
  <div className="space-y-1.5">
    {data.length === 0 && <EmptyState t={t} />}
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
    {data.length > 50 && <p className="text-center text-[10px] text-muted-foreground py-2">+{data.length - 50} {t('backup.moreCustomers')}</p>}
  </div>
);

const InvoicesPreview: React.FC<{ data: BackupInvoice[]; t: any; lang: string }> = ({ data, t, lang }) => (
  <div className="space-y-1.5">
    {data.length === 0 && <EmptyState t={t} />}
    {data.slice(0, 30).map(inv => (
      <div key={inv.id} className={`bg-muted p-2.5 rounded-xl ${inv.is_voided ? 'opacity-50' : ''}`}>
        <div className="flex justify-between items-start mb-1">
          <div>
            <p className="text-xs font-bold text-foreground">{inv.customer_name}</p>
            <p className="text-[9px] text-muted-foreground">
              {formatDateShort(inv.created_at)} • {inv.payment_type === 'CASH' ? t('backup.pdfCash') : t('backup.pdfCredit')}
              {inv.is_voided && ` • ${t('backup.pdfVoided')}`}
            </p>
          </div>
          <div className="text-left">
            <p className="text-xs font-black text-foreground">{inv.grand_total.toLocaleString()} {CURRENCY}</p>
            {inv.discount_value > 0 && (
              <p className="text-[9px] text-amber-600 dark:text-amber-400">{t('backup.pdfDiscount')}: {inv.discount_value.toLocaleString()}</p>
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
    {data.length > 30 && <p className="text-center text-[10px] text-muted-foreground py-2">+{data.length - 30} {t('backup.moreInvoices')}</p>}
  </div>
);

const CollectionsPreview: React.FC<{ data: BackupCollection[]; t: any; lang: string }> = ({ data, t, lang }) => (
  <div className="space-y-1.5">
    {data.length === 0 && <EmptyState t={t} />}
    {data.slice(0, 30).map(c => (
      <div key={c.id} className={`bg-muted p-2.5 rounded-xl flex justify-between items-center ${c.is_reversed ? 'opacity-50' : ''}`}>
        <div>
          <p className="text-xs font-bold text-foreground">{c.customer_name}</p>
          <p className="text-[9px] text-muted-foreground">
            {formatDateShort(c.created_at)} • {c.collector_name}
            {c.is_reversed && ` • ${t('backup.pdfReversed')}`}
          </p>
        </div>
        <p className="text-xs font-black text-success">{c.amount.toLocaleString()} {CURRENCY}</p>
      </div>
    ))}
    {data.length > 30 && <p className="text-center text-[10px] text-muted-foreground py-2">+{data.length - 30} {t('backup.moreOperations')}</p>}
  </div>
);

const LogsPreview: React.FC<{ data: BackupLogEntry[]; t: any }> = ({ data, t }) => (
  <div className="space-y-1.5">
    {data.length === 0 && <EmptyState t={t} />}
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
    {data.length > 40 && <p className="text-center text-[10px] text-muted-foreground py-2">+{data.length - 40} {t('backup.moreLogs')}</p>}
  </div>
);

const EmptyState: React.FC<{ t: any }> = ({ t }) => (
  <div className="text-center py-8">
    <AlertTriangle className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
    <p className="text-xs text-muted-foreground">{t('backup.noData')}</p>
  </div>
);

// ── Helpers ──────────────────────────────────────────────────────

function formatDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return iso; }
}

function formatDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch { return iso; }
}

function translateAction(action: string, entity: string, t: any): string {
  const actionMap: Record<string, string> = {
    'INSERT': t('backup.auditInsert'),
    'UPDATE': t('backup.auditUpdate'),
    'DELETE': t('backup.auditDelete'),
    'CREATE': t('backup.auditCreate'),
    'VOID': t('backup.auditVoid'),
    'REVERSE': t('backup.auditReverse'),
  };
  const entityMap: Record<string, string> = {
    'sale': t('backup.auditSale'),
    'collection': t('backup.auditCollection'),
    'product': t('backup.auditProduct'),
    'customer': t('backup.auditCustomer'),
    'delivery': t('backup.auditDelivery'),
    'purchase': t('backup.auditPurchase'),
    'profile': t('backup.auditProfile'),
    'license': t('backup.auditLicense'),
  };
  return `${actionMap[action] || action} ${entityMap[entity] || entity}`;
}

function translateField(field: string, t: any): string {
  const map: Record<string, string> = {
    'cost_price': t('backup.auditCostPrice'),
    'base_price': t('backup.auditBasePrice'),
    'consumer_price': t('backup.auditConsumerPrice'),
  };
  return map[field] || field;
}

function summarizeAuditDetails(details: any, action: string, t: any): string {
  if (!details) return action;
  if (typeof details === 'string') return details;
  try {
    if (details.customer_name) return `${t('backup.auditCustomerLabel')}: ${details.customer_name}`;
    if (details.product_name) return `${t('backup.auditProductLabel')}: ${details.product_name}`;
    if (details.amount) return `${t('backup.auditAmountLabel')}: ${Number(details.amount).toLocaleString()}`;
    return JSON.stringify(details).slice(0, 60);
  } catch { return action; }
}

export default BackupTab;
