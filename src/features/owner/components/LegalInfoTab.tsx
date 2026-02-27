import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Building2,
  Factory,
  Receipt,
  Tag,
  Save,
  Loader2,
  Check,
  AlertCircle,
  Shield,
  Upload,
  Trash2,
  Stamp,
  ImageIcon
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/store/AppContext';

interface LegalInfo {
  id?: string;
  commercial_registration: string;
  industrial_registration: string;
  tax_identification: string;
  trademark_name: string;
  stamp_url: string | null;
}

const MAX_STAMP_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_FORMATS = ['image/png', 'image/jpeg', 'image/jpg'];

const LegalInfoTab: React.FC = () => {
  const { addNotification } = useApp();
  const [legalInfo, setLegalInfo] = useState<LegalInfo>({
    commercial_registration: '',
    industrial_registration: '',
    tax_identification: '',
    trademark_name: '',
    stamp_url: null
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [stampPreview, setStampPreview] = useState<string | null>(null);
  const [stampUploading, setStampUploading] = useState(false);
  const [stampDeleting, setStampDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    const fetchLegalInfo = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .single();

        if (!profile?.organization_id) {
          setLoading(false);
          setError('لا توجد منشأة مرتبطة بحسابك. يرجى تفعيل ترخيص أولاً.');
          return;
        }

        setOrgId(profile.organization_id);

        const { data, error } = await supabase
          .from('organization_legal_info')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
          setLegalInfo({
            id: data.id,
            commercial_registration: data.commercial_registration || '',
            industrial_registration: data.industrial_registration || '',
            tax_identification: data.tax_identification || '',
            trademark_name: data.trademark_name || '',
            stamp_url: data.stamp_url || null
          });
          if (data.stamp_url) {
            setStampPreview(data.stamp_url);
          }
        }
      } catch (err) {
        console.error('Error fetching legal info:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLegalInfo();
  }, []);

  const handleStampUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate format
    if (!ACCEPTED_FORMATS.includes(file.type)) {
      addNotification('صيغة غير مدعومة. يرجى رفع PNG أو JPG', 'error');
      return;
    }

    // Validate size
    if (file.size > MAX_STAMP_SIZE) {
      addNotification('حجم الملف يتجاوز 2 ميجابايت', 'error');
      return;
    }

    setStampUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('غير مصادق');

      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const filePath = `${user.id}/stamp_${Date.now()}.${ext}`;

      // Delete old stamp if exists
      if (legalInfo.stamp_url) {
        const oldPath = extractStoragePath(legalInfo.stamp_url);
        if (oldPath) {
          await supabase.storage.from('company-stamps').remove([oldPath]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('company-stamps')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('company-stamps')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      setLegalInfo(prev => ({ ...prev, stamp_url: publicUrl }));
      setStampPreview(publicUrl);
      addNotification('تم رفع الختم بنجاح', 'success');
    } catch (err: any) {
      console.error('Stamp upload error:', err);
      addNotification('فشل رفع الختم: ' + (err.message || ''), 'error');
    } finally {
      setStampUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleStampDelete = async () => {
    if (!legalInfo.stamp_url) return;
    setStampDeleting(true);
    try {
      const oldPath = extractStoragePath(legalInfo.stamp_url);
      if (oldPath) {
        await supabase.storage.from('company-stamps').remove([oldPath]);
      }
      setLegalInfo(prev => ({ ...prev, stamp_url: null }));
      setStampPreview(null);
      addNotification('تم حذف الختم', 'success');
    } catch (err: any) {
      addNotification('فشل حذف الختم', 'error');
    } finally {
      setStampDeleting(false);
    }
  };

  const extractStoragePath = (url: string): string | null => {
    try {
      const match = url.match(/company-stamps\/(.+)$/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('غير مصادق');

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile?.organization_id) throw new Error('لا توجد منشأة مرتبطة بحسابك.');

      const payload = {
        organization_id: profile.organization_id,
        commercial_registration: legalInfo.commercial_registration || null,
        industrial_registration: legalInfo.industrial_registration || null,
        tax_identification: legalInfo.tax_identification || null,
        trademark_name: legalInfo.trademark_name || null,
        stamp_url: legalInfo.stamp_url || null
      };

      if (legalInfo.id) {
        const { error } = await supabase
          .from('organization_legal_info')
          .update(payload)
          .eq('id', legalInfo.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('organization_legal_info')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setLegalInfo(prev => ({ ...prev, id: data.id }));
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      addNotification('تم حفظ المعلومات القانونية بنجاح', 'success');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الحفظ');
      addNotification('حدث خطأ أثناء حفظ المعلومات', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-5 rounded-3xl text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-black text-lg">المعلومات القانونية</h3>
            <p className="text-xs opacity-80">جميع الحقول اختيارية وتُستخدم في الفواتير</p>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 p-4 rounded-2xl flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
          <Check className="w-5 h-5" />
          <span className="font-bold">تم الحفظ بنجاح!</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-2xl flex items-center gap-2 border border-red-200 dark:border-red-800">
          <AlertCircle className="w-5 h-5" />
          <span className="font-bold">{error}</span>
        </div>
      )}

      {/* Form Fields */}
      <div className="bg-card rounded-3xl p-5 shadow-sm space-y-4">
        {/* Commercial Registration */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-bold text-foreground/80">
            <Building2 className="w-4 h-4 text-blue-600" />
            رقم السجل التجاري
          </label>
          <input
            type="text"
            value={legalInfo.commercial_registration}
            onChange={(e) => setLegalInfo(prev => ({ ...prev, commercial_registration: e.target.value }))}
            placeholder="اختياري - مثال: 12345"
            className="w-full bg-muted border-none rounded-2xl px-4 py-3 font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            dir="ltr"
          />
        </div>

        {/* Industrial Registration */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-bold text-foreground/80">
            <Factory className="w-4 h-4 text-emerald-600" />
            رقم السجل الصناعي / القرار الصناعي
          </label>
          <input
            type="text"
            value={legalInfo.industrial_registration}
            onChange={(e) => setLegalInfo(prev => ({ ...prev, industrial_registration: e.target.value }))}
            placeholder="اختياري - مثال: IND-2024-001"
            className="w-full bg-muted border-none rounded-2xl px-4 py-3 font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            dir="ltr"
          />
        </div>

        {/* Tax ID */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-bold text-foreground/80">
            <Receipt className="w-4 h-4 text-orange-600" />
            الرقم الضريبي
          </label>
          <input
            type="text"
            value={legalInfo.tax_identification}
            onChange={(e) => setLegalInfo(prev => ({ ...prev, tax_identification: e.target.value }))}
            placeholder="اختياري - مثال: TAX-123456789"
            className="w-full bg-muted border-none rounded-2xl px-4 py-3 font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            dir="ltr"
          />
        </div>

        {/* Trademark */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-bold text-foreground/80">
            <Tag className="w-4 h-4 text-purple-600" />
            العلامة التجارية المسجلة
          </label>
          <input
            type="text"
            value={legalInfo.trademark_name}
            onChange={(e) => setLegalInfo(prev => ({ ...prev, trademark_name: e.target.value }))}
            placeholder="اختياري - اسم العلامة التجارية"
            className="w-full bg-muted border-none rounded-2xl px-4 py-3 font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          />
        </div>
      </div>

      {/* Company Stamp Upload */}
      <div className="bg-card rounded-3xl p-5 shadow-sm space-y-4">
        <label className="flex items-center gap-2 text-sm font-bold text-foreground/80">
          <Stamp className="w-4 h-4 text-indigo-600" />
          ختم الشركة
          <span className="text-xs font-normal text-muted-foreground">(اختياري - PNG أو JPG - حد أقصى 2MB)</span>
        </label>

        {stampPreview ? (
          <div className="space-y-3">
            <div className="relative w-32 h-32 mx-auto bg-muted rounded-2xl flex items-center justify-center overflow-hidden border-2 border-dashed border-indigo-300 dark:border-indigo-700">
              <img
                src={stampPreview}
                alt="ختم الشركة"
                className="max-w-full max-h-full object-contain p-2"
              />
            </div>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={stampUploading}
                className="flex items-center gap-1 px-4 py-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-xl text-sm font-bold hover:bg-indigo-200 dark:hover:bg-indigo-900/60 transition-colors disabled:opacity-50"
              >
                {stampUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                تغيير
              </button>
              <button
                onClick={handleStampDelete}
                disabled={stampDeleting}
                className="flex items-center gap-1 px-4 py-2 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-xl text-sm font-bold hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors disabled:opacity-50"
              >
                {stampDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                حذف
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={stampUploading}
            className="w-full flex flex-col items-center justify-center gap-2 py-8 bg-muted rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 hover:border-indigo-500 transition-colors cursor-pointer disabled:opacity-50"
          >
            {stampUploading ? (
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            ) : (
              <ImageIcon className="w-8 h-8 text-indigo-400" />
            )}
            <span className="text-sm text-muted-foreground font-medium">
              {stampUploading ? 'جارٍ الرفع...' : 'اضغط لرفع ختم الشركة'}
            </span>
            <span className="text-xs text-muted-foreground">يُفضّل خلفية شفافة (PNG)</span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg"
          onChange={handleStampUpload}
          className="hidden"
        />

        <p className="text-xs text-muted-foreground text-center">
          سيظهر الختم تلقائياً في جميع الفواتير المُصدرة
        </p>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none hover:bg-blue-700 transition-all"
      >
        {saving ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            جارٍ الحفظ...
          </>
        ) : (
          <>
            <Save className="w-5 h-5" />
            حفظ المعلومات
          </>
        )}
      </button>

      {/* Info Note */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-200 dark:border-blue-800">
        <p className="text-xs text-blue-700 dark:text-blue-300 text-center">
          <FileText className="w-4 h-4 inline-block ml-1" />
          هذه المعلومات ستظهر في رأس الفواتير عند الطباعة أو التصدير كـ PDF
        </p>
      </div>
    </div>
  );
};

export default LegalInfoTab;
