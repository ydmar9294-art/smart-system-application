import React from 'react';
import { useTranslation } from 'react-i18next';
import { Truck, Plus, Trash2, Check } from 'lucide-react';
import FullScreenModal from '@/components/ui/FullScreenModal';
import type { Product, User as UserT } from '@/types';
import type { DeliveryItem } from './types';

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
  deliveryItemQty: number;
  setDeliveryItemQty: (n: number) => void;
  deliveryItems: DeliveryItem[];
  addDeliveryItem: () => void;
  removeDeliveryItem: (id: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const DeliveryModal: React.FC<Props> = (p) => {
  const { t } = useTranslation();
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
          <div className="flex gap-3">
            <select
              value={p.selectedDeliveryProduct}
              onChange={(e) => p.setSelectedDeliveryProduct(e.target.value)}
              className="input-field flex-1 py-4"
            >
              <option value="">{t('ownerInventory.selectProduct')}</option>
              {p.products.filter(pr => pr.stock > 0).map(pr => (
                <option key={pr.id} value={pr.id}>{pr.name} ({pr.stock})</option>
              ))}
            </select>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={p.deliveryItemQty}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                p.setDeliveryItemQty(val ? Number(val) : 1);
              }}
              className="w-20 text-center text-xl font-black bg-card border-2 border-primary/30 rounded-xl text-foreground focus:border-primary focus:outline-none py-4"
            />
            <button
              type="button"
              onClick={p.addDeliveryItem}
              className="px-5 bg-primary text-primary-foreground rounded-xl active:scale-95 transition-transform"
            >
              <Plus size={22} />
            </button>
          </div>
        </div>

        {p.deliveryItems.length > 0 && (
          <div className="space-y-3 bg-muted p-4 rounded-2xl">
            <p className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.selectedItems')} ({p.deliveryItems.length}):</p>
            {p.deliveryItems.map((item) => (
              <div key={item.product_id} className="flex justify-between items-center bg-card p-4 rounded-xl">
                <span className="font-bold">{item.product_name}</span>
                <div className="flex items-center gap-3">
                  <span className="bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-black">{item.quantity}</span>
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
