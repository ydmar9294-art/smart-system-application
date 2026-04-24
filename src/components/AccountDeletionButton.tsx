/**
 * AccountDeletionButton - Hierarchical account deletion request
 * Employees submit requests → approved by their manager (Owner)
 * Owners redirect to org deletion flow.
 *
 * Mobile-first: dialog scales fully on small screens (320–414px).
 */
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/store/AuthContext';
import { UserRole } from '@/types';
import { Trash2, AlertTriangle, Loader2, Clock, XCircle } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const AccountDeletionButton: React.FC = () => {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    const checkPending = async () => {
      setLoadingStatus(true);
      try {
        const { data } = await supabase
          .from('account_deletion_requests')
          .select('*')
          .eq('requester_id', user?.id || '')
          .order('created_at', { ascending: false })
          .limit(1);
        if (data && data.length > 0) setPendingRequest(data[0]);
      } catch {}
      setLoadingStatus(false);
    };
    if (user?.id) checkPending();
  }, [user?.id]);

  if (user?.role === UserRole.OWNER) return null;
  if (user?.role === UserRole.DEVELOPER) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const { data, error: rpcError } = await supabase.rpc('submit_account_deletion_request', {
        p_reason: reason || null
      });
      if (rpcError) throw rpcError;
      const result = data as any;
      if (result?.success) {
        setSuccess(result.message);
        setPendingRequest({ status: 'PENDING', reason, created_at: new Date().toISOString() });
        setTimeout(() => setShowModal(false), 2000);
      } else {
        setError(result?.message || 'فشل تقديم الطلب');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ');
    } finally {
      setSubmitting(false);
    }
  };

  const latestStatus = pendingRequest?.status;

  if (pendingRequest && latestStatus === 'PENDING') {
    return (
      <div className="w-full py-3 bg-warning/10 text-warning rounded-xl font-black text-sm flex items-center justify-center gap-2">
        <Clock size={16} /> طلب حذف حسابك قيد المراجعة
      </div>
    );
  }

  if (pendingRequest && latestStatus === 'REJECTED' && !pendingRequest.executed_at) {
    return (
      <div className="space-y-2">
        <div className="w-full py-3 bg-destructive/10 text-destructive rounded-xl font-black text-sm flex items-center justify-center gap-2">
          <XCircle size={16} /> تم رفض طلب حذف حسابك
        </div>
        {pendingRequest.decision_note && (
          <p className="text-xs text-muted-foreground text-center px-2 break-words">السبب: {pendingRequest.decision_note}</p>
        )}
        <button
          onClick={() => { setPendingRequest(null); setReason(''); }}
          className="w-full py-2 text-xs text-primary font-bold underline"
        >
          تقديم طلب جديد
        </button>
      </div>
    );
  }

  if (loadingStatus) {
    return (
      <div className="w-full py-3 flex items-center justify-center">
        <Loader2 size={16} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="w-full py-3 bg-destructive/10 text-destructive rounded-xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
      >
        <Trash2 size={16} /> طلب حذف الحساب
      </button>

      <Dialog
        open={showModal}
        onOpenChange={(o) => {
          if (!o) {
            setShowModal(false);
            setError('');
            setSuccess('');
          }
        }}
      >
        <DialogContent
          className="w-[calc(100vw-1rem)] max-w-md p-4 sm:p-6 max-h-[90vh] overflow-y-auto"
          dir="rtl"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="space-y-4">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <AlertTriangle size={28} className="text-destructive" />
              </div>
              <h3 className="text-lg sm:text-xl font-black text-destructive">طلب حذف الحساب</h3>
              <p className="text-xs sm:text-sm text-muted-foreground font-bold leading-relaxed px-1">
                سيتم إرسال طلب حذف حسابك إلى المسؤول للمراجعة. الحذف لا يتم مباشرة.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">سبب الحذف (اختياري)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="اكتب سبب طلب حذف حسابك..."
                className="w-full p-3 rounded-xl border border-border bg-background text-foreground text-sm font-bold resize-none h-20"
                maxLength={500}
              />
            </div>

            {error && (
              <p className="text-xs text-destructive font-bold text-center bg-destructive/10 p-2 rounded-lg break-words">{error}</p>
            )}
            {success && (
              <p className="text-xs text-primary font-bold text-center bg-primary/10 p-2 rounded-lg break-words">{success}</p>
            )}

            <div className="flex flex-col gap-2">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-3 bg-destructive text-destructive-foreground rounded-xl font-black disabled:opacity-40 flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {submitting ? 'جاري الإرسال...' : 'تقديم طلب الحذف'}
              </button>
              <button
                onClick={() => { setShowModal(false); setError(''); setSuccess(''); }}
                className="w-full py-3 bg-muted text-muted-foreground rounded-xl font-black active:scale-95 transition-transform"
              >
                إلغاء
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AccountDeletionButton;
