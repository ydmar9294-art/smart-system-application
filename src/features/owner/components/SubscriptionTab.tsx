/**
 * SubscriptionTab - Owner subscription management
 * View subscription status, renew, upload payment receipts
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/store/AuthContext';
import { SubscriptionPayment } from '@/types';
import { CURRENCY, SUPPORT_WHATSAPP_URL } from '@/constants';
import { getDeviceId } from '@/lib/deviceId';
import {
  CreditCard, Calendar, Clock, CheckCircle2, XCircle,
  Upload, Image as ImageIcon, Loader2, AlertTriangle,
  RefreshCw, X, MessageCircle, DollarSign
} from 'lucide-react';

const DURATION_OPTIONS = [
  { months: 1, label: 'شهر واحد' },
  { months: 3, label: '3 أشهر' },
  { months: 6, label: '6 أشهر' },
  { months: 12, label: 'سنة كاملة' },
];

interface LicenseInfo {
  id: string;
  license_key: string;
  org_name: string;
  organization_id: string;
  type: string;
  status: string;
  expiry_date: string | null;
  max_employees: number;
  monthly_price: number;
  days_valid: number;
}

const SubscriptionTab: React.FC = () => {
  const { user, organization } = useAuth();
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(1);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewReceiptUrl, setViewReceiptUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch license info
      const { data: licData } = await supabase.rpc('get_my_license_info');
      const lic = licData?.[0];
      if (lic) setLicenseInfo(lic);

      // Fetch payment history
      if (organization?.id) {
        const { data: payData } = await supabase
          .from('subscription_payments')
          .select('*')
          .eq('organization_id', organization.id)
          .order('created_at', { ascending: false });

        setPayments((payData || []).map(p => ({
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
      }
    } catch (err) {
      console.error('Failed to fetch subscription data:', err);
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('حجم الملف كبير جداً (الحد الأقصى 5 MB)');
      return;
    }
    setReceiptFile(file);
    const reader = new FileReader();
    reader.onload = () => setReceiptPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmitRenewal = async () => {
    if (!licenseInfo || !user || !organization || !receiptFile) return;
    setUploading(true);
    try {
      // Upload receipt
      const ext = receiptFile.name.split('.').pop();
      const fileName = `${organization.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('payment-receipts')
        .upload(fileName, receiptFile);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('payment-receipts')
        .getPublicUrl(fileName);

      const totalAmount = (licenseInfo.monthly_price || 0) * selectedDuration;

      // Insert payment record
      const { error: insertError } = await supabase
        .from('subscription_payments')
        .insert({
          organization_id: organization.id,
          license_id: licenseInfo.id,
          amount: totalAmount,
          duration_months: selectedDuration,
          submitted_by: user.id,
          submitted_by_role: 'OWNER',
          receipt_url: urlData.publicUrl,
          device_id: getDeviceId(),
          is_first_subscription: false,
        });
      if (insertError) throw insertError;

      setShowRenewModal(false);
      setReceiptFile(null);
      setReceiptPreview(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'فشل رفع الحوالة');
    } finally {
      setUploading(false);
    }
  };

  const monthlyPrice = licenseInfo?.monthly_price || 0;
  const totalCost = monthlyPrice * selectedDuration;
  const isSubscription = licenseInfo?.type === 'SUBSCRIPTION';
  const isExpired = licenseInfo?.expiry_date && new Date(licenseInfo.expiry_date) < new Date();
  const daysRemaining = licenseInfo?.expiry_date
    ? Math.max(0, Math.ceil((new Date(licenseInfo.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const hasPendingPayment = payments.some(p => p.status === 'PENDING');

  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
        <p className="text-sm font-bold">جارٍ التحميل...</p>
      </div>
    );
  }

  if (!licenseInfo) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-bold">لا توجد معلومات اشتراك</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Subscription Status Card */}
      <div className={`card-elevated p-5 ${isExpired ? 'ring-2 ring-destructive/30' : daysRemaining !== null && daysRemaining <= 7 ? 'ring-2 ring-warning/30' : ''}`}>
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              isExpired ? 'bg-destructive/10' : 'bg-primary/10'
            }`}>
              <CreditCard className={`w-6 h-6 ${isExpired ? 'text-destructive' : 'text-primary'}`} />
            </div>
            <div>
              <h3 className="font-black text-foreground">حالة الاشتراك</h3>
              <p className="text-[10px] text-muted-foreground">{licenseInfo.org_name}</p>
            </div>
          </div>
          <span className={`badge ${
            isExpired ? 'badge-danger' :
            licenseInfo.status === 'ACTIVE' ? 'badge-success' : 'bg-warning/20 text-warning'
          }`}>
            {isExpired ? 'منتهي' : licenseInfo.status === 'ACTIVE' ? 'نشط' : licenseInfo.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-muted p-3 rounded-2xl">
            <span className="text-[10px] text-muted-foreground block mb-1">نوع الاشتراك</span>
            <span className="font-black text-foreground text-sm">
              {licenseInfo.type === 'SUBSCRIPTION' ? 'اشتراك دوري' : licenseInfo.type === 'TRIAL' ? 'تجريبي' : 'اشتراك'}
            </span>
          </div>
          <div className="bg-muted p-3 rounded-2xl">
            <span className="text-[10px] text-muted-foreground block mb-1">سعر الشهر</span>
            <span className="font-black text-foreground text-sm">
              {monthlyPrice > 0 ? `${monthlyPrice.toLocaleString()} ${CURRENCY}` : 'غير محدد'}
            </span>
          </div>
        </div>

        {licenseInfo.expiry_date && (
          <div className={`p-3 rounded-2xl mb-4 ${
            isExpired ? 'bg-destructive/10' : daysRemaining !== null && daysRemaining <= 7 ? 'bg-warning/10' : 'bg-muted'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <Calendar size={14} className={isExpired ? 'text-destructive' : 'text-muted-foreground'} />
              <span className="text-xs font-bold text-muted-foreground">تاريخ الانتهاء</span>
            </div>
            <p className="font-black text-foreground">
              {new Date(licenseInfo.expiry_date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            {daysRemaining !== null && !isExpired && (
              <p className={`text-xs font-bold mt-1 ${daysRemaining <= 3 ? 'text-destructive' : daysRemaining <= 7 ? 'text-warning' : 'text-muted-foreground'}`}>
                {daysRemaining === 0 ? 'ينتهي اليوم!' : `متبقي ${daysRemaining} يوم`}
              </p>
            )}
            {isExpired && (
              <p className="text-xs font-bold text-destructive mt-1 flex items-center gap-1">
                <AlertTriangle size={12} /> انتهى الاشتراك - يرجى التجديد
              </p>
            )}
          </div>
        )}

        {/* Renew Button */}
        {(isSubscription || licenseInfo.type === 'TRIAL') && monthlyPrice > 0 && (
          <button onClick={() => setShowRenewModal(true)} disabled={hasPendingPayment}
            className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all ${
              hasPendingPayment ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary text-primary-foreground'
            }`}>
            {hasPendingPayment ? (
              <><Clock size={18} /> طلب تجديد معلّق</>
            ) : (
              <><RefreshCw size={18} /> تجديد الاشتراك</>
            )}
          </button>
        )}

        {monthlyPrice === 0 && (
          <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
            className="w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all bg-green-600 text-white">
            <MessageCircle size={18} /> تواصل مع المطور للتجديد
          </a>
        )}
      </div>

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="card-elevated p-4">
          <h3 className="font-black text-foreground text-sm mb-3 flex items-center gap-2">
            <Clock size={16} className="text-primary" /> سجل المدفوعات
          </h3>
          <div className="space-y-2">
            {payments.map(p => (
              <div key={p.id} className="bg-muted p-3 rounded-2xl">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-bold text-foreground text-sm">{p.amount.toLocaleString()} {CURRENCY}</p>
                    <p className="text-[10px] text-muted-foreground">{p.durationMonths} شهر</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {p.status === 'APPROVED' && <CheckCircle2 size={14} className="text-green-600" />}
                    {p.status === 'REJECTED' && <XCircle size={14} className="text-destructive" />}
                    {p.status === 'PENDING' && <Clock size={14} className="text-warning" />}
                    <span className={`text-[10px] font-bold ${
                      p.status === 'APPROVED' ? 'text-green-600' : p.status === 'REJECTED' ? 'text-destructive' : 'text-warning'
                    }`}>
                      {p.status === 'APPROVED' ? 'مقبول' : p.status === 'REJECTED' ? 'مرفوض' : 'معلّق'}
                    </span>
                  </div>
                </div>
                {p.subscriptionEnd && (
                  <p className="text-[10px] text-muted-foreground">
                    حتى: {new Date(p.subscriptionEnd).toLocaleDateString('ar-EG')}
                  </p>
                )}
                {p.rejectionReason && (
                  <p className="text-[10px] text-destructive font-bold mt-1">سبب الرفض: {p.rejectionReason}</p>
                )}
                {p.receiptUrl && (
                  <button onClick={() => setViewReceiptUrl(p.receiptUrl!)}
                    className="text-[10px] text-primary font-bold mt-1 flex items-center gap-1">
                    <ImageIcon size={12} /> عرض الحوالة
                  </button>
                )}
                <p className="text-[9px] text-muted-foreground mt-1">
                  {new Date(p.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Renew Modal */}
      {showRenewModal && createPortal(
        <div className="modal-overlay safe-area-x safe-area-bottom" dir="rtl">
          <div className="card-elevated w-full max-w-md p-5 space-y-5 animate-zoom-in mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-foreground text-lg">تجديد الاشتراك</h3>
              <button onClick={() => { setShowRenewModal(false); setReceiptFile(null); setReceiptPreview(null); }}
                className="p-2 rounded-full hover:bg-muted"><X size={18} /></button>
            </div>

            {/* Duration Picker */}
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-2">اختر مدة الاشتراك</label>
              <div className="grid grid-cols-2 gap-2">
                {DURATION_OPTIONS.map(opt => (
                  <button key={opt.months} onClick={() => setSelectedDuration(opt.months)}
                    className={`py-3.5 rounded-2xl text-sm font-bold transition-all ${
                      selectedDuration === opt.months ? 'bg-primary text-primary-foreground shadow-lg scale-[1.02]' : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cost Display */}
            <div className="bg-primary/10 p-5 rounded-2xl text-center">
              <p className="text-xs text-muted-foreground mb-1">التكلفة الإجمالية</p>
              <p className="text-3xl font-black text-primary">
                {totalCost.toLocaleString()} <span className="text-sm">{CURRENCY}</span>
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {monthlyPrice.toLocaleString()} {CURRENCY} × {selectedDuration} شهر
              </p>
            </div>

            {/* Receipt Upload */}
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-2">صورة الحوالة (شام كاش)</label>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
              
              {receiptPreview ? (
                <div className="relative">
                  <img src={receiptPreview} alt="الحوالة" className="w-full rounded-2xl border border-border max-h-60 object-contain bg-muted" />
                  <button onClick={() => { setReceiptFile(null); setReceiptPreview(null); }}
                    className="absolute top-2 left-2 p-1.5 bg-destructive/90 text-destructive-foreground rounded-full">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()}
                  className="w-full py-8 border-2 border-dashed border-border rounded-2xl flex flex-col items-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-all">
                  <Upload size={24} />
                  <span className="text-sm font-bold">اضغط لرفع صورة الحوالة</span>
                  <span className="text-[10px]">الحد الأقصى 5 MB</span>
                </button>
              )}
            </div>

            {/* Submit */}
            <button onClick={handleSubmitRenewal} disabled={!receiptFile || uploading}
              className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all ${
                !receiptFile || uploading ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary text-primary-foreground'
              }`}>
              {uploading ? (
                <><Loader2 size={18} className="animate-spin" /> جارٍ الرفع...</>
              ) : (
                <><CreditCard size={18} /> إرسال طلب التجديد</>
              )}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Receipt Viewer */}
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
    </div>
  );
};

export default SubscriptionTab;
