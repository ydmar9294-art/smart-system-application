import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingCart } from 'lucide-react';
import FullScreenModal from '@/components/ui/FullScreenModal';
import { CURRENCY } from '@/constants';
import type { Product } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  purchaseProduct: string;
  purchaseQty: number;
  purchasePrice: string;
  purchaseSupplier: string;
  setPurchaseQty: (n: number) => void;
  setPurchasePrice: (s: string) => void;
  setPurchaseSupplier: (s: string) => void;
  onProductChange: (id: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const PurchaseModal: React.FC<Props> = ({
  isOpen, onClose, products,
  purchaseProduct, purchaseQty, purchasePrice, purchaseSupplier,
  setPurchaseQty, setPurchasePrice, setPurchaseSupplier,
  onProductChange, onSubmit,
}) => {
  const { t } = useTranslation();
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

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.quantity')}</label>
            <input
              type="number"
              min="1"
              value={purchaseQty}
              onChange={(e) => setPurchaseQty(Number(e.target.value))}
              required
              className="input-field text-center text-xl font-black py-4"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.unitPrice')}</label>
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
        </div>

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
          <span className="font-bold text-muted-foreground">{t('ownerInventory.totalLabel')}</span>
          <span className="text-3xl font-black text-success">{(purchaseQty * Number(purchasePrice)).toLocaleString()} {CURRENCY}</span>
        </div>
      </form>
    </FullScreenModal>
  );
};
