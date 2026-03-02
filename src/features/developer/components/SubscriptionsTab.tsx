/**
 * SubscriptionsTab - Developer subscription management
 * View/approve/reject payment requests with full details
 */
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/store/AppContext';
import { License, SubscriptionPayment } from '@/types';
import { CURRENCY } from '@/constants';
import {
  CreditCard, CheckCircle2, XCircle, Clock, Eye,
  DollarSign, Calendar, Loader2, RefreshCw, Image as ImageIcon,
  X, Plus, AlertTriangle, Bell, User, Building2
} from 'lucide-react';

const DURATION_OPTIONS = [
  { months: 1, label: 'شهر واحد' },
  { months: 3, label: '3 أشهر' },
  { months: 6, label: '6 أشهر' },
  { months: 12, label: 'سنة كاملة' },
];

const SubscriptionsTab: React.FC = () => {
  const { licenses, refreshLicenses } = useApp();
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [viewReceiptUrl, setViewReceiptUrl] = useState<string | null>(null);
  const [showFirstSubModal, setShowFirstSubModal] = useState<License | null>(null);
  const [showRenewModal, setShowRenewModal] = useState<License | null>(null);
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [firstSubDuration, setFirstSubDuration] = useState(1);
  const [firstSubPrice, setFirstSubPrice] = useState(0);
  const [renewDuration, setRenewDuration] = useState(1);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('subscription_payments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPayments((data || []).map(p => ({
        id: p.id,
        organizationId: p.organization_id,
        licenseId: p.license_id,
        amount: Number(p.amount),
        durationMonths: p.duration_months,
        status: p.status as any,
        submittedBy: p.submitted_by,
        submittedByRole: p.submitted_by_role,
        receiptUrl: p.receipt_url || undefined,
        rejectionReason: p.rejection_reason || undefined,
        reviewedBy: p.reviewed_by || undefined,
        reviewedAt: p.reviewed_at || undefined,
        subscriptionStart: p.subscription_start || undefined,
        subscriptionEnd: p.subscription_end || undefined,
        isFirstSubscription: p.is_first_subscription || false,
        deviceId: p.device_id || undefined,
        createdAt: new Date(p.created_at).getTime(),
      })));
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const handleApprove = async (paymentId: string) => {
    if (processingId) return;
    setProcessingId(paymentId);
    try {
      const { data, error } = await supabase.rpc('approve_subscription_payment', { p_payment_id: paymentId });
      if (error) throw error;
      const result = data as any;
      if (result && result.success === false) {
        alert(result.message || 'فشلت العملية');
        return;
      }
      await Promise.all([fetchPayments(), refreshLicenses()]);
    } catch (err: any) {
      alert(err.message || 'فشلت العملية');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal || processingId) return;
    setProcessingId(rejectModal);
    try {
      const { data, error } = await supabase.rpc('reject_subscription_payment', {
        p_payment_id: rejectModal,
        p_reason: rejectReason || 'لم يتم التحقق من الحوالة'
      });
      if (error) throw error;
      const result = data as any;
      if (result && result.success === false) {
        alert(result.message || 'فشلت العملية');
        return;
      }
      setRejectModal(null);
      setRejectReason('');
      await fetchPayments();
    } catch (err: any) {
      alert(err.message || 'فشلت العملية');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCreateFirstSub = async () => {
    if (!showFirstSubModal || processingId) return;
    setProcessingId('first-sub');
    try {
      const { data, error } = await supabase.rpc('create_first_subscription', {
        p_license_id: showFirstSubModal.id,
        p_duration_months: firstSubDuration,
        p_monthly_price: firstSubPrice > 0 ? firstSubPrice : null
      });
      if (error) throw error;
      setShowFirstSubModal(null);
      await Promise.all([fetchPayments(), refreshLicenses()]);
    } catch (err: any) {
      alert(err.message || 'فشلت العملية');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDevRenew = async () => {
    if (!showRenewModal || processingId) return;
    setProcessingId('dev-renew');
    try {
      const { data, error } = await supabase.rpc('developer_renew_subscription', {
        p_license_id: showRenewModal.id,
        p_duration_months: renewDuration
      });
      if (error) throw error;
      setShowRenewModal(null);
      await Promise.all([fetchPayments(), refreshLicenses()]);
    } catch (err: any) {
      alert(err.message || 'فشلت العملية');
    } finally {
      setProcessingId(null);
    }
  };

  const getLicenseForPayment = (licenseId: string) => licenses.find(l => l.id === licenseId);

  const filteredPayments = filter === 'ALL' ? payments : payments.filter(p => p.status === filter);
  const pendingCount = payments.filter(p => p.status === 'PENDING').length;

  const eligibleForFirstSub = licenses.filter(l =>
    l.type === 'TRIAL' && l.status === 'ACTIVE'
  );

  return (
    <div className="space-y-4">
      {/* Pending Payments Alert */}
      {pendingCount > 0 && (
        <div className="bg-warning/10 border border-warning/30 p-4 rounded-2xl flex items-center gap-3 animate-fade-in">
          <div className="w-10 h-10 bg-warning/20 rounded-xl flex items-center justify-center shrink-0">
            <Bell size={20} className="text-warning animate-pulse" />
          </div>
          <div>
            <p className="font-black text-foreground text-sm">
              {pendingCount} طلب{pendingCount > 1 ? 'ات' : ''} تجديد بانتظار المراجعة
            </p>
            <p className="text-[10px] text-muted-foreground">اضغط على "معلّق" لعرض الطلبات المعلّقة</p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {eligibleForFirstSub.length > 0 && (
        <div className="card-elevated p-4">
          <h3 className="font-black text-foreground text-sm mb-3 flex items-center gap-2">
            <Plus size={16} className="text-primary" /> إنشاء اشتراك أول
          </h3>
          <div className="space-y-2">
            {eligibleForFirstSub.map(lic => (
              <button key={lic.id} onClick={() => { setShowFirstSubModal(lic); setFirstSubPrice(lic.monthlyPrice || 0); }}
                className="w-full flex items-center justify-between bg-primary/10 hover:bg-primary/20 p-3 rounded-2xl transition-all">
                <span className="font-bold text-sm text-foreground">{lic.orgName}</span>
                <span className="text-xs font-bold text-primary">إنشاء اشتراك ←</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Developer Renew */}
      {licenses.filter(l => l.type === 'SUBSCRIPTION').length > 0 && (
        <div className="card-elevated p-4">
          <h3 className="font-black text-foreground text-sm mb-3 flex items-center gap-2">
            <RefreshCw size={16} className="text-primary" /> تجديد اشتراك (مطور)
          </h3>
          <div className="space-y-2">
            {licenses.filter(l => l.status === 'ACTIVE' || l.status === 'EXPIRED').map(lic => (
              <button key={lic.id} onClick={() => setShowRenewModal(lic)}
                className="w-full flex items-center justify-between bg-muted hover:bg-accent p-3 rounded-2xl transition-all">
                <div className="text-start">
                  <span className="font-bold text-sm text-foreground block">{lic.orgName}</span>
                  {lic.expiryDate && (
                    <span className="text-[10px] text-muted-foreground">
                      ينتهي: {new Date(lic.expiryDate).toLocaleDateString('ar-EG')}
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold text-primary">تجديد ←</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {([
          { key: 'ALL', label: 'الكل', count: payments.length },
          { key: 'PENDING', label: 'معلّق', count: pendingCount },
          { key: 'APPROVED', label: 'مقبول', count: payments.filter(p => p.status === 'APPROVED').length },
          { key: 'REJECTED', label: 'مرفوض', count: payments.filter(p => p.status === 'REJECTED').length },
        ] as const).map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              filter === f.key ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground'
            } ${f.key === 'PENDING' && pendingCount > 0 && filter !== 'PENDING' ? 'ring-2 ring-warning/50' : ''}`}>
            {f.label} {f.count > 0 && <span className="opacity-70">({f.count})</span>}
          </button>
        ))}
      </div>

      {/* Payments List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
          <p className="text-sm font-bold">جارٍ التحميل...</p>
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-bold">لا توجد طلبات دفع</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPayments.map(payment => {
            const license = getLicenseForPayment(payment.licenseId);
            return (
              <div key={payment.id} className={`card-elevated p-4 transition-all ${
                payment.status === 'PENDING' ? 'ring-2 ring-warning/30' : ''
              }`}>
                {/* Header */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-black text-foreground text-sm flex items-center gap-1.5">
                      <Building2 size={14} className="text-primary" />
                      {license?.orgName || 'منشأة'}
                    </h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(payment.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`badge ${
                    payment.status === 'PENDING' ? 'bg-warning/20 text-warning' :
                    payment.status === 'APPROVED' ? 'badge-success' : 'badge-danger'
                  }`}>
                    {payment.status === 'PENDING' ? '⏳ معلّق' : payment.status === 'APPROVED' ? '✅ مقبول' : '❌ مرفوض'}
                  </span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div className="bg-muted p-2.5 rounded-xl">
                    <span className="text-muted-foreground block text-[10px]">المبلغ</span>
                    <p className="font-black text-foreground">{payment.amount.toLocaleString()} {CURRENCY}</p>
                  </div>
                  <div className="bg-muted p-2.5 rounded-xl">
                    <span className="text-muted-foreground block text-[10px]">المدة</span>
                    <p className="font-black text-foreground">{payment.durationMonths} شهر</p>
                  </div>
                </div>

                {/* Extra Info */}
                <div className="space-y-1 mb-3">
                  {payment.isFirstSubscription && (
                    <p className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-1 rounded-lg inline-block">⭐ اشتراك أول</p>
                  )}
                  {payment.submittedByRole && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <User size={10} /> مقدّم من: {payment.submittedByRole === 'OWNER' ? 'المالك' : payment.submittedByRole}
                    </p>
                  )}
                  {payment.subscriptionEnd && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar size={10} /> فترة: {new Date(payment.subscriptionStart!).toLocaleDateString('ar-EG')} → {new Date(payment.subscriptionEnd).toLocaleDateString('ar-EG')}
                    </p>
                  )}
                  {license?.monthlyPrice && license.monthlyPrice > 0 && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <DollarSign size={10} /> سعر الشهر: {license.monthlyPrice.toLocaleString()} {CURRENCY}
                    </p>
                  )}
                </div>

                {payment.rejectionReason && (
                  <div className="bg-destructive/10 p-2 rounded-xl mb-3">
                    <p className="text-[10px] text-destructive font-bold">❌ سبب الرفض: {payment.rejectionReason}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  {payment.receiptUrl && (
                    <button onClick={() => setViewReceiptUrl(payment.receiptUrl!)}
                      className="flex-1 py-2.5 bg-muted hover:bg-accent rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all">
                      <ImageIcon size={14} /> عرض الحوالة
                    </button>
                  )}
                  {payment.status === 'PENDING' && (
                    <>
                      <button onClick={() => handleApprove(payment.id)} disabled={!!processingId}
                        className="flex-1 py-2.5 btn-success text-xs flex items-center justify-center gap-1">
                        {processingId === payment.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        موافقة
                      </button>
                      <button onClick={() => { setRejectModal(payment.id); setRejectReason(''); }} disabled={!!processingId}
                        className="flex-1 py-2.5 btn-danger text-xs flex items-center justify-center gap-1">
                        <XCircle size={14} /> رفض
                      </button>
                    </>
                  )}
                  {payment.status === 'PENDING' && !payment.receiptUrl && (
                    <div className="flex-1 py-2.5 bg-warning/10 rounded-xl text-[10px] font-bold text-warning flex items-center justify-center gap-1">
                      <AlertTriangle size={12} /> بدون صورة حوالة
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Receipt Viewer Modal */}
      {viewReceiptUrl && createPortal(
        <div className="modal-overlay safe-area-x safe-area-bottom" dir="rtl" onClick={() => setViewReceiptUrl(null)}>
          <div className="card-elevated w-full max-w-md p-4 space-y-4 animate-zoom-in mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="font-black text-foreground">صورة الحوالة</h3>
              <button onClick={() => setViewReceiptUrl(null)} className="p-2 rounded-full hover:bg-muted"><X size={18} /></button>
            </div>
            <img src={viewReceiptUrl} alt="صورة الحوالة" className="w-full rounded-2xl border border-border" />
          </div>
        </div>,
        document.body
      )}

      {/* Reject Modal */}
      {rejectModal && createPortal(
        <div className="modal-overlay safe-area-x safe-area-bottom" dir="rtl">
          <div className="card-elevated w-full max-w-md p-5 space-y-4 animate-zoom-in mx-4">
            <h3 className="font-black text-foreground">سبب الرفض</h3>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="اكتب سبب رفض الحوالة..." rows={3}
              className="input-field w-full resize-none" />
            <div className="flex gap-2">
              <button onClick={handleReject} disabled={!!processingId}
                className="flex-1 btn-danger py-3 text-sm font-bold flex items-center justify-center gap-1">
                {processingId ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} تأكيد الرفض
              </button>
              <button onClick={() => setRejectModal(null)} className="flex-1 btn-secondary py-3 text-sm">إلغاء</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* First Subscription Modal */}
      {showFirstSubModal && createPortal(
        <div className="modal-overlay safe-area-x safe-area-bottom" dir="rtl">
          <div className="card-elevated w-full max-w-md p-5 space-y-5 animate-zoom-in mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-black text-foreground text-lg">إنشاء اشتراك أول</h3>
            <p className="text-sm text-muted-foreground">المنشأة: <span className="font-bold text-foreground">{showFirstSubModal.orgName}</span></p>

            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">سعر الشهر ({CURRENCY})</label>
              <input type="number" min={0} value={firstSubPrice} onChange={e => setFirstSubPrice(Number(e.target.value))}
                className="input-field w-full" placeholder="0" />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">مدة الاشتراك</label>
              <div className="grid grid-cols-2 gap-2">
                {DURATION_OPTIONS.map(opt => (
                  <button key={opt.months} onClick={() => setFirstSubDuration(opt.months)}
                    className={`py-3 rounded-2xl text-sm font-bold transition-all ${
                      firstSubDuration === opt.months ? 'bg-primary text-primary-foreground shadow-lg' : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-primary/10 p-4 rounded-2xl text-center">
              <p className="text-xs text-muted-foreground mb-1">التكلفة الإجمالية</p>
              <p className="text-2xl font-black text-primary">
                {(firstSubPrice * firstSubDuration).toLocaleString()} <span className="text-sm">{CURRENCY}</span>
              </p>
            </div>

            <div className="flex gap-2">
              <button onClick={handleCreateFirstSub} disabled={!!processingId}
                className="flex-1 btn-primary py-3.5 text-sm font-bold flex items-center justify-center gap-1">
                {processingId === 'first-sub' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                إنشاء الاشتراك
              </button>
              <button onClick={() => setShowFirstSubModal(null)} className="flex-1 btn-secondary py-3.5 text-sm">إلغاء</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Developer Renew Modal */}
      {showRenewModal && createPortal(
        <div className="modal-overlay safe-area-x safe-area-bottom" dir="rtl">
          <div className="card-elevated w-full max-w-md p-5 space-y-5 animate-zoom-in mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-black text-foreground text-lg">تجديد اشتراك (مطور)</h3>
            <p className="text-sm text-muted-foreground">المنشأة: <span className="font-bold text-foreground">{showRenewModal.orgName}</span></p>
            {showRenewModal.expiryDate && (
              <p className="text-xs text-muted-foreground">
                ينتهي حالياً: <span className="font-bold text-foreground">{new Date(showRenewModal.expiryDate).toLocaleDateString('ar-EG')}</span>
              </p>
            )}

            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">مدة التجديد</label>
              <div className="grid grid-cols-2 gap-2">
                {DURATION_OPTIONS.map(opt => (
                  <button key={opt.months} onClick={() => setRenewDuration(opt.months)}
                    className={`py-3 rounded-2xl text-sm font-bold transition-all ${
                      renewDuration === opt.months ? 'bg-primary text-primary-foreground shadow-lg' : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={handleDevRenew} disabled={!!processingId}
                className="flex-1 btn-primary py-3.5 text-sm font-bold flex items-center justify-center gap-1">
                {processingId === 'dev-renew' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                تجديد الاشتراك
              </button>
              <button onClick={() => setShowRenewModal(null)} className="flex-1 btn-secondary py-3.5 text-sm">إلغاء</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SubscriptionsTab;
