import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/store/AppContext';
import { Trash2, AlertTriangle, Clock, CheckCircle2, Ban, Loader2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const OrgDeletionRequest: React.FC = () => {
  const { user, organization, logout } = useApp();
  const [existingRequest, setExistingRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from('deletion_requests')
        .select('*')
        .eq('owner_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) setExistingRequest(data[0]);
      setLoading(false);
    };
    fetch();
  }, []);

  const handleSubmit = async () => {
    if (!organization || confirmText !== organization.name) return;
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const orgId = (organization as any).id;
      const { error } = await supabase.from('deletion_requests').insert({
        organization_id: orgId,
        owner_id: session.user.id,
        request_method: 'IN_APP',
        request_notes: reason || null,
      });

      if (error) {
        alert('خطأ: ' + error.message);
      } else {
        setShowConfirm(false);
        setExistingRequest({
          approval_status: 'PENDING',
          verification_status: 'PENDING',
          request_date: new Date().toISOString(),
          request_notes: reason || null,
        });
      }
    } catch (err: any) {
      alert('خطأ: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;

  // Already has a pending/approved request
  if (existingRequest && !['REJECTED', 'EXECUTED'].includes(existingRequest.approval_status)) {
    return (
      <div className="bg-card rounded-2xl p-4 shadow-sm border border-border space-y-3" dir="rtl">
        <h3 className="font-black text-foreground text-sm flex items-center gap-2">
          <Clock size={16} className="text-yellow-500" /> طلب حذف المنشأة
        </h3>
        <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3 text-xs font-bold text-yellow-800 dark:text-yellow-300">
          <p>تم تقديم طلب حذف المنشأة بتاريخ {new Date(existingRequest.request_date).toLocaleDateString('ar-EG')}</p>
          <p className="mt-1">الحالة: قيد المراجعة من قبل فريق الدعم</p>
          {existingRequest.request_notes && (
            <p className="mt-1 text-muted-foreground">السبب: {existingRequest.request_notes}</p>
          )}
        </div>
        {existingRequest.approval_status === 'APPROVED' && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-xs font-bold text-destructive">
            <p>تمت الموافقة على طلبك. سيتم تنفيذ الحذف قريباً.</p>
          </div>
        )}
      </div>
    );
  }

  // Request was executed
  if (existingRequest?.approval_status === 'EXECUTED') {
    return null;
  }

  return (
    <div className="space-y-3" dir="rtl">
      {/* Trigger button */}
      {!showConfirm && (
        <button
          onClick={() => setShowConfirm(true)}
          className="w-full py-3 bg-destructive/10 text-destructive rounded-2xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <Trash2 size={16} /> طلب حذف المنشأة
        </button>
      )}

      {/* Confirmation flow */}
      <Dialog
        open={showConfirm}
        onOpenChange={(o) => {
          if (!o) {
            setShowConfirm(false);
            setConfirmText('');
            setReason('');
          }
        }}
      >
        <DialogContent
          className="max-w-md p-6 max-h-[90vh] overflow-y-auto"
          dir="rtl"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="space-y-4">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <AlertTriangle size={32} className="text-destructive" />
              </div>
              <h3 className="text-lg font-black text-destructive">طلب حذف المنشأة</h3>
              <p className="text-sm font-bold text-muted-foreground leading-relaxed">
                سيتم حذف منشأتك <span className="text-foreground font-black">"{organization?.name}"</span> نهائياً مع جميع البيانات والسجلات.
              </p>
              <p className="text-xs text-destructive font-bold">
                ⚠️ لا يمكن التراجع عن هذا الإجراء بعد الموافقة والتنفيذ.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">سبب الحذف (اختياري)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input-field min-h-[60px] text-sm"
                placeholder="لماذا تريد حذف المنشأة؟"
                maxLength={500}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">
                اكتب اسم المنشأة <span className="text-foreground font-black">"{organization?.name}"</span> للتأكيد *
              </label>
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={organization?.name}
                className="input-field text-center font-black"
                dir="rtl"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || confirmText !== organization?.name}
              className="w-full py-3 bg-destructive text-destructive-foreground rounded-xl font-black disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              {submitting ? 'جاري الإرسال...' : 'تأكيد طلب الحذف'}
            </button>
            <button
              onClick={() => { setShowConfirm(false); setConfirmText(''); setReason(''); }}
              className="w-full py-3 bg-muted text-muted-foreground rounded-xl font-black"
            >
              إلغاء
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrgDeletionRequest;
