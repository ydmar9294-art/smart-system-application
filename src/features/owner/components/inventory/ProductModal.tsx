import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, Box, Layers, AlertTriangle } from 'lucide-react';
import FullScreenModal from '@/components/ui/FullScreenModal';
import type { Product, PricingCurrency, PricingUnit, StockDisplayUnit } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editingProduct: Product | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export const ProductModal: React.FC<Props> = ({ isOpen, onClose, editingProduct, onSubmit }) => {
  const { t } = useTranslation();
  const [pricingCurrency, setPricingCurrency] = useState<PricingCurrency>('SYP');
  const [pricingUnit, setPricingUnit] = useState<PricingUnit>('PIECE');
  const [stockDisplayUnit, setStockDisplayUnit] = useState<StockDisplayUnit>('PIECE');
  const [allowPackSales, setAllowPackSales] = useState(false);
  const [allowPieceSales, setAllowPieceSales] = useState(true);
  const [unitsPerPack, setUnitsPerPack] = useState<number>(1);
  const [basePrice, setBasePrice] = useState<number>(0);
  const [consumerPrice, setConsumerPrice] = useState<number>(0);
  const [packPrice, setPackPrice] = useState<number>(0);
  const [packConsumerPrice, setPackConsumerPrice] = useState<number>(0);

  const stockHasValue = (editingProduct?.stock ?? 0) > 0;
  const lockUnitsPerPack = !!editingProduct && stockHasValue;

  useEffect(() => {
    if (!isOpen) return;
    setPricingCurrency((editingProduct?.pricingCurrency as PricingCurrency) || 'SYP');
    setPricingUnit((editingProduct?.pricingUnit as PricingUnit) || 'PIECE');
    setStockDisplayUnit((editingProduct?.stockDisplayUnit as StockDisplayUnit) || 'PIECE');
    setAllowPackSales(editingProduct?.allowPackSales ?? false);
    setAllowPieceSales(editingProduct?.allowPieceSales ?? true);
    setUnitsPerPack(Math.max(1, editingProduct?.unitsPerPack ?? 1));
    setBasePrice(editingProduct?.basePrice ?? 0);
    setConsumerPrice(editingProduct?.consumerPrice ?? 0);
    setPackPrice(editingProduct?.packPrice ?? ((editingProduct?.basePrice ?? 0) * (editingProduct?.unitsPerPack ?? 1)));
    setPackConsumerPrice(editingProduct?.packConsumerPrice ?? ((editingProduct?.consumerPrice ?? 0) * (editingProduct?.unitsPerPack ?? 1)));
  }, [isOpen, editingProduct]);

  // Auto-sync prices based on pricingUnit
  const derivedPiecePrice = useMemo(() => {
    if (pricingUnit === 'PACK' && unitsPerPack > 0) return packPrice / unitsPerPack;
    return basePrice;
  }, [pricingUnit, packPrice, basePrice, unitsPerPack]);

  const derivedPackPrice = useMemo(() => {
    if (pricingUnit === 'PIECE') return basePrice * Math.max(1, unitsPerPack);
    return packPrice;
  }, [pricingUnit, basePrice, packPrice, unitsPerPack]);

  return (
    <FullScreenModal
      isOpen={isOpen}
      onClose={onClose}
      title={editingProduct ? t('ownerInventory.editProduct') : t('ownerInventory.addNewProduct')}
      icon={<Package size={24} />}
      headerColor="primary"
      footer={
        <button
          type="button"
          onClick={() => {
            const form = document.getElementById('product-form') as HTMLFormElement;
            if (form) form.requestSubmit();
          }}
          className="w-full bg-primary text-primary-foreground font-black py-5 rounded-2xl shadow-lg active:scale-[0.98] transition-all text-lg"
        >
          {editingProduct ? t('ownerInventory.saveChanges') : t('ownerInventory.saveProduct')}
        </button>
      }
    >
      <form id="product-form" onSubmit={onSubmit} className="space-y-5">
        {/* Basic info */}
        <div className="space-y-2">
          <label className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.productName')}</label>
          <input name="name" required defaultValue={editingProduct?.name} placeholder={t('ownerInventory.productName')} className="input-field py-4 text-base" />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.category')}</label>
          <input name="category" defaultValue={editingProduct?.category} placeholder={t('ownerInventory.category')} className="input-field py-4" />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.unitLabel')}</label>
          <input name="unit" defaultValue={editingProduct?.unit ?? t('ownerInventory.piece')} placeholder={t('ownerInventory.piece')} className="input-field py-4" />
        </div>

        {/* ============== الطرد (Pack) settings ============== */}
        <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Box size={18} className="text-primary" />
            <h3 className="font-black text-foreground">إعدادات الطرد (الصندوق)</h3>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">عدد القطع داخل الطرد الواحد</label>
            <input
              name="unitsPerPack"
              type="number"
              min={1}
              step={1}
              required
              value={unitsPerPack}
              onChange={(e) => setUnitsPerPack(Math.max(1, Number(e.target.value) || 1))}
              disabled={lockUnitsPerPack}
              className="input-field py-4 text-center text-xl font-black disabled:opacity-60 disabled:cursor-not-allowed"
            />
            {lockUnitsPerPack && (
              <div className="flex items-start gap-2 text-xs text-warning bg-warning/10 rounded-lg p-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>لا يمكن تغيير عدد القطع/طرد بعد وجود مخزون أو فواتير. يجب تصفير المخزون أولاً.</span>
              </div>
            )}
          </div>

          {/* Sales options */}
          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">السماح بالبيع</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAllowPieceSales(!allowPieceSales)}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${allowPieceSales ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-muted/30 text-muted-foreground'}`}
              >
                <Layers size={16} />
                <span className="text-sm font-black">بالقطعة</span>
              </button>
              <button
                type="button"
                onClick={() => setAllowPackSales(!allowPackSales)}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${allowPackSales ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-muted/30 text-muted-foreground'}`}
              >
                <Box size={16} />
                <span className="text-sm font-black">بالطرد</span>
              </button>
            </div>
            <input type="hidden" name="allowPieceSales" value={allowPieceSales ? '1' : '0'} />
            <input type="hidden" name="allowPackSales" value={allowPackSales ? '1' : '0'} />
          </div>

          {/* Stock display unit */}
          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">عرض المخزون</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { val: 'PIECE', label: 'قطعة' },
                { val: 'PACK', label: 'طرد' },
                { val: 'BOTH', label: 'كلاهما' },
              ] as { val: StockDisplayUnit; label: string }[]).map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setStockDisplayUnit(opt.val)}
                  className={`py-3 rounded-xl border-2 transition-all text-sm font-black ${stockDisplayUnit === opt.val ? 'border-primary bg-primary/10' : 'border-border bg-muted/30 text-muted-foreground'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <input type="hidden" name="stockDisplayUnit" value={stockDisplayUnit} />
          </div>
        </div>

        {/* ============== Currency ============== */}
        <div className="space-y-2">
          <label className="text-xs font-black text-muted-foreground uppercase">عملة التسعير</label>
          <div className="grid grid-cols-2 gap-2">
            {(['SYP', 'USD'] as const).map((cur) => (
              <button
                key={cur}
                type="button"
                onClick={() => setPricingCurrency(cur)}
                className={`relative flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${pricingCurrency === cur ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'}`}
              >
                <span className="text-sm font-black text-foreground">{cur === 'SYP' ? 'ليرة سورية (ل.س)' : 'دولار ($)'}</span>
              </button>
            ))}
          </div>
          <input type="hidden" name="pricingCurrency" value={pricingCurrency} />
        </div>

        {/* ============== Pricing Unit ============== */}
        <div className="space-y-2">
          <label className="text-xs font-black text-muted-foreground uppercase">إدخال السعر بـ</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPricingUnit('PIECE')}
              className={`py-3 rounded-xl border-2 transition-all text-sm font-black ${pricingUnit === 'PIECE' ? 'border-success bg-success/10' : 'border-border bg-muted/30 text-muted-foreground'}`}
            >
              سعر القطعة
            </button>
            <button
              type="button"
              onClick={() => setPricingUnit('PACK')}
              className={`py-3 rounded-xl border-2 transition-all text-sm font-black ${pricingUnit === 'PACK' ? 'border-success bg-success/10' : 'border-border bg-muted/30 text-muted-foreground'}`}
            >
              سعر الطرد
            </button>
          </div>
          <input type="hidden" name="pricingUnit" value={pricingUnit} />
        </div>

        {/* ============== Prices ============== */}
        {pricingUnit === 'PIECE' ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-muted-foreground uppercase">سعر بيع القطعة</label>
                <input
                  name="basePrice"
                  type="number"
                  step="0.01"
                  required
                  value={basePrice}
                  onChange={(e) => setBasePrice(Number(e.target.value) || 0)}
                  className="input-field py-4 text-center text-xl font-black"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-muted-foreground uppercase">سعر القطعة للمستهلك</label>
                <input
                  name="consumerPrice"
                  type="number"
                  step="0.01"
                  value={consumerPrice}
                  onChange={(e) => setConsumerPrice(Number(e.target.value) || 0)}
                  className="input-field py-4 text-center text-xl font-black"
                />
              </div>
            </div>
            <div className="rounded-xl bg-muted/40 p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">سعر الطرد المحسوب تلقائياً ({unitsPerPack} قطعة)</div>
              <div className="text-lg font-black text-success">{derivedPackPrice.toFixed(2)}</div>
            </div>
            <input type="hidden" name="packPrice" value={derivedPackPrice} />
            <input type="hidden" name="packConsumerPrice" value={consumerPrice * Math.max(1, unitsPerPack)} />
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-muted-foreground uppercase">سعر بيع الطرد</label>
                <input
                  name="packPrice"
                  type="number"
                  step="0.01"
                  required
                  value={packPrice}
                  onChange={(e) => setPackPrice(Number(e.target.value) || 0)}
                  className="input-field py-4 text-center text-xl font-black"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-muted-foreground uppercase">سعر الطرد للمستهلك</label>
                <input
                  name="packConsumerPrice"
                  type="number"
                  step="0.01"
                  value={packConsumerPrice}
                  onChange={(e) => setPackConsumerPrice(Number(e.target.value) || 0)}
                  className="input-field py-4 text-center text-xl font-black"
                />
              </div>
            </div>
            <div className="rounded-xl bg-muted/40 p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">سعر القطعة الواحدة المحسوب تلقائياً</div>
              <div className="text-lg font-black text-success">{derivedPiecePrice.toFixed(2)}</div>
            </div>
            <input type="hidden" name="basePrice" value={derivedPiecePrice} />
            <input type="hidden" name="consumerPrice" value={packConsumerPrice / Math.max(1, unitsPerPack)} />
          </>
        )}

        {/* ============== Stock ============== */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">المخزون الحالي (قطع)</label>
            <input name="stock" type="number" defaultValue={editingProduct?.stock ?? 0} className="input-field py-4 text-center text-xl font-black" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">الحد الأدنى (قطع)</label>
            <input name="minStock" type="number" defaultValue={editingProduct?.minStock ?? 5} className="input-field py-4 text-center text-xl font-black" />
          </div>
        </div>
      </form>
    </FullScreenModal>
  );
};
