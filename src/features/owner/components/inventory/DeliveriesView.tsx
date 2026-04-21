import React from 'react';
import { useTranslation } from 'react-i18next';
import { Truck, Calendar, User } from 'lucide-react';

interface Props {
  deliveries: any[];
  onOpen: () => void;
}

export const DeliveriesView: React.FC<Props> = ({ deliveries, onOpen }) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <button
        onClick={onOpen}
        className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
      >
        <Truck size={18}/> {t('ownerInventory.deliverToDistributor')}
      </button>

      {deliveries.length === 0 ? (
        <div className="bg-card p-8 rounded-[2.5rem] border text-center">
          <Truck size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground font-bold">{t('ownerInventory.noDeliveries')}</p>
        </div>
      ) : (
        deliveries.map((delivery: any) => (
          <div key={delivery.id} className="bg-card p-4 rounded-[1.8rem] border shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-black text-foreground text-sm flex items-center gap-1">
                  <User size={14} className="text-primary" />
                  {delivery.distributor_name}
                </h3>
                <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                  <Calendar size={10} />
                  {new Date(delivery.created_at).toLocaleDateString('ar-EG')}
                </p>
              </div>
              <span className={`badge text-[9px] ${delivery.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                {delivery.status === 'completed' ? t('ownerInventory.completed') : t('common.pending')}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
};
