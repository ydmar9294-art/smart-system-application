import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Truck, Calendar, User, X, Loader2, Check, Ban } from 'lucide-react';

interface Props {
  deliveries: any[];
  onOpen: () => void;
  onCancel?: (deliveryId: string) => Promise<boolean> | void;
}

const STATUS_META: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  pending: { label: 'قيد الاستلام', cls: 'badge-warning', Icon: Truck },
  received: { label: 'تم الاستلام', cls: 'badge-success', Icon: Check },
  completed: { label: 'تم الاستلام', cls: 'badge-success', Icon: Check },
  rejected: { label: 'مرفوض من الموزع', cls: 'badge-danger', Icon: Ban },
  cancelled: { label: 'ملغى', cls: 'badge-danger', Icon: Ban },
};

export const DeliveriesView: React.FC<Props> = ({ deliveries, onOpen, onCancel }) => {
  const { t } = useTranslation();
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleCancel = async (id: string) => {
    if (!onCancel) return;
    setBusyId(id);
    try { await onCancel(id); } finally { setBusyId(null); }
  };

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
        deliveries.map((delivery: any) => {
          const meta = STATUS_META[delivery.status] || STATUS_META.pending;
          const isPending = delivery.status === 'pending';
          return (
            <div key={delivery.id} className="bg-card p-4 rounded-[1.8rem] border shadow-sm space-y-3">
              <div className="flex justify-between items-start">
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
                <span className={`badge text-[9px] ${meta.cls}`}>{meta.label}</span>
              </div>

              {isPending && (
                <>
                  <p className="text-[10px] text-muted-foreground font-bold">
                    البضاعة محجوزة من المستودع الرئيسي بانتظار تأكيد الموزع
                  </p>
                  {onCancel && (
                    <button
                      onClick={() => handleCancel(delivery.id)}
                      disabled={busyId === delivery.id}
                      className="w-full flex items-center justify-center gap-2 bg-destructive/10 text-destructive font-black py-2.5 rounded-xl text-xs active:scale-95 transition-transform disabled:opacity-50"
                    >
                      {busyId === delivery.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                      إلغاء التسليم وإرجاع البضاعة
                    </button>
                  )}
                </>
              )}

              {delivery.status === 'rejected' && delivery.rejection_reason && (
                <p className="text-[10px] text-destructive font-bold">{delivery.rejection_reason}</p>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};
