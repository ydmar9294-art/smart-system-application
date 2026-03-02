/**
 * Version Management Panel - Developer-controlled app version management
 * Supports unlimited Android versions with X.X format validation.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Smartphone, Save, Loader2, Plus, Trash2, ToggleLeft, ToggleRight,
  ExternalLink, AlertTriangle, CheckCircle2, Edit2, X
} from 'lucide-react';

interface VersionRecord {
  id: string;
  platform: string;
  version_name: string;
  version_code: number;
  min_required_version: string;
  force_update: boolean;
  update_url: string | null;
  release_notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// X.X format only (e.g. 1.0, 2.3, 10.5)
const VERSION_REGEX = /^\d+\.\d+$/;

function isValidVersion(v: string): boolean {
  return VERSION_REGEX.test(v.trim());
}

const VersionManagement: React.FC = () => {
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // New version form state
  const [newPlatform, setNewPlatform] = useState('android');
  const [newVersionName, setNewVersionName] = useState('');
  const [newVersionCode, setNewVersionCode] = useState(1);
  const [newMinRequired, setNewMinRequired] = useState('1.0');
  const [newForceUpdate, setNewForceUpdate] = useState(false);
  const [newUpdateUrl, setNewUpdateUrl] = useState('');
  const [newReleaseNotes, setNewReleaseNotes] = useState('');

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('app_versions')
      .select('*')
      .order('platform', { ascending: true })
      .order('version_code', { ascending: false });

    if (!error && data) setVersions(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchVersions(); }, [fetchVersions]);

  const handleAddVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    const vName = newVersionName.trim();
    const minReq = newMinRequired.trim();

    if (!vName) return;

    // Validate X.X format
    if (!isValidVersion(vName)) {
      showToast('صيغة الإصدار يجب أن تكون X.X (مثال: 1.0, 2.3)', 'error');
      return;
    }
    if (!isValidVersion(minReq)) {
      showToast('صيغة أدنى إصدار يجب أن تكون X.X (مثال: 1.0)', 'error');
      return;
    }

    setSaving('new');
    const { error } = await supabase.from('app_versions').insert({
      platform: newPlatform,
      version_name: vName,
      version_code: newVersionCode,
      min_required_version: minReq,
      force_update: newForceUpdate,
      update_url: newUpdateUrl.trim() || null,
      release_notes: newReleaseNotes.trim() || null,
      is_active: true,
    });

    if (error) {
      showToast('فشل إضافة الإصدار: ' + error.message, 'error');
    } else {
      showToast('تمت إضافة الإصدار بنجاح', 'success');
      setShowAddForm(false);
      setNewVersionName('');
      setNewVersionCode(prev => prev + 1);
      setNewMinRequired('1.0');
      setNewForceUpdate(false);
      setNewUpdateUrl('');
      setNewReleaseNotes('');
      fetchVersions();
    }
    setSaving(null);
  };

  const toggleForceUpdate = async (id: string, currentValue: boolean) => {
    setSaving(id);
    const { error } = await supabase
      .from('app_versions')
      .update({ force_update: !currentValue, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      showToast('فشل التحديث', 'error');
    } else {
      setVersions(v => v.map(ver => ver.id === id ? { ...ver, force_update: !currentValue } : ver));
      showToast(!currentValue ? 'تم تفعيل التحديث الإجباري' : 'تم إلغاء التحديث الإجباري', 'success');
    }
    setSaving(null);
  };

  const toggleActive = async (id: string, currentValue: boolean) => {
    setSaving(id);
    const { error } = await supabase
      .from('app_versions')
      .update({ is_active: !currentValue, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      showToast('فشل التحديث', 'error');
    } else {
      setVersions(v => v.map(ver => ver.id === id ? { ...ver, is_active: !currentValue } : ver));
      showToast(!currentValue ? 'تم تفعيل الإصدار' : 'تم تعطيل الإصدار', 'success');
    }
    setSaving(null);
  };

  const updateField = async (id: string, field: string, value: string) => {
    // Validate version fields
    if ((field === 'min_required_version' || field === 'version_name') && !isValidVersion(value)) {
      showToast('صيغة الإصدار يجب أن تكون X.X', 'error');
      return;
    }

    setSaving(id);
    const { error } = await supabase
      .from('app_versions')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      showToast('فشل التحديث', 'error');
    } else {
      setVersions(v => v.map(ver => ver.id === id ? { ...ver, [field]: value } : ver));
      showToast('تم التحديث بنجاح', 'success');
    }
    setSaving(null);
  };

  const deleteVersion = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الإصدار؟')) return;
    setSaving(id);
    const { error } = await supabase.from('app_versions').delete().eq('id', id);
    if (error) {
      showToast('فشل الحذف', 'error');
    } else {
      setVersions(v => v.filter(ver => ver.id !== id));
      showToast('تم حذف الإصدار', 'success');
    }
    setSaving(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[999] px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg flex items-center gap-2 animate-fade-in ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-destructive text-destructive-foreground'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="font-black text-foreground flex items-center gap-2">
          <Smartphone size={18} className="text-primary" /> إدارة الإصدارات
        </h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-bold text-xs flex items-center gap-1 active:scale-95 transition-all"
        >
          <Plus size={14} /> إصدار جديد
        </button>
      </div>

      {/* Format hint */}
      <p className="text-[10px] text-muted-foreground font-bold bg-muted/50 px-3 py-2 rounded-xl flex items-center gap-1">
        <AlertTriangle size={10} className="text-amber-500 shrink-0" />
        صيغة الإصدار المطلوبة: X.X (مثال: 1.0 / 2.3 / 10.5) — غير مسموح بصيغة X.X.X
      </p>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-muted/50 rounded-2xl p-4 border space-y-3">
          <h4 className="font-bold text-foreground text-sm">إضافة إصدار جديد</h4>
          <form onSubmit={handleAddVersion} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground block mb-1">المنصة</label>
                <select value={newPlatform} onChange={e => setNewPlatform(e.target.value)}
                  className="input-field !py-2 text-sm">
                  <option value="android">Android</option>
                  <option value="ios">iOS</option>
                  <option value="web">Web</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground block mb-1">رقم الإصدار (X.X)</label>
                <input value={newVersionName} onChange={e => setNewVersionName(e.target.value)}
                  placeholder="1.0" className="input-field !py-2 text-sm" required dir="ltr" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground block mb-1">كود الإصدار</label>
                <input type="number" value={newVersionCode} onChange={e => setNewVersionCode(Number(e.target.value))}
                  className="input-field !py-2 text-sm" min={1} dir="ltr" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground block mb-1">أدنى إصدار (X.X)</label>
                <input value={newMinRequired} onChange={e => setNewMinRequired(e.target.value)}
                  placeholder="1.0" className="input-field !py-2 text-sm" dir="ltr" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground block mb-1">رابط التحديث</label>
              <input value={newUpdateUrl} onChange={e => setNewUpdateUrl(e.target.value)}
                placeholder="https://play.google.com/store/apps/..." className="input-field !py-2 text-sm" dir="ltr" />
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground block mb-1">ملاحظات الإصدار</label>
              <textarea value={newReleaseNotes} onChange={e => setNewReleaseNotes(e.target.value)}
                placeholder="ما الجديد في هذا الإصدار..." rows={2}
                className="input-field !py-2 text-sm resize-none" />
            </div>

            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setNewForceUpdate(!newForceUpdate)}
                className="flex items-center gap-2 text-sm font-bold">
                {newForceUpdate 
                  ? <ToggleRight size={24} className="text-destructive" /> 
                  : <ToggleLeft size={24} className="text-muted-foreground" />}
                <span className={newForceUpdate ? 'text-destructive' : 'text-muted-foreground'}>
                  تحديث إجباري
                </span>
              </button>
            </div>

            <div className="flex gap-2">
              <button type="submit" disabled={saving === 'new'}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                {saving === 'new' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                حفظ
              </button>
              <button type="button" onClick={() => setShowAddForm(false)}
                className="px-5 py-2.5 bg-muted text-muted-foreground rounded-xl font-bold text-sm">
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Version Cards */}
      {versions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-bold">لا توجد إصدارات مسجلة</p>
          <p className="text-sm mt-1">أضف إصدار جديد للبدء</p>
        </div>
      ) : (
        <div className="space-y-3">
          {versions.map((ver) => (
            <VersionCard
              key={ver.id}
              version={ver}
              saving={saving === ver.id}
              onToggleForce={() => toggleForceUpdate(ver.id, ver.force_update)}
              onToggleActive={() => toggleActive(ver.id, ver.is_active)}
              onUpdateField={(field, value) => updateField(ver.id, field, value)}
              onDelete={() => deleteVersion(ver.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================
// Version Card Component
// ============================================
const VersionCard: React.FC<{
  version: VersionRecord;
  saving: boolean;
  onToggleForce: () => void;
  onToggleActive: () => void;
  onUpdateField: (field: string, value: string) => void;
  onDelete: () => void;
}> = ({ version, saving, onToggleForce, onToggleActive, onUpdateField, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [editUrl, setEditUrl] = useState(version.update_url || '');
  const [editMinVersion, setEditMinVersion] = useState(version.min_required_version);
  const [editNotes, setEditNotes] = useState(version.release_notes || '');

  const handleSaveEdit = () => {
    if (editMinVersion.trim() && !isValidVersion(editMinVersion.trim())) {
      alert('صيغة أدنى إصدار يجب أن تكون X.X');
      return;
    }
    onUpdateField('update_url', editUrl.trim());
    onUpdateField('min_required_version', editMinVersion.trim());
    onUpdateField('release_notes', editNotes.trim());
    setEditing(false);
  };

  const platformLabel = version.platform === 'android' ? 'Android' : version.platform === 'ios' ? 'iOS' : 'Web';
  const platformColor = version.platform === 'android' ? 'bg-green-500/10 text-green-600 dark:text-green-400' : version.platform === 'ios' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-purple-500/10 text-purple-600 dark:text-purple-400';

  return (
    <div className={`p-4 rounded-2xl border transition-all ${!version.is_active ? 'opacity-50 border-border bg-muted/30' : version.force_update ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-card'}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${platformColor}`}>
            {platformLabel}
          </span>
          <span className="font-black text-foreground text-sm" dir="ltr">v{version.version_name}</span>
          <span className="text-[10px] text-muted-foreground">(code: {version.version_code})</span>
          {!version.is_active && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">معطّل</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {saving && <Loader2 size={14} className="animate-spin text-primary" />}
          <button onClick={() => setEditing(!editing)} className="text-xs text-primary font-bold px-2 py-1 rounded-lg hover:bg-primary/10">
            {editing ? <X size={14} /> : <Edit2 size={14} />}
          </button>
          <button onClick={onDelete} className="text-xs text-destructive font-bold p-1 rounded-lg hover:bg-destructive/10">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Toggle row */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <button onClick={onToggleForce} className="flex items-center gap-1.5 text-xs font-bold">
          {version.force_update 
            ? <ToggleRight size={22} className="text-destructive" />
            : <ToggleLeft size={22} className="text-muted-foreground" />}
          <span className={version.force_update ? 'text-destructive' : 'text-muted-foreground'}>إجباري</span>
        </button>
        <button onClick={onToggleActive} className="flex items-center gap-1.5 text-xs font-bold">
          {version.is_active 
            ? <ToggleRight size={22} className="text-green-600 dark:text-green-400" />
            : <ToggleLeft size={22} className="text-muted-foreground" />}
          <span className={version.is_active ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
            {version.is_active ? 'مفعّل' : 'معطّل'}
          </span>
        </button>
      </div>

      {/* Info */}
      <div className="text-xs space-y-1 text-muted-foreground">
        <div className="flex justify-between">
          <span>أدنى إصدار</span>
          <span className="font-bold text-foreground" dir="ltr">{version.min_required_version}</span>
        </div>
        {version.update_url && (
          <div className="flex justify-between items-center">
            <span>رابط التحديث</span>
            <a href={version.update_url} target="_blank" rel="noopener noreferrer"
              className="text-primary flex items-center gap-1 font-bold truncate max-w-[150px]">
              فتح <ExternalLink size={10} />
            </a>
          </div>
        )}
        {version.release_notes && (
          <p className="text-[10px] mt-1 bg-muted/50 p-2 rounded-lg">{version.release_notes}</p>
        )}
        <div className="flex justify-between pt-1 text-[9px]">
          <span>أنشئ: {new Date(version.created_at).toLocaleDateString('ar-EG')}</span>
          <span>آخر تعديل: {new Date(version.updated_at).toLocaleDateString('ar-EG')}</span>
        </div>
      </div>

      {/* Edit Form */}
      {editing && (
        <div className="mt-3 pt-3 border-t space-y-2">
          <div>
            <label className="text-[10px] font-bold text-muted-foreground">أدنى إصدار (X.X)</label>
            <input value={editMinVersion} onChange={e => setEditMinVersion(e.target.value)}
              className="input-field !py-2 text-xs mt-1" dir="ltr" placeholder="1.0" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground">رابط التحديث</label>
            <input value={editUrl} onChange={e => setEditUrl(e.target.value)}
              className="input-field !py-2 text-xs mt-1" dir="ltr" placeholder="https://..." />
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground">ملاحظات الإصدار</label>
            <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)}
              className="input-field !py-2 text-xs mt-1 resize-none" rows={2} />
          </div>
          <button onClick={handleSaveEdit}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-xs flex items-center justify-center gap-1">
            <Save size={14} /> حفظ التعديلات
          </button>
        </div>
      )}
    </div>
  );
};

export default VersionManagement;
