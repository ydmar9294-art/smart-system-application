import React from 'react';
import { useTranslation } from 'react-i18next';
import { Package } from 'lucide-react';
import FullScreenModal from '@/components/ui/FullScreenModal';
import type { Product } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editingProduct: Product | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export const ProductModal: React.FC<Props> = ({ isOpen, onClose, editingProduct, onSubmit }) => {
  const { t } = useTranslation();
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
        <div className="space-y-2">
          <label className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.productName')}</label>
          <input
            name="name"
            required
            defaultValue={editingProduct?.name}
            placeholder={t('ownerInventory.productName')}
            className="input-field py-4 text-base"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.category')}</label>
          <input
            name="category"
            defaultValue={editingProduct?.category}
            placeholder={t('ownerInventory.category')}
            className="input-field py-4"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-muted-foreground uppercase">عملة التسعير</label>
          <div className="grid grid-cols-2 gap-2">
            {(['SYP', 'USD'] as const).map((cur) => {
              const isSelected = (editingProduct?.pricingCurrency || 'SYP') === cur;
              return (
                <label key={cur} className={`relative flex items-center justify-center gap-2 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                  isSelected ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'
                }`}>
                  <input
                    type="radio"
                    name="pricingCurrency"
                    value={cur}
                    defaultChecked={isSelected}
                    className="sr-only"
                  />
                  <span className="text-sm font-black text-foreground">
                    {cur === 'SYP' ? 'ليرة سورية (ل.س)' : 'دولار ($)'}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.salePrice')}</label>
            <input
              name="basePrice"
              type="number"
              step="0.01"
              required
              defaultValue={editingProduct?.basePrice}
              placeholder="0"
              className="input-field py-4 text-center text-xl font-black"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.consumerPrice')}</label>
            <input
              name="consumerPrice"
              type="number"
              step="0.01"
              defaultValue={editingProduct?.consumerPrice ?? 0}
              placeholder="0"
              className="input-field py-4 text-center text-xl font-black"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.currentStock')}</label>
            <input
              name="stock"
              type="number"
              defaultValue={editingProduct?.stock ?? 0}
              className="input-field py-4 text-center text-xl font-black"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.minStock')}</label>
            <input
              name="minStock"
              type="number"
              defaultValue={editingProduct?.minStock ?? 5}
              className="input-field py-4 text-center text-xl font-black"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-muted-foreground uppercase">{t('ownerInventory.unitLabel')}</label>
          <input
            name="unit"
            defaultValue={editingProduct?.unit ?? t('ownerInventory.piece')}
            placeholder={t('ownerInventory.piece')}
            className="input-field py-4"
          />
        </div>
      </form>
    </FullScreenModal>
  );
};
