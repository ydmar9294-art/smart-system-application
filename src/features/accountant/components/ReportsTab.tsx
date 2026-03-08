import React, { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, TrendingDown, DollarSign,
  ShoppingCart, Wallet, Package, Loader2, Percent
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { supabase } from '@/integrations/supabase/client';

const ReportsTab: React.FC = () => {
  const { sales, customers, products } = useApp();
  const [purchasesTotal, setPurchasesTotal] = useState(0);
  const [salesReturnsTotal, setSalesReturnsTotal] = useState(0);
  const [purchaseReturnsTotal, setPurchaseReturnsTotal] = useState(0);
  const [collectionsTotal, setCollectionsTotal] = useState(0);
  const [distributorInventory, setDistributorInventory] = useState<any[]>([]);
  const [totalDiscounts, setTotalDiscounts] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pRes, srRes, prRes, cRes, diRes, discRes] = await Promise.all([
        supabase.from('purchases').select('total_price'),
        supabase.from('sales_returns').select('total_amount'),
        supabase.from('purchase_returns').select('total_amount'),
        supabase.from('collections').select('amount, is_reversed').eq('is_reversed', false),
        supabase.from('distributor_inventory').select('product_id, quantity'),
        supabase.from('sales').select('discount_value, is_voided').eq('is_voided', false),
      ]);
      if (pRes.data) setPurchasesTotal(pRes.data.reduce((s, p) => s + Number(p.total_price), 0));
      if (srRes.data) setSalesReturnsTotal(srRes.data.reduce((s, r) => s + Number(r.total_amount), 0));
      if (prRes.data) setPurchaseReturnsTotal(prRes.data.reduce((s, r) => s + Number(r.total_amount), 0));
      if (cRes.data) setCollectionsTotal(cRes.data.reduce((s, c) => s + Number(c.amount), 0));
      if (diRes.data) setDistributorInventory(diRes.data);
      if (discRes.data) setTotalDiscounts(discRes.data.reduce((s, d) => s + Number(d.discount_value || 0), 0));
    } catch (error) { console.error('Error loading report data:', error); }
    finally { setLoading(false); }
  };

  const totalSalesCost = sales.filter(s => !s.isVoided).reduce((sum, sale) => {
    return sum + sale.items.reduce((itemSum, item) => {
      const product = products.find(p => p.id === item.productId);
      const costPrice = product ? product.costPrice : 0;
      return itemSum + (costPrice * item.quantity);
    }, 0);
  }, 0);

  const totalSales = sales.filter(s => !s.isVoided).reduce((sum, s) => sum + Number(s.grandTotal), 0);
  const netSales = totalSales - salesReturnsTotal;
  const netPurchases = purchasesTotal - purchaseReturnsTotal;
  const totalDebt = customers.reduce((sum, c) => sum + Math.max(0, c.balance), 0);

  const mainWarehouseValue = products.filter(p => !p.isDeleted).reduce((s, p) => s + (p.costPrice * p.stock), 0);
  const distWarehouseValue = distributorInventory.reduce((s, item) => {
    const product = products.find(p => p.id === item.product_id);
    return s + (product ? product.costPrice * item.quantity : 0);
  }, 0);
  const totalCurrentInventoryValue = mainWarehouseValue + distWarehouseValue;

  const profitOrLoss = totalSalesCost + totalCurrentInventoryValue - purchasesTotal;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main KPIs */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-emerald-500/10 p-4 rounded-2xl">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[9px] text-muted-foreground font-bold">صافي المبيعات</span>
          </div>
          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{netSales.toLocaleString('ar-SA')}</p>
          <p className="text-[9px] text-muted-foreground">{totalSales.toLocaleString()} - {salesReturnsTotal.toLocaleString()}</p>
        </div>

        <div className="bg-blue-500/10 p-4 rounded-2xl">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-[9px] text-muted-foreground font-bold">صافي المشتريات</span>
          </div>
          <p className="text-lg font-black text-blue-600 dark:text-blue-400">{netPurchases.toLocaleString('ar-SA')}</p>
          <p className="text-[9px] text-muted-foreground">{purchasesTotal.toLocaleString()} - {purchaseReturnsTotal.toLocaleString()}</p>
        </div>
      </div>

      {/* Total Discounts Card */}
      <div className="bg-amber-500/10 p-4 rounded-2xl">
        <div className="flex items-center gap-2 mb-1">
          <Percent className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className="text-[9px] text-muted-foreground font-bold">إجمالي الخصومات</span>
        </div>
        <p className="text-lg font-black text-amber-600 dark:text-amber-400">{totalDiscounts.toLocaleString('ar-SA')}</p>
        <p className="text-[9px] text-muted-foreground">
          التأثير على الإيرادات: -{totalSales > 0 ? ((totalDiscounts / (totalSales + totalDiscounts)) * 100).toFixed(1) : 0}%
        </p>
      </div>

      {/* Profit/Loss */}
      <div className={`p-5 rounded-2xl text-center ${profitOrLoss >= 0 ? 'bg-emerald-500/10' : 'bg-destructive/10'}`}>
        <DollarSign className={`w-8 h-8 mx-auto mb-2 ${profitOrLoss >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`} />
        <p className="text-xs text-muted-foreground font-bold mb-1">الربح / الخسارة</p>
        <p className={`text-2xl font-black ${profitOrLoss >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
          {profitOrLoss.toLocaleString('ar-SA')} ل.س
        </p>
        <p className="text-[9px] text-muted-foreground mt-2">
          تكلفة المبيعات ({totalSalesCost.toLocaleString()}) + قيمة المخزون ({totalCurrentInventoryValue.toLocaleString()}) − المشتريات ({purchasesTotal.toLocaleString()})
        </p>
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-card p-3 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="text-[9px] text-muted-foreground font-bold">التحصيلات</span>
          </div>
          <p className="text-lg font-black text-purple-600 dark:text-purple-400">{collectionsTotal.toLocaleString('ar-SA')}</p>
        </div>
        <div className="bg-card p-3 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-destructive" />
            <span className="text-[9px] text-muted-foreground font-bold">الديون</span>
          </div>
          <p className="text-lg font-black text-destructive">{totalDebt.toLocaleString('ar-SA')}</p>
        </div>
      </div>

      {/* Inventory Value Breakdown */}
      <div className="bg-card p-4 rounded-2xl shadow-sm space-y-2">
        <h3 className="font-bold text-sm flex items-center gap-2 text-foreground mb-3">
          <Package className="w-4 h-4" /> قيمة المخزون الحالي
        </h3>
        <div className="flex items-center justify-between p-2.5 bg-muted rounded-xl text-sm">
          <span className="text-muted-foreground">المخزن الرئيسي</span>
          <span className="font-bold text-foreground">{mainWarehouseValue.toLocaleString('ar-SA')}</span>
        </div>
        <div className="flex items-center justify-between p-2.5 bg-muted rounded-xl text-sm">
          <span className="text-muted-foreground">مخازن الموزعين</span>
          <span className="font-bold text-foreground">{distWarehouseValue.toLocaleString('ar-SA')}</span>
        </div>
        <div className="flex items-center justify-between p-3 bg-primary/10 rounded-xl">
          <span className="font-black">الإجمالي</span>
          <span className="font-black text-lg text-primary">{totalCurrentInventoryValue.toLocaleString('ar-SA')} ل.س</span>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-card p-4 rounded-2xl shadow-sm space-y-2">
        <h3 className="font-bold text-sm flex items-center gap-2 text-foreground mb-3">
          <BarChart3 className="w-4 h-4" /> ملخص الحركة المالية
        </h3>
        
        <div className="flex items-center justify-between p-2.5 bg-muted rounded-xl text-sm">
          <span className="text-muted-foreground">إجمالي المبيعات</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">+{totalSales.toLocaleString('ar-SA')}</span>
        </div>
        <div className="flex items-center justify-between p-2.5 bg-muted rounded-xl text-sm">
          <span className="text-muted-foreground">تكلفة المبيعات</span>
          <span className="font-bold text-foreground">{totalSalesCost.toLocaleString('ar-SA')}</span>
        </div>
        <div className="flex items-center justify-between p-2.5 bg-amber-500/10 rounded-xl text-sm">
          <span className="text-muted-foreground">إجمالي الخصومات</span>
          <span className="font-bold text-amber-600 dark:text-amber-400">-{totalDiscounts.toLocaleString('ar-SA')}</span>
        </div>
        <div className="flex items-center justify-between p-2.5 bg-muted rounded-xl text-sm">
          <span className="text-muted-foreground">مرتجعات المبيعات</span>
          <span className="font-bold text-warning">-{salesReturnsTotal.toLocaleString('ar-SA')}</span>
        </div>
        <div className="flex items-center justify-between p-2.5 bg-muted rounded-xl text-sm">
          <span className="text-muted-foreground">إجمالي المشتريات</span>
          <span className="font-bold text-blue-600 dark:text-blue-400">-{purchasesTotal.toLocaleString('ar-SA')}</span>
        </div>
        <div className="flex items-center justify-between p-2.5 bg-muted rounded-xl text-sm">
          <span className="text-muted-foreground">مرتجعات المشتريات</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">+{purchaseReturnsTotal.toLocaleString('ar-SA')}</span>
        </div>
        <div className={`flex items-center justify-between p-3 rounded-xl ${profitOrLoss >= 0 ? 'bg-emerald-500/20' : 'bg-destructive/20'}`}>
          <span className="font-black">الربح / الخسارة</span>
          <span className={`font-black text-lg ${profitOrLoss >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
            {profitOrLoss.toLocaleString('ar-SA')} ل.س
          </span>
        </div>
      </div>
    </div>
  );
};

export default ReportsTab;
