import React from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw, Calendar } from 'lucide-react';
import { CURRENCY } from '@/constants';

interface Props {
  purchaseReturns: any[];
  onOpen: () => void;
}

export const PurchaseReturnsView: React.FC<Props> = ({ purchaseReturns, onOpen }) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <button
        onClick={onOpen}
        className="w-full py-4 bg-destructive text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
      >
        <RotateCcw size={18}/> {t('ownerInventory.registerPurchaseReturn')}
      </button>

      <div className="bg-destructive/10 p-4 rounded-2xl border border-destructive/20">
        <p className="text-xs text-destructive font-bold mb-2">{t('ownerInventory.importantWarning')}</p>
        <p className="text-xs text-muted-foreground">
          {t('ownerInventory.purchaseReturnWarning')}
        </p>
      </div>

      {purchaseReturns.length === 0 ? (
        <div className="bg-card p-8 rounded-[2.5rem] border text-center">
          <RotateCcw size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground font-bold">{t('ownerInventory.noPurchaseReturns')}</p>
        </div>
      ) : (
        purchaseReturns.map((ret: any) => (
          <div key={ret.id} className="bg-card p-4 rounded-[1.8rem] border shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-black text-foreground text-sm">{ret.supplier_name || t('ownerInventory.unknownSupplier')}</h3>
                <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                  <Calendar size={10} />
                  {new Date(ret.created_at).toLocaleDateString('ar-EG')}
                </p>
              </div>
              <span className="badge bg-destructive/10 text-destructive text-[9px] px-2 py-1 rounded-lg font-black">
                {Number(ret.total_amount).toLocaleString()} {CURRENCY}
              </span>
            </div>
            {ret.reason && (
              <p className="text-xs text-muted-foreground mt-1">{t('ownerInventory.reason')} {ret.reason}</p>
            )}
          </div>
        ))
      )}
    </div>
  );
};
