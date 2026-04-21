import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Trash2, AlertTriangle, CheckCircle2, Clock,
  FileText, User, Building2, Loader2, Ban
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface DeletionRequest {
  id: string;
  organization_id: string;
  owner_id: string;
  request_date: string;
  request_method: string;
  request_notes: string | null;
  approval_status: string;
  executed_at: string | null;
  executed_by: string | null;
}

interface OrgOption {
  id: string;
  name: string;
  owner_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
}

const OrgDeletionManager: React.FC = () => {
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState<DeletionRequest | null>(null);
  const [confirmName, setConfirmName] = useState('');
  const [executing, setExecuting] = useState(false);
  const [orgOptions, setOrgOptions] = useState<OrgOption[]>([]);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('deletion_requests')
      .select('*')
      .order('created_at', { ascending: false });
    setRequests((data as any[]) || []);
    setLoading(false);
  }, []);

  const fetchOrgs = useCallback(async () => {
    const { data: orgs } = await supabase.from('organizations').select('id, name');
    if (!orgs) return;
    
    const options: OrgOption[] = [];
    for (const org of orgs) {
      const { data: owner } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .eq('organization_id', org.id)
        .eq('role', 'OWNER')
        .maybeSingle();
      options.push({
        id: org.id,
        name: org.name,
        owner_id: owner?.id || null,
        owner_name: owner?.full_name || null,
        owner_email: owner?.email || null,
        owner_phone: owner?.phone || null,
      });
    }
    setOrgOptions(options);
  }, []);

  useEffect(() => {
    fetchRequests();
    fetchOrgs();
  }, [fetchRequests, fetchOrgs]);

  const handleReject = async (req: DeletionRequest) => {
    await supabase.from('deletion_requests').update({
      approval_status: 'REJECTED',
    } as any).eq('id', req.id);
    fetchRequests();
  };

  const handleExecuteDeletion = async () => {
    if (!confirmModal) return;
    const org = orgOptions.find(o => o.id === confirmModal.organization_id);
    if (!org || confirmName !== org.name) {
      alert('اسم المنشأة غير مطابق');
      return;
    }

    setExecuting(true);
    try {
      const { data, error } = await supabase.rpc('execute_org_deletion_rpc', {
        p_deletion_request_id: confirmModal.id,
        p_confirmation_org_name: confirmName,
      });

      if (error) throw error;
      const result = data as any;
      if (result?.success) {
        alert(result.message);
        setConfirmModal(null);
        setConfirmName('');
        fetchRequests();
        fetchOrgs();
      } else {
        alert(result?.message || 'فشل الحذف');
      }
    } catch (err: any) {
      alert('خطأ: ' + err.message);
    } finally {
      setExecuting(false);
    }
  };

  const getOrgName = (orgId: string) => orgOptions.find(o => o.id === orgId)?.name || orgId;
  const getOwnerInfo = (orgId: string) => orgOptions.find(o => o.id === orgId);

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      PENDING: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', label: 'قيد الانتظار' },
      APPROVED: { bg: 'bg-primary/10', text: 'text-primary', label: 'تمت الموافقة' },
      EXECUTED: { bg: 'bg-destructive/10', text: 'text-destructive', label: 'تم التنفيذ' },
      REJECTED: { bg: 'bg-muted', text: 'text-muted-foreground', label: 'مرفوض' },
    };
    const s = map[status] || map.PENDING;
    return <span className={`text-[10px] font-black px-3 py-1 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>;
  };

  return (
    <div className="space-y-6" dir="rtl">
      <h2 className="text-lg md:text-xl font-black flex items-center gap-2">
        <Trash2 size={20} className="text-destructive" /> طلبات حذف المنشآت
      </h2>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground font-bold text-sm">لا توجد طلبات حذف</div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            const owner = getOwnerInfo(req.organization_id);
            return (
              <div key={req.id} className={`p-4 rounded-2xl border-2 transition-all ${
                req.approval_status === 'EXECUTED' ? 'bg-destructive/5 border-destructive/20 opacity-60' :
                req.approval_status === 'REJECTED' ? 'bg-muted/30 border-border opacity-60' :
                'bg-card border-border shadow-sm'
              }`}>
                <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-muted-foreground" />
                    <h3 className="font-black text-foreground text-sm">{getOrgName(req.organization_id)}</h3>
                  </div>
                  {statusBadge(req.approval_status)}
                </div>

                {owner && (
                  <div className="bg-muted/50 rounded-xl p-3 mb-3 text-xs space-y-1">
                    <div className="flex items-center gap-2 font-bold text-muted-foreground">
                      <User size={12} /> المالك: <span className="text-foreground">{owner.owner_name || 'غير معروف'}</span>
                    </div>
                    {owner.owner_email && <div className="text-muted-foreground font-bold">البريد: {owner.owner_email}</div>}
                    {owner.owner_phone && <div className="text-muted-foreground font-bold">الهاتف: {owner.owner_phone}</div>}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div className="font-bold text-muted-foreground">
                    طريقة الطلب: <span className="text-foreground">{
                      req.request_method === 'EMAIL' ? 'بريد إلكتروني' :
                      req.request_method === 'TICKET' ? 'تذكرة دعم' : 'داخل التطبيق'
                    }</span>
                  </div>
                  <div className="font-bold text-muted-foreground">
                    تاريخ الطلب: <span className="text-foreground">{new Date(req.request_date).toLocaleDateString('ar-EG')}</span>
                  </div>
                </div>

                {req.request_notes && (
                  <p className="text-xs text-muted-foreground font-bold mb-3 bg-muted/30 p-2 rounded-lg">{req.request_notes}</p>
                )}

                {req.executed_at && (
                  <p className="text-xs text-destructive font-bold mb-3 flex items-center gap-1">
                    <CheckCircle2 size={12} /> تم التنفيذ: {new Date(req.executed_at).toLocaleString('ar-EG')}
                  </p>
                )}

                {/* Action buttons - simplified: approve or reject */}
                {req.approval_status === 'PENDING' && (
                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    <button
                      onClick={() => { setConfirmModal(req); setConfirmName(''); }}
                      className="px-4 py-2 bg-destructive text-destructive-foreground rounded-xl text-xs font-black flex items-center gap-1 active:scale-95"
                    >
                      <Trash2 size={14} /> تأكيد الحذف النهائي
                    </button>
                    <button
                      onClick={() => handleReject(req)}
                      className="px-4 py-2 bg-muted text-muted-foreground rounded-xl text-xs font-black flex items-center gap-1 active:scale-95"
                    >
                      <Ban size={14} /> رفض
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm Deletion Modal */}
      <Dialog
        open={!!confirmModal}
        onOpenChange={(o) => { if (!o) { setConfirmModal(null); setConfirmName(''); } }}
      >
        <DialogContent
          className="max-w-md p-6 max-h-[90vh] overflow-y-auto"
          dir="rtl"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {confirmModal && (
            <div className="space-y-4">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                  <AlertTriangle size={32} className="text-destructive" />
                </div>
                <h3 className="text-lg font-black text-destructive">تأكيد الحذف النهائي</h3>
                <p className="text-sm font-bold text-muted-foreground leading-relaxed">
                  ⚠️ سيتم حذف المنشأة <span className="text-foreground font-black">"{getOrgName(confirmModal.organization_id)}"</span> نهائياً بناءً على طلب صاحبها.
                </p>
                <p className="text-xs text-destructive font-bold">
                  سيتم حذف جميع البيانات والسجلات والمستخدمين المرتبطين بها. لا يمكن التراجع عن هذا الإجراء.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">اكتب اسم المنشأة للتأكيد *</label>
                <input
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={getOrgName(confirmModal.organization_id)}
                  className="input-field text-center font-black"
                  dir="rtl"
                />
              </div>

              <button
                onClick={handleExecuteDeletion}
                disabled={executing || confirmName !== getOrgName(confirmModal.organization_id)}
                className="w-full py-3 bg-destructive text-destructive-foreground rounded-xl font-black disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {executing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {executing ? 'جاري الحذف...' : 'حذف نهائي'}
              </button>
              <button onClick={() => setConfirmModal(null)} className="w-full py-3 bg-muted text-muted-foreground rounded-xl font-black">إلغاء</button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrgDeletionManager;
