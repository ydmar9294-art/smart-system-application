import React from 'react';
import { useTranslation } from 'react-i18next';
import { Package, ShoppingCart, Calendar, User } from 'lucide-react';
import { CURRENCY } from '@/constants';

interface Props {
  purchases: any[];
  onOpen: () => void;
}

export const PurchasesView: React.FC<Props> = ({ purchases, onOpen }) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <button
        onClick={onOpen}
        className="w-full py-4 bg-success text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
      >
        <ShoppingCart size={18}/> {t('ownerInventory.registerPurchase')}
      </button>

      {purchases.length === 0 ? (
        <div className="bg-card p-8 rounded-[2.5rem] border text-center">
          <Package size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground font-bold">{t('ownerInventory.noPurchases')}</p>
        </div>
      ) : (
        purchases.map((purchase) => (
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
              <span className="text-muted-foreground flex items-center gap-1">
                <User size={12} />
                {purchase.supplier_name || t('common.unspecified')}
              </span>
              <span className="font-black text-success">{purchase.total_price.toLocaleString()} {CURRENCY}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
};
