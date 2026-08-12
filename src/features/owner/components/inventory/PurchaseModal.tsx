import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingCart, AlertTriangle } from 'lucide-react';
import FullScreenModal from '@/components/ui/FullScreenModal';
import { CURRENCY } from '@/constants';
import type { Product } from '@/types';
import { formatPackPiece, toPieces } from './productRules';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  purchaseProduct: string;
  purchasePackQty: number;
  purchasePieceQty: number;
  purchasePrice: string;
  purchaseSupplier: string;
  purchaseError: string;
  setPurchasePackQty: (n: number) => void;
  setPurchasePieceQty: (n: number) => void;
  setPurchasePrice: (s: string) => void;
  setPurchaseSupplier: (s: string) => void;
  onProductChange: (id: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const PurchaseModal: React.FC<Props> = ({
  isOpen, onClose, products,
  purchaseProduct, purchasePackQty, purchasePieceQty, purchasePrice, purchaseSupplier, purchaseError,
  setPurchasePackQty, setPurchasePieceQty, setPurchasePrice, setPurchaseSupplier,
  onProductChange, onSubmit,
}) => {
  const { t } = useTranslation();
  const selected = products.find(p => p.id === purchaseProduct);
  const upp = Math.max(1, selected?.unitsPerPack ?? 1);
  const totalPieces = toPieces(purchasePackQty, purchasePieceQty, upp);
  const numInput = (v: string) => { const c = v.replace(/\D/g, ''); return c ? Number(c) : 0; };
  return (
    <FullScreenModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('ownerInventory.purchaseMaterials')}
      icon={<ShoppingCart size={24} />}
      headerColor="success"
      footer={
        <button
          type="button"
          onClick={() => {
            const form = document.getElementById('purchase-form') as HTMLFormElement;
            if (form) form.requestSubmit();
          }}
          className="w-full bg-success text-white font-black py-5 rounded-2xl shadow-lg active:scale-[0.98] transition-all text-lg"
        >
          {t('ownerInventory.confirmPurchase')}
        </button>
      }
    >
      <form id="purchase-form" onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.selectProduct')}</label>
          <select
            value={purchaseProduct}
            onChange={(e) => onProductChange(e.target.value)}
            required
            className="input-field text-base py-4"
          >
            <option value="">{t('ownerInventory.selectProduct')}</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {selected && (
          <div className="rounded-xl bg-muted/40 p-3 text-xs font-bold text-muted-foreground text-center">
            العبوة: {upp > 1 ? `${upp} قطعة / طرد` : 'قطعة مفردة (بدون طرد)'} · الرصيد الحالي: {formatPackPiece(selected.stock, upp)}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">عدد الطرود</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              disabled={upp < 2}
              value={purchasePackQty}
              onChange={(e) => setPurchasePackQty(numInput(e.target.value))}
              className="input-field text-center text-xl font-black py-4 disabled:opacity-50"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">عدد القطع</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={purchasePieceQty}
              onChange={(e) => setPurchasePieceQty(numInput(e.target.value))}
              className="input-field text-center text-xl font-black py-4"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.unitPrice')} (للقطعة)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            placeholder="0"
            required
            className="input-field text-center text-xl font-black py-4"
          />
        </div>

        {purchaseError && (
          <div className="flex items-start gap-2 text-xs font-bold text-destructive bg-destructive/10 rounded-lg p-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>{purchaseError}</span>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.supplierOptional')}</label>
          <input
            type="text"
            value={purchaseSupplier}
            onChange={(e) => setPurchaseSupplier(e.target.value)}
            placeholder={t('ownerInventory.supplierName')}
            className="input-field py-4"
          />
        </div>

        <div className="bg-success/10 p-5 rounded-2xl border border-success/20 flex justify-between items-center">
          <span className="font-bold text-muted-foreground">{t('ownerInventory.totalLabel')} ({formatPackPiece(totalPieces, upp)})</span>
          <span className="text-3xl font-black text-success">{(totalPieces * Number(purchasePrice)).toLocaleString()} {CURRENCY}</span>
        </div>
      </form>
    </FullScreenModal>
  );
};
