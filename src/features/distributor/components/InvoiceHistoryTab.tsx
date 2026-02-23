import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  RotateCcw,
  Wallet,
  Search,
  Loader2,
  Printer,
  History,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CURRENCY } from '@/constants';
import InvoiceHistoryPrint from './InvoiceHistoryPrint';

interface InvoiceSnapshot {
  id: string;
  invoice_type: 'sale' | 'return' | 'collection';
  invoice_number: string;
  reference_id: string;
  customer_id: string | null;
  customer_name: string;
  created_by: string | null;
  created_by_name: string | null;
  grand_total: number;
  paid_amount: number;
  remaining: number;
  payment_type: 'CASH' | 'CREDIT' | null;
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
  notes: string | null;
  reason: string | null;
  org_name: string | null;
  legal_info: {
    commercial_registration?: string;
    industrial_registration?: string;
    tax_identification?: string;
    trademark_name?: string;
  } | null;
  invoice_date: string;
  created_at: string;
}

type InvoiceFilter = 'all' | 'sale' | 'return' | 'collection';

const InvoiceHistoryTab: React.FC = () => {
  const [invoices, setInvoices] = useState<InvoiceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<InvoiceFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Print state
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceSnapshot | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const fetchInvoices = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('invoice_snapshots')
        .select('*')
        .eq('created_by', user.id)
        .order('invoice_date', { ascending: false })
        .limit(100);

      // Apply type filter
      if (filter !== 'all') {
        query = query.eq('invoice_type', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Map and type JSONB fields properly
      const typedData: InvoiceSnapshot[] = (data || []).map(inv => ({
        id: inv.id,
        invoice_type: inv.invoice_type as 'sale' | 'return' | 'collection',
        invoice_number: inv.invoice_number,
        reference_id: inv.reference_id,
        customer_id: inv.customer_id,
        customer_name: inv.customer_name,
        created_by: inv.created_by,
        created_by_name: inv.created_by_name,
        grand_total: inv.grand_total,
        paid_amount: inv.paid_amount || 0,
        remaining: inv.remaining || 0,
        payment_type: inv.payment_type as 'CASH' | 'CREDIT' | null,
        items: Array.isArray(inv.items) 
          ? (inv.items as unknown as InvoiceSnapshot['items'])
          : [],
        notes: inv.notes,
        reason: inv.reason,
        org_name: inv.org_name,
        legal_info: inv.legal_info && typeof inv.legal_info === 'object' && !Array.isArray(inv.legal_info)
          ? (inv.legal_info as unknown as InvoiceSnapshot['legal_info'])
          : null,
        invoice_date: inv.invoice_date,
        created_at: inv.created_at
      }));
      
      setInvoices(typedData);
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

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
      case 'sale': return 'bg-blue-100 text-blue-700';
      case 'return': return 'bg-orange-100 text-orange-700';
      case 'collection': return 'bg-emerald-100 text-emerald-700';
      default: return 'bg-gray-100 text-gray-700';
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

  const handlePrint = (invoice: InvoiceSnapshot) => {
    setSelectedInvoice(invoice);
    setShowPrintModal(true);
  };

  const closePrintModal = () => {
    setShowPrintModal(false);
    setSelectedInvoice(null);
  };

  // Filter by search query
  const filteredInvoices = invoices.filter(inv => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      inv.customer_name.toLowerCase().includes(query) ||
      inv.invoice_number.toLowerCase().includes(query)
    );
  });

  const filterButtons: { id: InvoiceFilter; label: string; color: string }[] = [
    { id: 'all', label: 'الكل', color: 'bg-gray-600' },
    { id: 'sale', label: 'مبيعات', color: 'bg-blue-600' },
    { id: 'return', label: 'مرتجعات', color: 'bg-orange-500' },
    { id: 'collection', label: 'تحصيلات', color: 'bg-emerald-600' },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Print Modal */}
      {showPrintModal && selectedInvoice && (
        <InvoiceHistoryPrint
          invoice={selectedInvoice}
          onClose={closePrintModal}
        />
      )}

      {/* Header - Same as other tabs */}
      <div className="flex items-center justify-between">
        <h2 className="font-black text-lg flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          سجل الفواتير
        </h2>
        <button
          onClick={() => fetchInvoices(true)}
          disabled={refreshing}
          className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1"
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
            <div 
              key={invoice.id} 
              className="bg-muted rounded-2xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${getTypeColor(invoice.invoice_type)}`}>
                    {getTypeIcon(invoice.invoice_type)}
                    {getTypeName(invoice.invoice_type)}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">{invoice.invoice_number}</span>
                </div>
                <div className="text-left">
                  <p className={`text-lg font-black ${invoice.invoice_type === 'return' ? 'text-orange-600' : 'text-emerald-600'}`}>
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
                  {/* Payment Status for sales */}
                  {invoice.invoice_type === 'sale' && invoice.payment_type && (
                    <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                      invoice.payment_type === 'CASH' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-orange-100 text-orange-700'
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
