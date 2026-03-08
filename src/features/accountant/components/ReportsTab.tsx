import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  BarChart3, TrendingUp, TrendingDown, DollarSign,
  ShoppingCart, Wallet, Package, Loader2, Percent
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { CURRENCY } from '@/constants';

const ReportsTab: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
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
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-emerald-500/10 p-4 rounded-2xl">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[9px] text-muted-foreground font-bold">{t('reports.netSales')}</span>
          </div>
          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{netSales.toLocaleString(locale)}</p>
          <p className="text-[9px] text-muted-foreground">{totalSales.toLocaleString()} - {salesReturnsTotal.toLocaleString()}</p>
        </div>

        <div className="bg-blue-500/10 p-4 rounded-2xl">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-[9px] text-muted-foreground font-bold">{t('reports.netPurchases')}</span>
          </div>
          <p className="text-lg font-black text-blue-600 dark:text-blue-400">{netPurchases.toLocaleString(locale)}</p>
          <p className="text-[9px] text-muted-foreground">{purchasesTotal.toLocaleString()} - {purchaseReturnsTotal.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-amber-500/10 p-4 rounded-2xl">
        <div className="flex items-center gap-2 mb-1">
          <Percent className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className="text-[9px] text-muted-foreground font-bold">{t('reports.totalDiscounts')}</span>
        </div>
        <p className="text-lg font-black text-amber-600 dark:text-amber-400">{totalDiscounts.toLocaleString(locale)}</p>
        <p className="text-[9px] text-muted-foreground">
          {t('reports.revenueImpact')}: -{totalSales > 0 ? ((totalDiscounts / (totalSales + totalDiscounts)) * 100).toFixed(1) : 0}%
        </p>
      </div>

      <div className={`p-5 rounded-2xl text-center ${profitOrLoss >= 0 ? 'bg-emerald-500/10' : 'bg-destructive/10'}`}>
        <DollarSign className={`w-8 h-8 mx-auto mb-2 ${profitOrLoss >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`} />
        <p className="text-xs text-muted-foreground font-bold mb-1">{t('reports.profitLoss')}</p>
        <p className={`text-2xl font-black ${profitOrLoss >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
          {profitOrLoss.toLocaleString(locale)} {CURRENCY}
        </p>
        <p className="text-[9px] text-muted-foreground mt-2">
          {t('reports.salesCost')} ({totalSalesCost.toLocaleString()}) + {t('reports.inventoryValue')} ({totalCurrentInventoryValue.toLocaleString()}) − {t('reports.purchases')} ({purchasesTotal.toLocaleString()})
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-card p-3 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="text-[9px] text-muted-foreground font-bold">{t('reports.collections')}</span>
          </div>
          <p className="text-lg font-black text-purple-600 dark:text-purple-400">{collectionsTotal.toLocaleString(locale)}</p>
        </div>
        <div className="bg-card p-3 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-destructive" />
            <span className="text-[9px] text-muted-foreground font-bold">{t('reports.debts')}</span>
          </div>
          <p className="text-lg font-black text-destructive">{totalDebt.toLocaleString(locale)}</p>
        </div>
      </div>

      <div className="bg-card p-4 rounded-2xl shadow-sm space-y-2">
        <h3 className="font-bold text-sm flex items-center gap-2 text-foreground mb-3">
          <Package className="w-4 h-4" /> {t('reports.currentInventoryValue')}
        </h3>
        <div className="flex items-center justify-between p-2.5 bg-muted rounded-xl text-sm">
          <span className="text-muted-foreground">{t('reports.mainWarehouse')}</span>
          <span className="font-bold text-foreground">{mainWarehouseValue.toLocaleString(locale)}</span>
        </div>
        <div className="flex items-center justify-between p-2.5 bg-muted rounded-xl text-sm">
          <span className="text-muted-foreground">{t('reports.distributorWarehouses')}</span>
          <span className="font-bold text-foreground">{distWarehouseValue.toLocaleString(locale)}</span>
        </div>
        <div className="flex items-center justify-between p-3 bg-primary/10 rounded-xl">
          <span className="font-black">{t('common.total')}</span>
          <span className="font-black text-lg text-primary">{totalCurrentInventoryValue.toLocaleString(locale)} {CURRENCY}</span>
        </div>
      </div>

      <div className="bg-card p-4 rounded-2xl shadow-sm space-y-2">
        <h3 className="font-bold text-sm flex items-center gap-2 text-foreground mb-3">
          <BarChart3 className="w-4 h-4" /> {t('reports.financialSummary')}
        </h3>
        
        <div className="flex items-center justify-between p-2.5 bg-muted rounded-xl text-sm">
          <span className="text-muted-foreground">{t('reports.totalSales')}</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">+{totalSales.toLocaleString(locale)}</span>
        </div>
        <div className="flex items-center justify-between p-2.5 bg-muted rounded-xl text-sm">
          <span className="text-muted-foreground">{t('reports.salesCostLabel')}</span>
          <span className="font-bold text-foreground">{totalSalesCost.toLocaleString(locale)}</span>
        </div>
        <div className="flex items-center justify-between p-2.5 bg-amber-500/10 rounded-xl text-sm">
          <span className="text-muted-foreground">{t('reports.totalDiscounts')}</span>
          <span className="font-bold text-amber-600 dark:text-amber-400">-{totalDiscounts.toLocaleString(locale)}</span>
        </div>
        <div className="flex items-center justify-between p-2.5 bg-muted rounded-xl text-sm">
          <span className="text-muted-foreground">{t('reports.salesReturns')}</span>
          <span className="font-bold text-warning">-{salesReturnsTotal.toLocaleString(locale)}</span>
        </div>
        <div className="flex items-center justify-between p-2.5 bg-muted rounded-xl text-sm">
          <span className="text-muted-foreground">{t('reports.totalPurchases')}</span>
          <span className="font-bold text-blue-600 dark:text-blue-400">-{purchasesTotal.toLocaleString(locale)}</span>
        </div>
        <div className="flex items-center justify-between p-2.5 bg-muted rounded-xl text-sm">
          <span className="text-muted-foreground">{t('reports.purchaseReturns')}</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">+{purchaseReturnsTotal.toLocaleString(locale)}</span>
        </div>
        <div className={`flex items-center justify-between p-3 rounded-xl ${profitOrLoss >= 0 ? 'bg-emerald-500/20' : 'bg-destructive/20'}`}>
          <span className="font-black">{t('reports.profitLoss')}</span>
          <span className={`font-black text-lg ${profitOrLoss >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
            {profitOrLoss.toLocaleString(locale)} {CURRENCY}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ReportsTab;
