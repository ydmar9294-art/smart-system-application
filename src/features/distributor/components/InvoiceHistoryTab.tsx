import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  RotateCcw,
  Wallet,
  Search,
  Loader2,
  Printer,
  History,
  RefreshCw,
  WifiOff,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CURRENCY } from '@/constants';
import InvoiceHistoryPrint from './InvoiceHistoryPrint';
import {
  cacheInvoices,
  getCachedInvoices,
  type CachedInvoice,
} from '../services/distributorOfflineService';

type InvoiceFilter = 'all' | 'sale' | 'return' | 'collection';

interface InvoiceHistoryTabProps {
  isOnline: boolean;
}

const InvoiceHistoryTab: React.FC<InvoiceHistoryTabProps> = ({ isOnline }) => {
  const [invoices, setInvoices] = useState<CachedInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<InvoiceFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<CachedInvoice | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const loadedFromCache = useRef(false);

  // Load from IndexedDB first, then background-refresh from server
  const loadInvoices = useCallback(async (isRefresh = false) => {
    // On first load, show cached data immediately (includes locally-created invoices)
    if (!loadedFromCache.current) {
      try {
        const cached = await getCachedInvoices();
        if (cached.length > 0) {
          // Sort: newest first
          cached.sort((a, b) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime());
          setInvoices(cached);
          setLoading(false);
          loadedFromCache.current = true;
        }
      } catch { /* IndexedDB not available */ }
    }

    if (isRefresh) setRefreshing(true);

    if (!navigator.onLine) {
      // Even if offline, ensure we load from cache if not loaded yet
      if (!loadedFromCache.current) {
        try {
          const cached = await getCachedInvoices();
          cached.sort((a, b) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime());
          setInvoices(cached);
          loadedFromCache.current = true;
        } catch { /* ignore */ }
      }
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); setRefreshing(false); return; }

      const results: CachedInvoice[] = [];

      // Fetch org info + legal info for all invoices
      let orgName: string | null = null;
      let legalInfo: any = null;
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
      if (profile?.organization_id) {
        const [orgRes, legalRes] = await Promise.all([
          supabase.from('organizations').select('name').eq('id', profile.organization_id).single(),
          supabase.from('organization_legal_info')
            .select('commercial_registration, industrial_registration, tax_identification, trademark_name, stamp_url')
            .eq('organization_id', profile.organization_id).maybeSingle()
        ]);
        orgName = orgRes.data?.name || null;
        legalInfo = legalRes.data || null;
      }

      // Fetch sales
      const { data: sales } = await supabase
        .from('sales')
        .select('id, customer_id, customer_name, grand_total, paid_amount, remaining, payment_type, created_by, created_at, is_voided')
        .eq('created_by', user.id)
        .eq('is_voided', false)
        .order('created_at', { ascending: false })
        .limit(50);

      if (sales && sales.length > 0) {
        const saleIds = sales.map(s => s.id);
        const { data: saleItems } = await supabase
          .from('sale_items')
          .select('sale_id, product_id, product_name, quantity, unit_price, total_price')
          .in('sale_id', saleIds);

        const itemsBySale = new Map<string, CachedInvoice['items']>();
        (saleItems || []).forEach(item => {
          const list = itemsBySale.get(item.sale_id) || [];
          list.push({ product_id: item.product_id, product_name: item.product_name, quantity: item.quantity, unit_price: item.unit_price, total_price: item.total_price });
          itemsBySale.set(item.sale_id, list);
        });

        sales.forEach((sale, i) => {
          results.push({
            id: sale.id, invoice_type: 'sale',
            invoice_number: `INV-${String(i + 1).padStart(4, '0')}`,
            reference_id: sale.id, customer_id: sale.customer_id,
            customer_name: sale.customer_name, created_by: sale.created_by,
            created_by_name: null, grand_total: sale.grand_total,
            paid_amount: sale.paid_amount, remaining: sale.remaining,
            payment_type: sale.payment_type as 'CASH' | 'CREDIT',
            items: itemsBySale.get(sale.id) || [],
            notes: null, reason: null, org_name: orgName, legal_info: legalInfo,
            invoice_date: sale.created_at, created_at: sale.created_at,
          });
        });
      }

      // Fetch returns
      const { data: returns } = await supabase
        .from('sales_returns')
        .select('id, sale_id, customer_name, total_amount, reason, created_by, created_at')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (returns && returns.length > 0) {
        const returnIds = returns.map(r => r.id);
        const { data: returnItems } = await supabase
          .from('sales_return_items')
          .select('return_id, product_name, quantity, unit_price, total_price')
          .in('return_id', returnIds);

        const itemsByReturn = new Map<string, CachedInvoice['items']>();
        (returnItems || []).forEach(item => {
          const list = itemsByReturn.get(item.return_id) || [];
          list.push({ product_name: item.product_name, quantity: item.quantity, unit_price: item.unit_price, total_price: item.total_price });
          itemsByReturn.set(item.return_id, list);
        });

        returns.forEach((ret, i) => {
          results.push({
            id: ret.id, invoice_type: 'return',
            invoice_number: `RET-${String(i + 1).padStart(4, '0')}`,
            reference_id: ret.id, customer_id: null,
            customer_name: ret.customer_name, created_by: ret.created_by,
            created_by_name: null, grand_total: ret.total_amount,
            paid_amount: 0, remaining: 0, payment_type: null,
            items: itemsByReturn.get(ret.id) || [],
            notes: null, reason: ret.reason, org_name: orgName, legal_info: legalInfo,
            invoice_date: ret.created_at, created_at: ret.created_at,
          });
        });
      }

      // Fetch collections
      const { data: collections } = await supabase
        .from('collections')
        .select('id, sale_id, amount, notes, collected_by, created_at, is_reversed')
        .eq('collected_by', user.id)
        .eq('is_reversed', false)
        .order('created_at', { ascending: false })
        .limit(50);

      if (collections && collections.length > 0) {
        const collSaleIds = [...new Set(collections.map(c => c.sale_id))];
        const { data: collSales } = await supabase
          .from('sales')
          .select('id, customer_name')
          .in('id', collSaleIds);

        const saleNameMap = new Map<string, string>();
        (collSales || []).forEach(s => saleNameMap.set(s.id, s.customer_name));

        collections.forEach((col, i) => {
          results.push({
            id: col.id, invoice_type: 'collection',
            invoice_number: `COL-${String(i + 1).padStart(4, '0')}`,
            reference_id: col.sale_id, customer_id: null,
            customer_name: saleNameMap.get(col.sale_id) || 'غير معروف',
            created_by: col.collected_by, created_by_name: null,
            grand_total: col.amount, paid_amount: col.amount,
            remaining: 0, payment_type: 'CASH',
            items: [], notes: col.notes, reason: null,
            org_name: orgName, legal_info: legalInfo,
            invoice_date: col.created_at, created_at: col.created_at,
          });
        });
      }

      results.sort((a, b) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime());
      setInvoices(results);
      
      // Cache for offline use
      try { await cacheInvoices(results); } catch { /* ignore */ }
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'sale': return <FileText className="w-4 h-4" />;
      case 'return': return <RotateCcw className="w-4 h-4" />;
      case 'collection': return <Wallet className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'sale': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'return': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      case 'collection': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'sale': return 'بيع';
      case 'return': return 'مرتجع';
      case 'collection': return 'قبض';
      default: return 'مستند';
    }
  };

  const handlePrint = (invoice: CachedInvoice) => {
    setSelectedInvoice(invoice);
    setShowPrintModal(true);
  };

  const closePrintModal = () => {
    setShowPrintModal(false);
    setSelectedInvoice(null);
  };

  // Apply filters locally
  const filteredInvoices = invoices
    .filter(inv => filter === 'all' || inv.invoice_type === filter)
    .filter(inv => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return inv.customer_name.toLowerCase().includes(query) || inv.invoice_number.toLowerCase().includes(query);
    });

  const filterButtons: { id: InvoiceFilter; label: string; color: string }[] = [
    { id: 'all', label: 'الكل', color: 'bg-gray-600' },
    { id: 'sale', label: 'مبيعات', color: 'bg-blue-600' },
    { id: 'return', label: 'مرتجعات', color: 'bg-orange-500' },
    { id: 'collection', label: 'تحصيلات', color: 'bg-emerald-600' },
  ];

  return (
    <div className="p-4 space-y-4">
      {showPrintModal && selectedInvoice && (
        <InvoiceHistoryPrint invoice={selectedInvoice} onClose={closePrintModal} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-black text-lg flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          سجل الفواتير
          {!isOnline && <WifiOff className="w-4 h-4 text-amber-500" />}
        </h2>
        <button
          onClick={() => loadInvoices(true)}
          disabled={refreshing || !isOnline}
          className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="بحث بالعميل أو رقم الفاتورة..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-muted border-none rounded-2xl px-12 py-4 font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2">
        {filterButtons.map((btn) => (
          <button
            key={btn.id}
            onClick={() => setFilter(btn.id)}
            className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all ${
              filter === btn.id
                ? `${btn.color} text-white shadow-md`
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Invoice List */}
      {loading ? (
        <div className="text-center py-16">
          <Loader2 className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4 animate-spin" />
          <p className="text-muted-foreground font-bold">جارٍ تحميل السجل...</p>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="text-center py-16">
          <History className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-bold">لا توجد فواتير</p>
          <p className="text-muted-foreground/70 text-sm mt-2">
            سيظهر هنا سجل فواتيرك عند إنشائها
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredInvoices.map((invoice) => (
            <div key={invoice.id} className="bg-muted rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${getTypeColor(invoice.invoice_type)}`}>
                    {getTypeIcon(invoice.invoice_type)}
                    {getTypeName(invoice.invoice_type)}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">{invoice.invoice_number}</span>
                  {(invoice as any).isLocal && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      <WifiOff className="w-3 h-3" /> محلي
                    </span>
                  )}
                </div>
                <div className="text-left">
                  <p className={`text-lg font-black ${invoice.invoice_type === 'return' ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {invoice.invoice_type === 'return' ? '-' : ''}{Number(invoice.grand_total).toLocaleString('ar-SA')}
                  </p>
                  <p className="text-xs text-muted-foreground">{CURRENCY}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-foreground">{invoice.customer_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(invoice.invoice_date).toLocaleDateString('ar-SA')}
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  {invoice.invoice_type === 'sale' && invoice.payment_type && (
                    <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                      invoice.payment_type === 'CASH' 
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                        : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    }`}>
                      {invoice.payment_type === 'CASH' ? 'نقداً' : 'آجل'}
                    </span>
                  )}
                  
                  <button
                    onClick={() => handlePrint(invoice)}
                    className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors"
                  >
                    <Printer className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InvoiceHistoryTab;
