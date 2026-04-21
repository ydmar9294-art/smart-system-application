import React from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw, Plus, Trash2, Check } from 'lucide-react';
import FullScreenModal from '@/components/ui/FullScreenModal';
import { CURRENCY } from '@/constants';
import type { Product } from '@/types';
import type { PurchaseReturnItem } from './types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  purchaseReturnSupplier: string;
  setPurchaseReturnSupplier: (s: string) => void;
  selectedReturnProduct: string;
  onReturnProductChange: (id: string) => void;
  returnItemQty: number;
  setReturnItemQty: (n: number) => void;
  returnItemPrice: string;
  setReturnItemPrice: (s: string) => void;
  addPurchaseReturnItem: () => void;
  removePurchaseReturnItem: (id: string) => void;
  purchaseReturnItems: PurchaseReturnItem[];
  purchaseReturnReason: string;
  setPurchaseReturnReason: (s: string) => void;
  purchaseReturnTotal: number;
  onSubmit: (e: React.FormEvent) => void;
}

export const PurchaseReturnModal: React.FC<Props> = (p) => {
  const { t } = useTranslation();
  return (
    <FullScreenModal
      isOpen={p.isOpen}
      onClose={p.onClose}
      title={t('ownerInventory.purchaseReturn')}
      icon={<RotateCcw size={24} />}
      headerColor="destructive"
      footer={
        <button
          type="button"
          onClick={() => {
            const form = document.getElementById('purchase-return-form') as HTMLFormElement;
            if (form) form.requestSubmit();
          }}
          disabled={p.purchaseReturnItems.length === 0}
          className="w-full bg-destructive text-white font-black py-5 rounded-2xl shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 text-lg flex items-center justify-center gap-2"
        >
          <Check size={22} />
          {t('ownerInventory.confirmReturn')}
        </button>
      }
    >
      <form id="purchase-return-form" onSubmit={p.onSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.supplierOptional')}</label>
          <input
            type="text"
            value={p.purchaseReturnSupplier}
            onChange={(e) => p.setPurchaseReturnSupplier(e.target.value)}
            placeholder={t('ownerInventory.supplierName')}
            className="input-field py-4"
          />
        </div>

        <div className="space-y-3">
          <label className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.addReturnItems')}</label>
          <select
            value={p.selectedReturnProduct}
            onChange={(e) => p.onReturnProductChange(e.target.value)}
            className="input-field py-4"
          >
            <option value="">{t('ownerInventory.selectProductForReturn')}</option>
            {p.products.filter(pr => pr.stock > 0).map(pr => (
              <option key={pr.id} value={pr.id}>{pr.name} ({t('ownerInventory.availableQty')} {pr.stock})</option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground">{t('ownerInventory.quantity')}</label>
              <input
                type="number"
                min="1"
                value={p.returnItemQty}
                onChange={(e) => p.setReturnItemQty(Number(e.target.value))}
                className="input-field text-center text-xl font-black py-4"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground">{t('ownerInventory.unitPrice')}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={p.returnItemPrice}
                onChange={(e) => p.setReturnItemPrice(e.target.value)}
                placeholder="0"
                className="input-field text-center text-xl font-black py-4"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={p.addPurchaseReturnItem}
            disabled={!p.selectedReturnProduct || p.returnItemQty <= 0}
            className="w-full py-4 bg-destructive/10 text-destructive rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            <Plus size={20} /> {t('ownerInventory.addToReturn')}
          </button>
        </div>

        {p.purchaseReturnItems.length > 0 && (
          <div className="space-y-3 bg-muted p-4 rounded-2xl">
            <p className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.returnItems')} ({p.purchaseReturnItems.length}):</p>
            {p.purchaseReturnItems.map((item) => (
              <div key={item.product_id} className="flex justify-between items-center bg-card p-4 rounded-xl">
                <span className="font-bold">{item.product_name}</span>
                <div className="flex items-center gap-3">
                  <span className="bg-destructive/10 text-destructive px-3 py-1.5 rounded-lg font-black text-sm">
                    {item.quantity} × {item.unit_price.toLocaleString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => p.removePurchaseReturnItem(item.product_id)}
                    className="text-destructive p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.returnReason')}</label>
          <input
            type="text"
            value={p.purchaseReturnReason}
            onChange={(e) => p.setPurchaseReturnReason(e.target.value)}
            placeholder={t('ownerInventory.returnReasonPlaceholder')}
            className="input-field py-4"
          />
        </div>

        <div className="bg-destructive/10 p-5 rounded-2xl border border-destructive/20 flex justify-between items-center">
          <span className="font-bold text-muted-foreground">{t('ownerInventory.returnTotal')}</span>
          <span className="text-3xl font-black text-destructive">{p.purchaseReturnTotal.toLocaleString()} {CURRENCY}</span>
        </div>
      </form>
    </FullScreenModal>
  );
};
