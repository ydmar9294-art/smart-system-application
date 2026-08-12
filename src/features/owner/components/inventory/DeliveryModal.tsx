import React from 'react';
import { useTranslation } from 'react-i18next';
import { Truck, Plus, Trash2, Check, AlertTriangle } from 'lucide-react';
import FullScreenModal from '@/components/ui/FullScreenModal';
import type { Product, User as UserT } from '@/types';
import type { DeliveryItem } from './types';
import { formatPackPiece } from './productRules';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  distributors: UserT[];
  selectedDistributorId: string;
  setSelectedDistributorId: (s: string) => void;
  setDistributorName: (s: string) => void;
  selectedDeliveryProduct: string;
  setSelectedDeliveryProduct: (s: string) => void;
  deliveryPackQty: number;
  setDeliveryPackQty: (n: number) => void;
  deliveryPieceQty: number;
  setDeliveryPieceQty: (n: number) => void;
  deliveryError: string;
  deliveryItems: DeliveryItem[];
  addDeliveryItem: () => void;
  removeDeliveryItem: (id: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const numInput = (v: string) => {
  const clean = v.replace(/\D/g, '');
  return clean ? Number(clean) : 0;
};

export const DeliveryModal: React.FC<Props> = (p) => {
  const { t } = useTranslation();
  const selected = p.products.find(pr => pr.id === p.selectedDeliveryProduct);
  const upp = Math.max(1, selected?.unitsPerPack ?? 1);

  return (
    <FullScreenModal
      isOpen={p.isOpen}
      onClose={p.onClose}
      title={t('ownerInventory.deliverToAgent')}
      icon={<Truck size={24} />}
      headerColor="primary"
      footer={
        <button
          type="button"
          onClick={() => {
            const form = document.getElementById('delivery-form') as HTMLFormElement;
            if (form) form.requestSubmit();
          }}
          disabled={p.deliveryItems.length === 0 || !p.selectedDistributorId}
          className="w-full bg-primary text-primary-foreground font-black py-5 rounded-2xl shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 text-lg flex items-center justify-center gap-2"
        >
          <Check size={22} />
          {t('ownerInventory.confirmDelivery')}
        </button>
      }
    >
      <form id="delivery-form" onSubmit={p.onSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.selectDistributor')}</label>
          {p.distributors.length > 0 ? (
            <select
              value={p.selectedDistributorId}
              onChange={(e) => {
                const id = e.target.value;
                p.setSelectedDistributorId(id);
                const d = p.distributors.find(x => x.id === id);
                p.setDistributorName(d?.name || '');
              }}
              required
              className="input-field text-base py-4"
            >
              <option value="">{t('ownerInventory.selectDistributor')}</option>
              {p.distributors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          ) : (
            <div className="bg-muted p-4 rounded-2xl text-sm text-muted-foreground font-bold text-center">
              {t('ownerInventory.noDistributors')}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <label className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.addItems')}</label>
          <select
            value={p.selectedDeliveryProduct}
            onChange={(e) => p.setSelectedDeliveryProduct(e.target.value)}
            className="input-field w-full py-4"
          >
            <option value="">{t('ownerInventory.selectProduct')}</option>
            {p.products.filter(pr => pr.stock > 0).map(pr => (
              <option key={pr.id} value={pr.id}>
                {pr.name} — {formatPackPiece(pr.stock, pr.unitsPerPack ?? 1)}
              </option>
            ))}
          </select>

          {selected && (
            <div className="rounded-xl bg-muted/40 p-3 text-xs font-bold text-muted-foreground text-center">
              العبوة: {upp > 1 ? `${upp} قطعة / طرد` : 'قطعة مفردة (بدون طرد)'} · المتوفر: {formatPackPiece(selected.stock, upp)}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-black text-muted-foreground">عدد الطرود</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                disabled={upp < 2}
                value={p.deliveryPackQty}
                onChange={(e) => p.setDeliveryPackQty(numInput(e.target.value))}
                className="w-full text-center text-xl font-black bg-card border-2 border-primary/30 rounded-xl text-foreground focus:border-primary focus:outline-none py-4 disabled:opacity-50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-black text-muted-foreground">عدد القطع</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={p.deliveryPieceQty}
                onChange={(e) => p.setDeliveryPieceQty(numInput(e.target.value))}
                className="w-full text-center text-xl font-black bg-card border-2 border-primary/30 rounded-xl text-foreground focus:border-primary focus:outline-none py-4"
              />
            </div>
          </div>

          {p.deliveryError && (
            <div className="flex items-start gap-2 text-xs font-bold text-destructive bg-destructive/10 rounded-lg p-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{p.deliveryError}</span>
            </div>
          )}

          <button
            type="button"
            onClick={p.addDeliveryItem}
            className="w-full py-4 bg-primary text-primary-foreground rounded-xl active:scale-[0.98] transition-transform font-black flex items-center justify-center gap-2"
          >
            <Plus size={20} /> إضافة الصنف
          </button>
        </div>

        {p.deliveryItems.length > 0 && (
          <div className="space-y-3 bg-muted p-4 rounded-2xl">
            <p className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.selectedItems')} ({p.deliveryItems.length}):</p>
            {p.deliveryItems.map((item) => (
              <div key={item.product_id} className="flex justify-between items-center bg-card p-4 rounded-xl">
                <span className="font-bold">{item.product_name}</span>
                <div className="flex items-center gap-3">
                  <span className="bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-black text-xs">
                    {formatPackPiece(item.quantity, item.units_per_pack ?? 1)}
                  </span>
                  <button
                    type="button"
                    onClick={() => p.removeDeliveryItem(item.product_id)}
                    className="text-destructive p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </form>
    </FullScreenModal>
  );
};
