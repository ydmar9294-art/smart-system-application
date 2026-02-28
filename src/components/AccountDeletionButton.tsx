/**
 * AccountDeletionButton - In-app account deletion (Google Play requirement)
 */
import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/store/AppContext';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';

const AccountDeletionButton: React.FC = () => {
  const { logout } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    if (confirmText !== 'حذف') return;
    setDeleting(true);
    setError('');

    try {
      const { data, error: rpcError } = await supabase.rpc('delete_own_account_rpc');
      if (rpcError) throw rpcError;

      const result = data as any;
      if (result?.success) {
        localStorage.removeItem('smart_system_consent_accepted');
        logout();
      } else {
        setError(result?.message || 'فشل حذف الحساب');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="w-full py-3 bg-destructive/10 text-destructive rounded-xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
      >
        <Trash2 size={16} /> حذف الحساب
      </button>

      {showModal && (
        <div className="fixed inset-0 z-[9999] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
          <div className="bg-card rounded-2xl w-full max-w-sm p-6 space-y-4 animate-zoom-in shadow-xl border border-border">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <AlertTriangle size={28} className="text-destructive" />
              </div>
              <h3 className="text-lg font-black text-destructive">حذف الحساب نهائياً</h3>
              <p className="text-sm text-muted-foreground font-bold leading-relaxed">
                سيتم حذف بياناتك الشخصية وإلغاء تنشيط حسابك بشكل نهائي.
                لا يمكن التراجع عن هذا الإجراء.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">اكتب "حذف" للتأكيد</label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder='حذف'
                className="input-field text-center font-black"
              />
            </div>

            {error && (
              <p className="text-xs text-destructive font-bold text-center bg-destructive/10 p-2 rounded-lg">{error}</p>
            )}

            <button
              onClick={handleDelete}
              disabled={confirmText !== 'حذف' || deleting}
              className="w-full py-3 bg-destructive text-destructive-foreground rounded-xl font-black disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              {deleting ? 'جاري الحذف...' : 'تأكيد الحذف'}
            </button>
            <button
              onClick={() => { setShowModal(false); setConfirmText(''); setError(''); }}
              className="w-full py-3 bg-muted text-muted-foreground rounded-xl font-black"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AccountDeletionButton;
