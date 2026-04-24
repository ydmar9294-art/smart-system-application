/**
 * DeletionRequestsManager - Approval/Rejection UI for managers
 * Used by SalesManager (for FIELD_AGENT/WAREHOUSE_KEEPER)
 * and Owner (for SALES_MANAGER/ACCOUNTANT)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/store/AppContext';
import { UserRole, EmployeeType } from '@/types';
import {
  Trash2, CheckCircle2, XCircle, Clock, Loader2, AlertTriangle, ChevronDown, ChevronUp, User
} from 'lucide-react';

interface DeletionRequest {
  id: string;
  requester_id: string;
  requester_name: string;
  requester_role: string;
  requester_employee_type: string;
  organization_id: string;
  reason: string | null;
  status: string;
  decision_note: string | null;
  decided_at: string | null;
  executed_at: string | null;
  created_at: string;
}

const employeeTypeLabel: Record<string, string> = {
  FIELD_AGENT: 'موزع ميداني',
  ACCOUNTANT: 'محاسب',
};

const DeletionRequestsManager: React.FC = () => {
  const { user } = useApp();
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [confirmApproveId, setConfirmApproveId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('account_deletion_requests')
        .select('*')
        .order('created_at', { ascending: false });

      setRequests((data as DeletionRequest[]) || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const pendingRequests = requests.filter(r => r.status === 'PENDING');
  const historyRequests = requests.filter(r => r.status !== 'PENDING');

  const handleDecision = async (requestId: string, decision: 'APPROVED' | 'REJECTED', note?: string) => {
    setActionLoading(requestId);
    setError('');
    try {
      const { data, error: rpcErr } = await supabase.rpc('decide_account_deletion_request', {
        p_request_id: requestId,
        p_decision: decision,
        p_note: note || null
      });
      if (rpcErr) throw rpcErr;
      const result = data as any;
      if (!result?.success) {
        setError(result?.message || 'فشلت العملية');
      } else {
        await fetchRequests();
        setConfirmApproveId(null);
        setShowRejectModal(null);
        setRejectNote('');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ');
    }
    setActionLoading(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-8">
        <Trash2 size={32} className="mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground font-bold">لا توجد طلبات حذف حسابات</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-xl text-sm font-bold text-center">
          {error}
        </div>
      )}

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-black text-foreground flex items-center gap-2">
            <Clock size={16} className="text-warning" />
            طلبات معلقة ({pendingRequests.length})
          </h3>
          {pendingRequests.map(req => (
            <div key={req.id} className="bg-card border border-warning/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
                    <User size={18} className="text-warning" />
                  </div>
                  <div>
                    <p className="font-black text-foreground text-sm">{req.requester_name}</p>
                    <p className="text-xs text-muted-foreground font-bold">
                      {employeeTypeLabel[req.requester_employee_type] || req.requester_employee_type}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground font-bold">
                  {new Date(req.created_at).toLocaleDateString('ar-SA')}
                </span>
              </div>

              {req.reason && (
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground font-bold mb-1">السبب:</p>
                  <p className="text-sm text-foreground font-bold">{req.reason}</p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmApproveId(req.id)}
                  disabled={actionLoading === req.id}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-black text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {actionLoading === req.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  قبول الحذف
                </button>
                <button
                  onClick={() => { setShowRejectModal(req.id); setRejectNote(''); }}
                  disabled={actionLoading === req.id}
                  className="flex-1 py-2.5 bg-destructive/10 text-destructive rounded-xl font-black text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <XCircle size={14} /> رفض
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* History */}
      {historyRequests.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-black text-muted-foreground flex items-center gap-2">
            سجل الطلبات السابقة ({historyRequests.length})
          </h3>
          {historyRequests.slice(0, 10).map(req => (
            <div key={req.id} className="bg-card border border-border rounded-2xl p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {req.status === 'APPROVED' ? (
                    <CheckCircle2 size={16} className="text-primary" />
                  ) : (
                    <XCircle size={16} className="text-destructive" />
                  )}
                  <span className="text-sm font-black text-foreground">{req.requester_name}</span>
                  <span className="text-xs text-muted-foreground font-bold">
                    ({employeeTypeLabel[req.requester_employee_type] || req.requester_employee_type})
                  </span>
                </div>
                <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                  req.status === 'APPROVED' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                }`}>
                  {req.status === 'APPROVED' ? 'مقبول' : 'مرفوض'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm Approve Modal */}
      {confirmApproveId && createPortal(
        <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-md flex items-center justify-center p-6" dir="rtl">
          <div className="bg-card rounded-2xl w-full max-w-sm p-6 space-y-4 animate-zoom-in shadow-2xl border border-border">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <AlertTriangle size={32} className="text-destructive" />
              </div>
              <h3 className="text-lg font-black text-destructive">تأكيد حذف الحساب</h3>
              <p className="text-sm text-muted-foreground font-bold">
                هل أنت متأكد من حذف حساب هذا الموظف؟ لا يمكن التراجع عن هذا الإجراء.
              </p>
            </div>
            <button
              onClick={() => handleDecision(confirmApproveId, 'APPROVED')}
              disabled={actionLoading === confirmApproveId}
              className="w-full py-3 bg-destructive text-destructive-foreground rounded-xl font-black flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {actionLoading === confirmApproveId ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              تأكيد الحذف النهائي
            </button>
            <button
              onClick={() => setConfirmApproveId(null)}
              className="w-full py-3 bg-muted text-muted-foreground rounded-xl font-black"
            >
              إلغاء
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Reject Modal */}
      {showRejectModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-md flex items-center justify-center p-6" dir="rtl">
          <div className="bg-card rounded-2xl w-full max-w-sm p-6 space-y-4 animate-zoom-in shadow-2xl border border-border">
            <div className="text-center space-y-3">
              <h3 className="text-lg font-black text-foreground">رفض طلب الحذف</h3>
              <p className="text-sm text-muted-foreground font-bold">
                أدخل سبب الرفض (اختياري) ليصل إلى مقدم الطلب
              </p>
            </div>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="سبب الرفض..."
              className="w-full p-3 rounded-xl border border-border bg-background text-foreground text-sm font-bold resize-none h-20"
              maxLength={500}
            />
            <button
              onClick={() => handleDecision(showRejectModal, 'REJECTED', rejectNote)}
              disabled={actionLoading === showRejectModal}
              className="w-full py-3 bg-destructive text-destructive-foreground rounded-xl font-black flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {actionLoading === showRejectModal ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
              تأكيد الرفض
            </button>
            <button
              onClick={() => { setShowRejectModal(null); setRejectNote(''); }}
              className="w-full py-3 bg-muted text-muted-foreground rounded-xl font-black"
            >
              إلغاء
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default DeletionRequestsManager;
