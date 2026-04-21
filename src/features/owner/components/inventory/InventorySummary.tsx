import React from 'react';
import { useTranslation } from 'react-i18next';
import { Package, Box, Truck, AlertTriangle } from 'lucide-react';
import { CURRENCY } from '@/constants';

interface Props {
  warehouseValue: number;
  distValue: number;
  activeCount: number;
  lowStock: number;
}

export const InventorySummary: React.FC<Props> = ({ warehouseValue, distValue, activeCount, lowStock }) => {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="bg-card p-3 rounded-2xl border shadow-sm text-center">
        <Package size={16} className="mx-auto text-primary mb-1" />
        <p className="text-lg font-black text-foreground">{warehouseValue.toLocaleString()}</p>
        <p className="text-[8px] text-muted-foreground font-bold">{t('ownerInventory.warehouseValue') || 'قيمة المستودع'}</p>
        <p className="text-[9px] text-muted-foreground">{CURRENCY}</p>
      </div>
      <div className="bg-card p-3 rounded-2xl border shadow-sm text-center">
        <Truck size={16} className="mx-auto text-blue-600 dark:text-blue-400 mb-1" />
        <p className="text-lg font-black text-foreground">{distValue.toLocaleString()}</p>
        <p className="text-[8px] text-muted-foreground font-bold">{t('ownerInventory.distInventoryValue') || 'مخزون الموزعين'}</p>
        <p className="text-[9px] text-muted-foreground">{CURRENCY}</p>
      </div>
      <div className="bg-card p-3 rounded-2xl border shadow-sm text-center">
        <Box size={16} className="mx-auto text-emerald-600 dark:text-emerald-400 mb-1" />
        <p className="text-lg font-black text-foreground">{activeCount}</p>
        <p className="text-[8px] text-muted-foreground font-bold">{t('ownerInventory.activeProducts') || 'منتجات نشطة'}</p>
      </div>
      <div className="bg-card p-3 rounded-2xl border shadow-sm text-center">
        <AlertTriangle size={16} className={`mx-auto mb-1 ${lowStock > 0 ? 'text-destructive' : 'text-emerald-600'}`} />
        <p className={`text-lg font-black ${lowStock > 0 ? 'text-destructive' : 'text-foreground'}`}>{lowStock}</p>
        <p className="text-[8px] text-muted-foreground font-bold">{t('ownerInventory.lowStockCount') || 'منتجات منخفضة'}</p>
      </div>
    </div>
  );
};
