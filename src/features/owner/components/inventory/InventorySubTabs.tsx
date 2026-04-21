import React from 'react';
import { useTranslation } from 'react-i18next';
import { Package, ShoppingCart, RotateCcw, Truck } from 'lucide-react';
import type { InventorySubTab } from './types';

interface Props {
  subTab: InventorySubTab;
  onChange: (t: InventorySubTab) => void;
}

export const InventorySubTabs: React.FC<Props> = ({ subTab, onChange }) => {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-4 gap-1 bg-muted p-1.5 rounded-2xl">
      <button
        onClick={() => onChange('products')}
        className={`py-2.5 rounded-xl font-black text-[10px] flex items-center justify-center gap-1 transition-all ${subTab === 'products' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
      >
        <Package size={12} /> {t('ownerInventory.products')}
      </button>
      <button
        onClick={() => onChange('purchases')}
        className={`py-2.5 rounded-xl font-black text-[10px] flex items-center justify-center gap-1 transition-all ${subTab === 'purchases' ? 'bg-card shadow-sm text-success' : 'text-muted-foreground'}`}
      >
        <ShoppingCart size={12} /> {t('ownerInventory.purchases')}
      </button>
      <button
        onClick={() => onChange('purchase-returns')}
        className={`py-2.5 rounded-xl font-black text-[10px] flex items-center justify-center gap-1 transition-all ${subTab === 'purchase-returns' ? 'bg-card shadow-sm text-destructive' : 'text-muted-foreground'}`}
      >
        <RotateCcw size={12} /> {t('ownerInventory.purchaseReturns')}
      </button>
      <button
        onClick={() => onChange('deliveries')}
        className={`py-2.5 rounded-xl font-black text-[10px] flex items-center justify-center gap-1 transition-all ${subTab === 'deliveries' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground'}`}
      >
        <Truck size={12} /> {t('ownerInventory.deliveries')}
      </button>
    </div>
  );
};
