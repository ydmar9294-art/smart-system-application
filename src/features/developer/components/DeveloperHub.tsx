import React, { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
import AnimatedTabContent from '@/components/ui/AnimatedTabContent';
import { createPortal } from 'react-dom';
import { copyToClipboard } from '@/lib/clipboard';
import { useApp } from '@/store/AppContext';
import { LicenseStatus, OrgStats } from '@/types';
import { sanitizeText, sanitizePhone } from '@/lib/validation';
import { useAppSettingsAdmin } from '@/hooks/useAppSettings';
import VersionManagement from './VersionManagement';
import OrgDeletionManager from './OrgDeletionManager';
import SubscriptionsTab from './SubscriptionsTab';
import MonitoringTab from './MonitoringTab';

import {
  ShieldCheck, Key, UserPlus,
  Copy, CheckCircle2,
  Clock, Lock, Unlock, Activity,
  Users, BarChart3, AlertTriangle, Phone, Edit2, Save, X, Smartphone, Trash2, Settings as SettingsIcon, Wallet,
  User, MessageCircle,
} from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import {
  AppHeader,
  AppBottomNav,
  AppSettingsSheet,
  AppSubPageSheet,
  type BottomNavItem,
  type SettingsItem,
} from '@/components/shell';

type DevPrimaryTab = 'licenses' | 'subscriptions' | 'monitoring' | 'versions';
type DevSubPage = 'settings' | 'deletion';
type DevTabType = DevPrimaryTab | DevSubPage;

const DeveloperHub: React.FC = () => {
  const {
    licenses, issueLicense, updateLicenseStatus,
    updateLicenseMaxEmployees, orgStats, refreshOrgStats, logout,
  } = useApp();

  const [activeTab, setActiveTab] = useState<DevTabType>('licenses');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [subPage, setSubPage] = useState<DevSubPage | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [editingLimit, setEditingLimit] = useState<string | null>(null);
  const [newLimit, setNewLimit] = useState<number>(10);

  useEffect(() => { refreshOrgStats(); }, [refreshOrgStats]);

  const copyKey = async (key: string) => {
    await copyToClipboard(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await logout(); } finally { setLoggingOut(false); }
  };

  const handleIssueLicense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const orgName = sanitizeText(fd.get('org') as string);
    const days = Number(fd.get('days') || 30);
    const maxEmployees = Number(fd.get('maxEmployees') || 10);
    const ownerPhone = sanitizePhone(fd.get('ownerPhone') as string || '');

    if (!orgName || orgName.length < 2) { alert('اسم المنشأة يجب أن يكون حرفين على الأقل'); return; }
    if (maxEmployees < 1 || maxEmployees > 500) { alert('عدد الموزعين يجب أن يكون بين 1 و 500'); return; }
    if (days < 1 || days > 365) { alert('عدد أيام التجربة يجب أن يكون بين 1 و 365'); return; }
    try {
      await issueLicense(orgName, 'TRIAL', days, maxEmployees, ownerPhone || undefined);
      setShowForm(false);
      refreshOrgStats();
    } catch { logger.error('License issue failed', 'DeveloperHub'); }
  };

  const handleUpdateLimit = async (licenseId: string) => {
    if (newLimit < 1 || newLimit > 500) { alert('عدد الموزعين يجب أن يكون بين 1 و 500'); return; }
    try {
      await updateLicenseMaxEmployees(licenseId, newLimit);
      setEditingLimit(null);
      refreshOrgStats();
    } catch { logger.error('Update limit failed', 'DeveloperHub'); }
  };

  const getStatsForLicense = (orgName: string): OrgStats | undefined =>
    orgStats.find(s => s.org_name === orgName);

  const navItems: BottomNavItem<DevPrimaryTab>[] = [
    { id: 'licenses',      label: 'التراخيص',  icon: Key },
    { id: 'subscriptions', label: 'الاشتراكات', icon: Activity },
    { id: 'monitoring',    label: 'مراقبة',    icon: BarChart3 },
    { id: 'versions',      label: 'الإصدارات', icon: Smartphone },
  ];

  const settingsItems: SettingsItem<DevSubPage>[] = [
    { id: 'settings', label: 'إعدادات النظام', Icon: SettingsIcon, color: 'text-sky-600',  bg: 'bg-sky-500/10' },
    { id: 'deletion', label: 'طلبات الحذف',    Icon: Trash2,       color: 'text-rose-600', bg: 'bg-rose-500/10' },
  ];

  const subPageTitle = settingsItems.find(i => i.id === subPage)?.label ?? '';

  const renderPrimaryContent = () => {
    switch (activeTab) {
      case 'licenses':
        return (
          <div className="space-y-3">
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
            >
              <UserPlus size={16} /> إصدار ترخيص تجريبي
            </button>
            <LicensesTab
              licenses={licenses}
              editingLimit={editingLimit}
              newLimit={newLimit}
              copied={copied}
              getStatsForLicense={getStatsForLicense}
              setEditingLimit={setEditingLimit}
              setNewLimit={setNewLimit}
              handleUpdateLimit={handleUpdateLimit}
              copyKey={copyKey}
              updateLicenseStatus={updateLicenseStatus}
            />
          </div>
        );
      case 'subscriptions': return <SubscriptionsTab />;
      case 'monitoring':    return <MonitoringTab />;
      case 'versions':      return <VersionManagement />;
      default: return null;
    }
  };

  const renderSubPage = () => {
    switch (subPage) {
      case 'settings': return <SettingsTab />;
      case 'deletion': return <OrgDeletionManager />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader
        title="مركز المطور"
        subtitle="إدارة التراخيص السحابية"
        Icon={ShieldCheck}
      />

      <div className="max-w-2xl mx-auto">
        <div
          className="px-3 pt-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
        >
          <AnimatedTabContent tabKey={activeTab}>{renderPrimaryContent()}</AnimatedTabContent>
        </div>
      </div>

      <AppBottomNav
        items={navItems}
        active={activeTab as any}
        onChange={(id) => setActiveTab(id as DevPrimaryTab)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <AppSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        items={settingsItems}
        onOpenItem={(id) => { setSettingsOpen(false); setSubPage(id); }}
        onLogout={handleLogout}
        loggingOut={loggingOut}
      />

      <AppSubPageSheet
        open={subPage !== null}
        onClose={() => setSubPage(null)}
        title={subPageTitle}
      >
        {renderSubPage()}
      </AppSubPageSheet>

      {/* Issue License Modal */}
      {showForm && createPortal(
        <div className="modal-overlay safe-area-x safe-area-bottom" dir="rtl">
          <div className="card-elevated w-full max-w-md p-5 space-y-5 animate-zoom-in max-h-[90vh] overflow-y-auto mx-4">
            <h3 className="text-lg font-black text-foreground">إصدار ترخيص تجريبي جديد</h3>
            <p className="text-xs text-muted-foreground">بعد انتهاء الفترة التجريبية، يمكنك إنشاء اشتراك من تبويب "الاشتراكات"</p>
            <form onSubmit={handleIssueLicense} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">اسم المنشأة *</label>
                <input name="org" required minLength={2} maxLength={100} placeholder="اسم المنشأة" className="input-field" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">رقم هاتف المالك</label>
                <input name="ownerPhone" type="tel" placeholder="05xxxxxxxx" className="input-field" dir="ltr" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">عدد أيام التجربة (1-365)</label>
                <input name="days" type="number" defaultValue="30" min={1} max={365} className="input-field" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">الحد الأقصى للموزعين (1-500)</label>
                <input name="maxEmployees" type="number" defaultValue="3" min={1} max={500} className="input-field" />
                <p className="text-[10px] text-muted-foreground mt-1">يطبَّق على الموزعين الميدانيين فقط. المحاسبون وأمناء المستودعات بدون حد.</p>
              </div>
              <button type="submit" className="btn-primary w-full py-3.5 text-sm">توليد الترخيص التجريبي</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary w-full py-3.5 text-sm">إلغاء</button>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

// ============================================
// Licenses Tab (preserved as-is)
// ============================================
interface LicensesTabProps {
  licenses: any[];
  editingLimit: string | null;
  newLimit: number;
  copied: string | null;
  getStatsForLicense: (orgName: string) => OrgStats | undefined;
  setEditingLimit: (id: string | null) => void;
  setNewLimit: (n: number) => void;
  handleUpdateLimit: (id: string) => void;
  copyKey: (key: string) => void;
  updateLicenseStatus: (id: string, ownerId: string | null, status: LicenseStatus) => void;
}

const LicensesTab: React.FC<LicensesTabProps> = ({
  licenses, editingLimit, newLimit, copied, getStatsForLicense,
  setEditingLimit, setNewLimit, handleUpdateLimit, copyKey,
  updateLicenseStatus,
}) => {
  const [editingOrgName, setEditingOrgName] = useState<string | null>(null);
  const [newOrgName, setNewOrgName] = useState('');
  const [savingOrgName, setSavingOrgName] = useState(false);

  const handleUpdateOrgName = async (license: any) => {
    if (!newOrgName.trim() || newOrgName.trim().length < 2) return;
    setSavingOrgName(true);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      if (license.organizationId) {
        await supabase.from('organizations').update({ name: newOrgName.trim() }).eq('id', license.organizationId);
      }
      await supabase.from('developer_licenses').update({ orgName: newOrgName.trim() }).eq('id', license.id);
      setEditingOrgName(null);
      window.location.reload();
    } catch { logger.error('Failed to update org name', 'DeveloperHub'); }
    finally { setSavingOrgName(false); }
  };

  if (licenses.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Key className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-bold">لا توجد تراخيص</p>
        <p className="text-sm mt-1">اضغط "إصدار ترخيص" لإنشاء ترخيص جديد</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {licenses.map((license) => {
        const stats = getStatsForLicense(license.orgName);
        return (
          <div key={license.id} className={`card-elevated p-4 transition-all ${license.status === LicenseStatus.SUSPENDED ? 'ring-2 ring-destructive/20' : ''}`}>
            <div className="flex justify-between items-start mb-3">
              <span className={`badge ${
                license.status === LicenseStatus.ACTIVE ? 'badge-success' :
                license.status === LicenseStatus.READY ? 'badge-primary' : 'badge-danger'
              }`}>
                {license.status === LicenseStatus.ACTIVE ? 'مفعل' : license.status === LicenseStatus.READY ? 'جاهز' : 'موقوف'}
              </span>
              <span className="text-[10px] font-black text-muted-foreground flex items-center gap-1">
                {license.type === 'TRIAL' ? <Clock size={12}/> : <Activity size={12}/>}
                {license.type === 'TRIAL' ? 'تجريبي' : 'اشتراك'}
              </span>
            </div>
            {editingOrgName === license.id ? (
              <div className="flex items-center gap-2 mb-2">
                <input type="text" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-border text-sm bg-background text-foreground font-bold"
                  placeholder="اسم المنشأة الجديد" autoFocus />
                <button onClick={() => handleUpdateOrgName(license)} disabled={savingOrgName} className="text-primary"><Save size={16}/></button>
                <button onClick={() => setEditingOrgName(null)} className="text-muted-foreground"><X size={16}/></button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-black text-foreground text-base">{license.orgName}</h3>
                <button onClick={() => { setEditingOrgName(license.id); setNewOrgName(license.orgName); }}
                  className="text-muted-foreground hover:text-primary"><Edit2 size={14}/></button>
              </div>
            )}
            <div className="flex items-center gap-2 mb-2 text-xs">
              <Users size={12} className="text-muted-foreground" />
              {editingLimit === license.id ? (
                <div className="flex items-center gap-1">
                  <input type="number" min={1} max={500} value={newLimit}
                    onChange={(e) => setNewLimit(Number(e.target.value))}
                    className="w-16 px-2 py-1 rounded-xl border border-border text-xs text-center bg-background text-foreground" />
                  <button onClick={() => handleUpdateLimit(license.id)} className="text-primary"><Save size={14}/></button>
                  <button onClick={() => setEditingLimit(null)} className="text-muted-foreground"><X size={14}/></button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="font-bold text-muted-foreground">
                    حد الموزعين: <span className="text-foreground">{license.maxEmployees}</span>
                    {stats && <span> ({stats.employee_count} موزع نشط)</span>}
                  </span>
                  <button onClick={() => { setEditingLimit(license.id); setNewLimit(license.maxEmployees); }} className="text-muted-foreground hover:text-primary"><Edit2 size={12}/></button>
                </div>
              )}
            </div>
            {license.ownerPhone && (
              <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                <Phone size={12} />
                <span className="font-bold">{license.ownerPhone}</span>
              </div>
            )}
            {license.isSelfServiceTrial && (
              <div className="mb-2 p-2.5 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase tracking-wider">
                  <div className="w-3 h-3 overflow-hidden rounded-sm"><AppLogo size={11} /></div>
                  <span>تجريبي ذاتي (15 يوم)</span>
                </div>
                {license.ownerFullName && (
                  <div className="text-[11px] text-foreground font-bold flex items-center gap-1.5">
                    <User size={11} className="text-muted-foreground" />
                    {license.ownerFullName}
                  </div>
                )}
                {license.distributorsCount !== undefined && (
                  <div className="text-[11px] text-foreground font-bold flex items-center gap-1.5">
                    <Users size={11} className="text-muted-foreground" />
                    عدد الموزعين المُصرَّح: <span className="text-primary">{license.distributorsCount}</span>
                  </div>
                )}
                {license.whatsappNumber && (
                  <a
                    href={`https://wa.me/${license.whatsappNumber.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-success font-bold flex items-center gap-1.5 hover:underline"
                    dir="ltr"
                  >
                    <MessageCircle size={11} />
                    {license.whatsappNumber}
                  </a>
                )}
              </div>
            )}
            <div onClick={() => copyKey(license.licenseKey)} className="glass-surface p-3 rounded-2xl flex justify-between items-center cursor-pointer hover:opacity-80 transition-all mb-3 group">
              <span className="font-mono font-black text-primary tracking-wider text-xs break-all">{license.licenseKey}</span>
              {copied === license.licenseKey ? <CheckCircle2 size={14} className="text-success shrink-0" /> : <Copy size={14} className="text-muted-foreground group-hover:text-primary shrink-0" />}
            </div>
            {license.status !== LicenseStatus.READY && (
              <div className="flex gap-2 mb-3">
                {license.status === LicenseStatus.ACTIVE ? (
                  <button onClick={() => updateLicenseStatus(license.id, license.ownerId || null, LicenseStatus.SUSPENDED)} className="flex-1 py-2.5 btn-danger text-[10px] flex items-center justify-center gap-1"><Lock size={14}/> إيقاف</button>
                ) : (
                  <button onClick={() => updateLicenseStatus(license.id, license.ownerId || null, LicenseStatus.ACTIVE)} className="flex-1 py-2.5 btn-success text-[10px] flex items-center justify-center gap-1"><Unlock size={14}/> تفعيل</button>
                )}
              </div>
            )}
            {license.monthlyPrice > 0 && (
              <div className="text-[10px] text-primary font-bold mb-2">
                💰 سعر الشهر: {license.monthlyPrice.toLocaleString()} | نوع: {license.type === 'SUBSCRIPTION' ? 'اشتراك' : license.type === 'TRIAL' ? 'تجريبي' : license.type}
              </div>
            )}
            <div className="text-[9px] text-muted-foreground font-bold border-t border-border pt-2 flex flex-wrap justify-between gap-1">
              <span>أنشئ: {new Date(license.issuedAt).toLocaleDateString('ar-EG')}</span>
              {license.expiryDate && <span>ينتهي: {new Date(license.expiryDate).toLocaleDateString('ar-EG')}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ============================================
// Settings Tab (ShamCash) — preserved as-is
// ============================================
const SettingsTab: React.FC = () => {
  const { shamcashAddress, loading, saving, errorMessage, updateShamcashAddress } = useAppSettingsAdmin();
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleEdit = () => { setDraft(shamcashAddress); setEditMode(true); setSaveSuccess(false); };
  const handleSave = async () => {
    if (!draft.trim()) return;
    const ok = await updateShamcashAddress(draft);
    if (ok) { setEditMode(false); setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000); }
  };
  const handleCopy = async () => { await copyToClipboard(shamcashAddress); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 bg-muted rounded animate-pulse" />
        <div className="h-32 bg-muted rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card-elevated p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-black text-foreground text-sm">عنوان محفظة شام كاش</h3>
            <p className="text-[10px] text-muted-foreground">يظهر في جميع شاشات الدفع تلقائياً</p>
          </div>
          {!editMode && (
            <button onClick={handleEdit} className="p-2 rounded-xl hover:bg-muted transition-colors">
              <Edit2 size={16} className="text-muted-foreground" />
            </button>
          )}
        </div>
        {editMode ? (
          <div className="space-y-3">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="أدخل عنوان المحفظة الجديد"
              className="input-field font-mono text-sm" dir="ltr" autoFocus />
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving || !draft.trim()}
                className="btn-primary flex-1 py-2.5 text-xs flex items-center justify-center gap-1.5 disabled:opacity-50">
                {saving ? <span className="animate-spin">⏳</span> : <Save size={14} />}
                {saving ? 'جارٍ الحفظ...' : 'حفظ'}
              </button>
              <button onClick={() => setEditMode(false)} className="btn-secondary px-4 py-2.5 text-xs flex items-center gap-1.5">
                <X size={14} /> إلغاء
              </button>
            </div>
            {errorMessage && <p className="text-xs font-bold text-destructive">فشل الحفظ: {errorMessage}</p>}
          </div>
        ) : (
          <div className="space-y-2">
            <button onClick={handleCopy}
              className="w-full flex items-center justify-between bg-muted/50 p-3 rounded-xl border border-border hover:border-primary transition-all active:scale-[0.98]">
              <span className="font-mono text-xs text-foreground tracking-wide select-all" dir="ltr">{shamcashAddress}</span>
              {copied ? <CheckCircle2 size={16} className="text-primary flex-shrink-0" /> : <Copy size={16} className="text-muted-foreground flex-shrink-0" />}
            </button>
            {saveSuccess && (
              <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold animate-in fade-in">
                <CheckCircle2 size={14} />
                <span>تم تحديث العنوان بنجاح — سيظهر فوراً في جميع شاشات الدفع</span>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="card-elevated p-4 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800">
        <div className="flex gap-3">
          <AlertTriangle size={16} className="text-sky-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-bold text-sky-800 dark:text-sky-300">ملاحظات هامة</p>
            <ul className="text-[11px] text-sky-700 dark:text-sky-400 space-y-1 list-disc list-inside">
              <li>عند تغيير العنوان، سيتم تحديثه فوراً في جميع واجهات الدفع</li>
              <li>يشمل ذلك: شاشة تفعيل الترخيص + شاشة تجديد الاشتراك</li>
              <li>تأكد من صحة العنوان قبل الحفظ لتجنب خسارة الحوالات</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeveloperHub;
