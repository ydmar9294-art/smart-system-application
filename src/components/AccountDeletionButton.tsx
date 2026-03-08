import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/store/AppContext';
import { UserRole } from '@/types';
import { Trash2, AlertTriangle, Loader2, Clock, CheckCircle2, XCircle } from 'lucide-react';

const AccountDeletionButton: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useApp();
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
        const { data } = await supabase.from('account_deletion_requests').select('*').eq('requester_id', user?.id || '').order('created_at', { ascending: false }).limit(1);
        if (data && data.length > 0) setPendingRequest(data[0]);
      } catch {}
      setLoadingStatus(false);
    };
    if (user?.id) checkPending();
  }, [user?.id]);

  if (user?.role === UserRole.OWNER) return null;
  if (user?.role === UserRole.DEVELOPER) return null;

  const handleSubmit = async () => {
    setSubmitting(true); setError(''); setSuccess('');
    try {
      const { data, error: rpcError } = await supabase.rpc('submit_account_deletion_request', { p_reason: reason || null });
      if (rpcError) throw rpcError;
      const result = data as any;
      if (result?.success) { setSuccess(result.message); setPendingRequest({ status: 'PENDING', reason, created_at: new Date().toISOString() }); setTimeout(() => setShowModal(false), 2000); }
      else { setError(result?.message || t('deletion.submitFailed')); }
    } catch (err: any) { setError(err.message || t('errors.genericError')); }
    finally { setSubmitting(false); }
  };

  const latestStatus = pendingRequest?.status;

  if (pendingRequest && latestStatus === 'PENDING') {
    return <div className="w-full py-3 bg-warning/10 text-warning rounded-xl font-black text-sm flex items-center justify-center gap-2"><Clock size={16} /> {t('deletion.pendingReview')}</div>;
  }

  if (pendingRequest && latestStatus === 'REJECTED' && !pendingRequest.executed_at) {
    return (
      <div className="space-y-2">
        <div className="w-full py-3 bg-destructive/10 text-destructive rounded-xl font-black text-sm flex items-center justify-center gap-2"><XCircle size={16} /> {t('deletion.rejected')}</div>
        {pendingRequest.decision_note && <p className="text-xs text-muted-foreground text-center px-2">{t('deletion.rejectionReason')} {pendingRequest.decision_note}</p>}
        <button onClick={() => { setPendingRequest(null); setReason(''); }} className="w-full py-2 text-xs text-primary font-bold underline">{t('deletion.newRequest')}</button>
      </div>
    );
  }

  if (loadingStatus) return <div className="w-full py-3 flex items-center justify-center"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>;

  return (
    <>
      <button onClick={() => setShowModal(true)} className="w-full py-3 bg-destructive/10 text-destructive rounded-xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all">
        <Trash2 size={16} /> {t('deletion.requestDeletion')}
      </button>
      {showModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-md flex items-center justify-center p-6 safe-area-x safe-area-bottom" dir={document.documentElement.dir || 'rtl'}>
          <div className="bg-card rounded-2xl w-full max-w-sm p-6 space-y-4 animate-zoom-in shadow-2xl border border-border">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto"><AlertTriangle size={32} className="text-destructive" /></div>
              <h3 className="text-xl font-black text-destructive">{t('deletion.requestTitle')}</h3>
              <p className="text-sm text-muted-foreground font-bold leading-relaxed">{t('deletion.requestDesc')}</p>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">{t('deletion.reasonLabel')}</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('deletion.reasonPlaceholder')}
                className="w-full p-3 rounded-xl border border-border bg-background text-foreground text-sm font-bold resize-none h-20" maxLength={500} />
            </div>
            {error && <p className="text-xs text-destructive font-bold text-center bg-destructive/10 p-2 rounded-lg">{error}</p>}
            {success && <p className="text-xs text-primary font-bold text-center bg-primary/10 p-2 rounded-lg">{success}</p>}
            <button onClick={handleSubmit} disabled={submitting}
              className="w-full py-3 bg-destructive text-destructive-foreground rounded-xl font-black disabled:opacity-40 flex items-center justify-center gap-2">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              {submitting ? t('deletion.submitting') : t('deletion.submitRequest')}
            </button>
            <button onClick={() => { setShowModal(false); setError(''); setSuccess(''); }} className="w-full py-3 bg-muted text-muted-foreground rounded-xl font-black">
              {t('common.cancel')}
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default AccountDeletionButton;
