import React, { useState, useEffect } from 'react';
import { ShoppingCart, Search, Package, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Purchase {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  supplier_name: string | null;
  notes: string | null;
  created_at: string;
}

const PurchasesTab: React.FC = () => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => { loadPurchases(); }, []);

  const loadPurchases = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('purchases').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setPurchases(data || []);
    } catch (error) { console.error('Error loading purchases:', error); }
    finally { setLoading(false); }
  };

  const filteredPurchases = purchases.filter(p => {
    if (searchTerm && !p.product_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        (!p.supplier_name || !p.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()))) return false;
    if (dateFrom && new Date(p.created_at) < new Date(dateFrom)) return false;
    if (dateTo) { const to = new Date(dateTo); to.setHours(23,59,59); if (new Date(p.created_at) > to) return false; }
    return true;
  });

  const totalAmount = filteredPurchases.reduce((sum, p) => sum + Number(p.total_price), 0);

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input type="text" placeholder="بحث بالمنتج أو المورد..." value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-muted border-none rounded-xl px-12 py-3 font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground" />
      </div>

      {/* Date Filters */}
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

      {/* Summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-blue-500/10 rounded-2xl p-4 text-center">
          <p className="text-[9px] text-muted-foreground font-bold">إجمالي المشتريات</p>
          <p className="text-xl font-black text-blue-600 dark:text-blue-400">{totalAmount.toLocaleString('ar-SA')}</p>
          <p className="text-[10px] text-muted-foreground">ل.س</p>
        </div>
        <div className="bg-muted rounded-2xl p-4 text-center">
          <p className="text-[9px] text-muted-foreground font-bold">عدد العمليات</p>
          <p className="text-xl font-black text-foreground">{filteredPurchases.length}</p>
        </div>
      </div>

      {/* Purchases List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
        </div>
      ) : filteredPurchases.length === 0 ? (
        <div className="text-center py-12">
          <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-bold">لا توجد مشتريات</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredPurchases.map((purchase) => (
            <div key={purchase.id} className="bg-card p-4 rounded-2xl shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                    <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{purchase.product_name}</p>
                    <p className="text-xs text-muted-foreground">{purchase.supplier_name || 'بدون مورد'}</p>
                  </div>
                </div>
                <p className="font-black text-blue-600 dark:text-blue-400">{Number(purchase.total_price).toLocaleString('ar-SA')}</p>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{purchase.quantity} × {Number(purchase.unit_price).toLocaleString('ar-SA')}</span>
                <span>{new Date(purchase.created_at).toLocaleDateString('ar-SA')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PurchasesTab;