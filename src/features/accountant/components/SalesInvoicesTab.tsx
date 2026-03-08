import React, { useState, useEffect } from 'react';
import {
  FileText, 
  Search, 
  Eye,
  Ban,
  Printer,
  ChevronDown
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { CURRENCY } from '@/constants';
import { supabase } from '@/integrations/supabase/client';
import InvoicePrint from '@/features/distributor/components/InvoicePrint';
import FullScreenModal from '@/components/ui/FullScreenModal';

const SalesInvoicesTab: React.FC = () => {
  const { sales, products } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'pending' | 'voided'>('all');
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [printInvoice, setPrintInvoice] = useState<any>(null);

  useEffect(() => {
    if (!selectedSaleId) { setSaleItems([]); return; }
    const fetchItems = async () => {
      const { data } = await supabase
        .from('sale_items')
        .select('id,product_id,product_name,quantity,unit_price,total_price')
        .eq('sale_id', selectedSaleId);
      setSaleItems(data || []);
    };
    fetchItems();
  }, [selectedSaleId]);

  const filteredSales = sales.filter(s => {
    if (searchTerm && !s.customerName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (statusFilter === 'paid' && Number(s.remaining) > 0) return false;
    if (statusFilter === 'partial' && (Number(s.remaining) === 0 || Number(s.paidAmount) === 0)) return false;
    if (statusFilter === 'pending' && Number(s.paidAmount) > 0) return false;
    if (statusFilter === 'voided' && !s.isVoided) return false;
    if (statusFilter !== 'all' && statusFilter !== 'voided' && s.isVoided) return false;
    if (dateFrom) { if (new Date(s.timestamp) < new Date(dateFrom)) return false; }
    if (dateTo) { const to = new Date(dateTo); to.setHours(23,59,59); if (new Date(s.timestamp) > to) return false; }
    return true;
  }).sort((a, b) => b.timestamp - a.timestamp);

  const getStatusBadge = (sale: typeof sales[0]) => {
    if (sale.isVoided) return <span className="badge badge-danger">ملغاة</span>;
    if (Number(sale.remaining) === 0) return <span className="badge badge-success">مدفوعة</span>;
    if (Number(sale.paidAmount) > 0) return <span className="badge badge-warning">جزئي</span>;
    return <span className="badge badge-primary">آجل</span>;
  };

  const selectedSale = sales.find(s => s.id === selectedSaleId);

  // Fetch discount data from DB for the selected sale
  const [saleDiscountData, setSaleDiscountData] = useState<{ discount_type: string | null; discount_percentage: number; discount_value: number } | null>(null);

  useEffect(() => {
    if (!selectedSaleId && !printInvoice) { setSaleDiscountData(null); return; }
    const saleId = selectedSaleId || printInvoice?.id;
    if (!saleId) return;
    const fetchDiscount = async () => {
      const { data } = await supabase
        .from('sales')
        .select('discount_type, discount_percentage, discount_value')
        .eq('id', saleId)
        .single();
      setSaleDiscountData(data || null);
    };
    fetchDiscount();
  }, [selectedSaleId, printInvoice]);

  const handlePrint = async (sale: typeof sales[0]) => {
    try {
      const { data } = await supabase
        .from('sale_items')
        .select('id,product_id,product_name,quantity,unit_price,total_price')
        .eq('sale_id', sale.id);
      setSaleItems(data || []);
    } catch (err) {
      console.error('Error fetching sale items for print:', err);
    }
    setPrintInvoice(sale);
  };

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input type="text" placeholder="بحث بالعميل..." value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-muted border-none rounded-xl px-12 py-3 font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground" />
      </div>

      {/* Quick Filters */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {[
          { v: 'all', l: 'الكل' },
          { v: 'paid', l: 'مدفوعة' },
          { v: 'partial', l: 'جزئي' },
          { v: 'pending', l: 'آجل' },
          { v: 'voided', l: 'ملغاة' },
        ].map(f => (
          <button key={f.v} onClick={() => setStatusFilter(f.v as any)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              statusFilter === f.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
            {f.l}
          </button>
        ))}
      </div>

      {/* Date Filters (Collapsible) */}
      <button onClick={() => setShowFilters(!showFilters)}
        className="flex items-center gap-2 text-xs text-muted-foreground font-bold">
        <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        فلترة بالتاريخ
      </button>
      {showFilters && (
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="bg-muted rounded-xl px-3 py-2 text-sm font-medium text-foreground" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="bg-muted rounded-xl px-3 py-2 text-sm font-medium text-foreground" />
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-emerald-500/10 rounded-2xl p-3 text-center">
          <p className="text-[9px] text-muted-foreground font-bold">الإجمالي</p>
          <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
            {(filteredSales.filter(s => !s.isVoided).reduce((sum, s) => sum + Number(s.grandTotal), 0) / 1000).toFixed(0)}K
          </p>
        </div>
        <div className="bg-blue-500/10 rounded-2xl p-3 text-center">
          <p className="text-[9px] text-muted-foreground font-bold">المحصّل</p>
          <p className="text-sm font-black text-blue-600 dark:text-blue-400">
            {(filteredSales.filter(s => !s.isVoided).reduce((sum, s) => sum + Number(s.paidAmount), 0) / 1000).toFixed(0)}K
          </p>
        </div>
        <div className="bg-warning/10 rounded-2xl p-3 text-center">
          <p className="text-[9px] text-muted-foreground font-bold">المتبقي</p>
          <p className="text-sm font-black text-warning">
            {(filteredSales.filter(s => !s.isVoided).reduce((sum, s) => sum + Number(s.remaining), 0) / 1000).toFixed(0)}K
          </p>
        </div>
      </div>

      {/* Sales List (Card Layout for Mobile) */}
      <div className="space-y-2">
        {filteredSales.map((sale) => (
          <div key={sale.id} className={`bg-card p-4 rounded-2xl shadow-sm ${sale.isVoided ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-bold text-foreground">{sale.customerName}</p>
                <p className="text-xs text-muted-foreground">{new Date(sale.timestamp).toLocaleDateString('ar-SA')}</p>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(sale)}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <div>
                <p className="text-[9px] text-muted-foreground">الإجمالي</p>
                <p className="text-sm font-black text-foreground">{Number(sale.grandTotal).toLocaleString('ar-SA')}</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground">المدفوع</p>
                <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{Number(sale.paidAmount).toLocaleString('ar-SA')}</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground">المتبقي</p>
                <p className="text-sm font-black text-warning">{Number(sale.remaining).toLocaleString('ar-SA')}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSelectedSaleId(sale.id)}
                className="flex-1 flex items-center justify-center gap-1.5 bg-muted py-2 rounded-xl text-xs font-bold text-foreground hover:bg-accent transition-colors">
                <Eye className="w-3.5 h-3.5" /> التفاصيل
              </button>
              <button onClick={() => handlePrint(sale)}
                className="flex items-center justify-center gap-1.5 bg-primary/10 text-primary px-4 py-2 rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors">
                <Printer className="w-3.5 h-3.5" /> طباعة
              </button>
            </div>
          </div>
        ))}

        {filteredSales.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-bold">لا توجد فواتير</p>
          </div>
        )}
      </div>

      {/* Sale Details Modal */}
      {selectedSale && (
        <FullScreenModal
          isOpen={true}
          onClose={() => setSelectedSaleId(null)}
          title="تفاصيل الفاتورة"
          icon={<Eye className="w-5 h-5" />}
          headerColor="primary"
          footer={
            <button onClick={() => { handlePrint(selectedSale); setSelectedSaleId(null); }}
              className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl flex items-center justify-center gap-2">
              <Printer className="w-4 h-4" /> طباعة الفاتورة
            </button>
          }
        >
          <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                <span className="text-muted-foreground text-sm">العميل</span>
                <span className="font-bold">{selectedSale.customerName}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                <span className="text-muted-foreground text-sm">التاريخ</span>
                <span className="font-bold text-sm">{new Date(selectedSale.timestamp).toLocaleString('ar-SA')}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-muted p-3 rounded-xl text-center">
                  <p className="text-[9px] text-muted-foreground">الإجمالي</p>
                  <p className="font-black text-foreground">{Number(selectedSale.grandTotal).toLocaleString('ar-SA')}</p>
                </div>
                <div className="bg-emerald-500/10 p-3 rounded-xl text-center">
                  <p className="text-[9px] text-muted-foreground">المدفوع</p>
                  <p className="font-black text-emerald-600 dark:text-emerald-400">{Number(selectedSale.paidAmount).toLocaleString('ar-SA')}</p>
                </div>
                <div className="bg-warning/10 p-3 rounded-xl text-center">
                  <p className="text-[9px] text-muted-foreground">المتبقي</p>
                  <p className="font-black text-warning">{Number(selectedSale.remaining).toLocaleString('ar-SA')}</p>
                </div>
              </div>

              {/* Discount info in detail view */}
              {saleDiscountData && Number(saleDiscountData.discount_value || 0) > 0 && (
                <div className="bg-purple-500/10 p-3 rounded-xl space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">المجموع قبل الخصم</span>
                    <span className="font-bold">{(Number(selectedSale.grandTotal) + Number(saleDiscountData.discount_value)).toLocaleString('ar-SA')} {CURRENCY}</span>
                  </div>
                  <div className="flex justify-between text-sm text-purple-600 dark:text-purple-400">
                    <span>الخصم {saleDiscountData.discount_type === 'percentage' ? `(${Number(saleDiscountData.discount_percentage).toFixed(1)}%)` : ''}</span>
                    <span className="font-bold">-{Number(saleDiscountData.discount_value).toLocaleString('ar-SA')} {CURRENCY}</span>
                  </div>
                </div>
              )}

              {selectedSale.isVoided && (
                <div className="p-3 bg-destructive/10 rounded-xl flex items-center gap-2">
                  <Ban className="w-4 h-4 text-destructive" />
                  <div>
                    <span className="font-bold text-destructive text-sm">فاتورة ملغاة</span>
                    {selectedSale.voidReason && <p className="text-xs text-muted-foreground">{selectedSale.voidReason}</p>}
                  </div>
                </div>
              )}

              {saleItems.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-sm text-foreground">الأصناف</h4>
                  {saleItems.map((item: any) => {
                    const product = products.find(p => p.id === item.product_id);
                    return (
                      <div key={item.id} className="bg-muted p-3 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="font-bold text-sm text-foreground">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} × {Number(item.unit_price).toLocaleString('ar-SA')}
                            {product?.unit ? ` / ${product.unit}` : ''}
                          </p>
                        </div>
                        <p className="font-black text-sm text-foreground">{Number(item.total_price).toLocaleString('ar-SA')} {CURRENCY}</p>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        </FullScreenModal>
      )}

      {/* Print Invoice */}
      {printInvoice && (
        <InvoicePrint
          invoiceType="sale"
          invoiceId={printInvoice.id}
          customerName={printInvoice.customerName}
          date={new Date(printInvoice.timestamp)}
          items={saleItems.map(item => {
            const product = products.find(p => p.id === item.product_id);
            return {
              product_name: item.product_name,
              quantity: item.quantity,
              unit_price: Number(item.unit_price),
              total_price: Number(item.total_price),
              consumer_price: product?.consumerPrice ? Number(product.consumerPrice) : undefined,
              unit: product?.unit,
            };
          })}
          grandTotal={Number(printInvoice.grandTotal)}
          subtotal={saleDiscountData && Number(saleDiscountData.discount_value || 0) > 0 
            ? Number(printInvoice.grandTotal) + Number(saleDiscountData.discount_value) 
            : undefined}
          discountType={saleDiscountData?.discount_type as any}
          discountPercentage={Number(saleDiscountData?.discount_percentage || 0)}
          discountValue={Number(saleDiscountData?.discount_value || 0)}
          paidAmount={Number(printInvoice.paidAmount)}
          remaining={Number(printInvoice.remaining)}
          paymentType={printInvoice.paymentType}
          onClose={() => setPrintInvoice(null)}
        />
      )}
    </div>
  );
};

export default SalesInvoicesTab;