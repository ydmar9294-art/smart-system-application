import React, { useState, useEffect } from 'react';
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
  Shield
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/store/AppContext';

interface LegalInfo {
  id?: string;
  commercial_registration: string;
  industrial_registration: string;
  tax_identification: string;
  trademark_name: string;
}

const LegalInfoTab: React.FC = () => {
  const { addNotification } = useApp();
  const [legalInfo, setLegalInfo] = useState<LegalInfo>({
    commercial_registration: '',
    industrial_registration: '',
    tax_identification: '',
    trademark_name: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Fetch existing legal info
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

        if (!profile?.organization_id) return;

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
            trademark_name: data.trademark_name || ''
          });
        }
      } catch (err) {
        console.error('Error fetching legal info:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLegalInfo();
  }, []);

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

      if (!profile?.organization_id) throw new Error('لا توجد منشأة');

      const payload = {
        organization_id: profile.organization_id,
        commercial_registration: legalInfo.commercial_registration || null,
        industrial_registration: legalInfo.industrial_registration || null,
        tax_identification: legalInfo.tax_identification || null,
        trademark_name: legalInfo.trademark_name || null
      };

      if (legalInfo.id) {
        // Update existing
        const { error } = await supabase
          .from('organization_legal_info')
          .update(payload)
          .eq('id', legalInfo.id);
        if (error) throw error;
      } else {
        // Insert new
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
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
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
        <div className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl flex items-center gap-2 border border-emerald-200">
          <Check className="w-5 h-5" />
          <span className="font-bold">تم الحفظ بنجاح!</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-2 border border-red-200">
          <AlertCircle className="w-5 h-5" />
          <span className="font-bold">{error}</span>
        </div>
      )}

      {/* Form Fields */}
      <div className="bg-white rounded-3xl p-5 shadow-sm space-y-4">
        {/* Commercial Registration */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
            <Building2 className="w-4 h-4 text-blue-600" />
            رقم السجل التجاري
          </label>
          <input
            type="text"
            value={legalInfo.commercial_registration}
            onChange={(e) => setLegalInfo(prev => ({ ...prev, commercial_registration: e.target.value }))}
            placeholder="اختياري - مثال: 12345"
            className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            dir="ltr"
          />
        </div>

        {/* Industrial Registration */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
            <Factory className="w-4 h-4 text-emerald-600" />
            رقم السجل الصناعي / القرار الصناعي
          </label>
          <input
            type="text"
            value={legalInfo.industrial_registration}
            onChange={(e) => setLegalInfo(prev => ({ ...prev, industrial_registration: e.target.value }))}
            placeholder="اختياري - مثال: IND-2024-001"
            className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            dir="ltr"
          />
        </div>

        {/* Tax ID */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
            <Receipt className="w-4 h-4 text-orange-600" />
            الرقم الضريبي
          </label>
          <input
            type="text"
            value={legalInfo.tax_identification}
            onChange={(e) => setLegalInfo(prev => ({ ...prev, tax_identification: e.target.value }))}
            placeholder="اختياري - مثال: TAX-123456789"
            className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            dir="ltr"
          />
        </div>

        {/* Trademark */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
            <Tag className="w-4 h-4 text-purple-600" />
            العلامة التجارية المسجلة
          </label>
          <input
            type="text"
            value={legalInfo.trademark_name}
            onChange={(e) => setLegalInfo(prev => ({ ...prev, trademark_name: e.target.value }))}
            placeholder="اختياري - اسم العلامة التجارية"
            className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          />
        </div>
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
      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200">
        <p className="text-xs text-blue-700 text-center">
          <FileText className="w-4 h-4 inline-block ml-1" />
          هذه المعلومات ستظهر في رأس الفواتير عند الطباعة أو التصدير كـ PDF
        </p>
      </div>
    </div>
  );
};

export default LegalInfoTab;
