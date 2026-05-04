import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, ShoppingCart, Calendar, User, FileText, X, Filter } from 'lucide-react';
import { CURRENCY } from '@/constants';
import FullScreenModal from '@/components/ui/FullScreenModal';

interface Props {
  purchases: any[];
  onOpen: () => void;
}

export const PurchasesView: React.FC<Props> = ({ purchases, onOpen }) => {
  const { t } = useTranslation();
  const [supplierFilter, setSupplierFilter] = useState<string>('');
  const [showStatement, setShowStatement] = useState(false);

  const suppliers = useMemo(() => {
    const set = new Set<string>();
    for (const p of purchases) {
      if (p.supplier_name && String(p.supplier_name).trim()) set.add(String(p.supplier_name).trim());
    }
    return Array.from(set).sort();
  }, [purchases]);

  const filtered = useMemo(() => {
    if (!supplierFilter) return purchases;
    return purchases.filter(p => (p.supplier_name || '').trim() === supplierFilter);
  }, [purchases, supplierFilter]);

  const totalForFilter = useMemo(
    () => filtered.reduce((s, p) => s + Number(p.total_price || 0), 0),
    [filtered]
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onOpen}
          className="py-4 bg-success text-white rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
        >
          <ShoppingCart size={16}/> {t('ownerInventory.registerPurchase')}
        </button>
        <button
          onClick={() => setShowStatement(true)}
          disabled={suppliers.length === 0}
          className="py-4 bg-primary text-primary-foreground rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all disabled:opacity-50"
        >
          <FileText size={16}/> كشف حساب مورد
        </button>
      </div>

      {supplierFilter && (
        <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-xl px-3 py-2">
          <span className="text-xs font-black text-foreground flex items-center gap-1">
            <Filter size={12}/> مورد: {supplierFilter}
          </span>
          <button onClick={() => setSupplierFilter('')} className="text-destructive p-1">
            <X size={14}/>
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-card p-8 rounded-[2.5rem] border text-center">
          <Package size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground font-bold">{t('ownerInventory.noPurchases')}</p>
        </div>
      ) : (
        filtered.map((purchase) => (
          <div key={purchase.id} className="bg-card p-4 rounded-[1.8rem] border shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-black text-foreground text-sm">{purchase.product_name}</h3>
                <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                  <Calendar size={10} />
                  {new Date(purchase.created_at).toLocaleDateString('ar-EG')}
                </p>
              </div>
              <span className="badge badge-success text-[9px]">{purchase.quantity} {t('ownerInventory.unit')}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <button
                type="button"
                onClick={() => purchase.supplier_name && setSupplierFilter(String(purchase.supplier_name).trim())}
                className="text-muted-foreground flex items-center gap-1 hover:text-primary"
              >
                <User size={12} />
                {purchase.supplier_name || t('common.unspecified')}
              </button>
              <span className="font-black text-success">{Number(purchase.total_price).toLocaleString()} {CURRENCY}</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              سعر الوحدة: <span className="font-black text-foreground">{Number(purchase.unit_price).toLocaleString()} {CURRENCY}</span>
            </div>
          </div>
        ))
      )}

      {/* Supplier Statement Modal */}
      <FullScreenModal
        isOpen={showStatement}
        onClose={() => setShowStatement(false)}
        title="كشف حساب مورد"
        icon={<FileText size={22}/>}
        headerColor="primary"
      >
        <div className="space-y-3">
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="input-field py-4"
          >
            <option value="">— اختر المورد —</option>
            {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {supplierFilter && (
            <>
              <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 text-center">
                <p className="text-xs font-bold text-muted-foreground">إجمالي مشتريات هذا المورد</p>
                <p className="text-2xl font-black text-primary mt-1">{totalForFilter.toLocaleString()} {CURRENCY}</p>
                <p className="text-[10px] text-muted-foreground mt-1">عدد الفواتير: {filtered.length}</p>
              </div>

              <div className="space-y-2">
                {filtered.map(p => (
                  <div key={p.id} className="bg-card p-3 rounded-xl border flex justify-between items-center">
                    <div>
                      <p className="font-black text-sm">{p.product_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString('ar-EG')} · {p.quantity} × {Number(p.unit_price).toLocaleString()}
                      </p>
                    </div>
                    <span className="font-black text-success text-sm">{Number(p.total_price).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowStatement(false)}
                className="w-full py-3 bg-primary text-primary-foreground rounded-2xl font-black text-sm"
              >
                عرض في القائمة الرئيسية
              </button>
            </>
          )}
        </div>
      </FullScreenModal>
    </div>
  );
};
