import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import AnimatedTabContent from '@/components/ui/AnimatedTabContent';
import { createPortal } from 'react-dom';
import { copyToClipboard } from '@/lib/clipboard';
import { useApp } from '@/store/AppContext';
import { LicenseStatus, OrgStats } from '@/types';
import { sanitizeText, sanitizePhone } from '@/lib/validation';
import VersionManagement from './VersionManagement';
import OrgDeletionManager from './OrgDeletionManager';
import SubscriptionsTab from './SubscriptionsTab';

import {
  ShieldCheck, Key, UserPlus, LogOut,
  Copy, CheckCircle2,
  Clock, Lock, Unlock, Activity,
  Users, Package, ShoppingCart, Truck,
  BarChart3, AlertTriangle, Phone, Edit2, Save, X, Smartphone, Trash2
} from 'lucide-react';

// ============================================
// Tab definitions
// ============================================
type TabId = 'licenses' | 'subscriptions' | 'stats' | 'versions' | 'deletion';

const TABS: { id: TabId; label: string; icon: React.ElementType; bgColor: string }[] = [
  { id: 'licenses', label: 'التراخيص', icon: Key, bgColor: 'bg-primary' },
  { id: 'subscriptions', label: 'الاشتراكات', icon: Activity, bgColor: 'bg-amber-600' },
  { id: 'stats', label: 'إحصائيات', icon: BarChart3, bgColor: 'bg-emerald-600' },
  { id: 'versions', label: 'الإصدارات', icon: Smartphone, bgColor: 'bg-purple-600' },
  { id: 'deletion', label: 'الحذف', icon: Trash2, bgColor: 'bg-red-500' },
];

const DeveloperHub: React.FC = () => {
  const {
    licenses, issueLicense, updateLicenseStatus,
    updateLicenseMaxEmployees, orgStats, refreshOrgStats, logout
  } = useApp();

  const [activeTab, setActiveTab] = useState<TabId>('licenses');
  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [licenseType] = useState<'TRIAL'>('TRIAL');
  const [editingLimit, setEditingLimit] = useState<string | null>(null);
  const [newLimit, setNewLimit] = useState<number>(10);

  useEffect(() => {
    refreshOrgStats();
  }, [refreshOrgStats]);

  const copyKey = async (key: string) => {
    await copyToClipboard(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleIssueLicense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const orgName = sanitizeText(fd.get('org') as string);
    const days = Number(fd.get('days') || 30);
    const maxEmployees = Number(fd.get('maxEmployees') || 10);
    const ownerPhone = sanitizePhone(fd.get('ownerPhone') as string || '');

    if (!orgName || orgName.length < 2) {
      alert('اسم المنشأة يجب أن يكون حرفين على الأقل');
      return;
    }
    if (maxEmployees < 1 || maxEmployees > 500) {
      alert('عدد الموظفين يجب أن يكون بين 1 و 500');
      return;
    }
    if (days < 1 || days > 365) {
      alert('عدد أيام التجربة يجب أن يكون بين 1 و 365');
      return;
    }
    try {
      await issueLicense(orgName, 'TRIAL', days, maxEmployees, ownerPhone || undefined);
      setShowForm(false);
      refreshOrgStats();
    } catch (err) {
      console.error('License issue failed:', err);
    }
  };

  const handleUpdateLimit = async (licenseId: string) => {
    if (newLimit < 1 || newLimit > 500) {
      alert('عدد الموظفين يجب أن يكون بين 1 و 500');
      return;
    }
    try {
      await updateLicenseMaxEmployees(licenseId, newLimit);
      setEditingLimit(null);
      refreshOrgStats();
    } catch (err) {
      console.error('Update limit failed:', err);
    }
  };

  const getStatsForLicense = (orgName: string): OrgStats | undefined => {
    return orgStats.find(s => s.org_name === orgName);
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="max-w-2xl mx-auto">
        {/* ===== Header ===== */}
        <div className="bg-background pt-4 px-4 relative">
          <div className="flex justify-center pt-4 mb-3">
            <div className="flex items-center gap-3 card-elevated px-5 py-2.5 !rounded-full shadow-sm">
              <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="text-end">
                <p className="font-black text-foreground text-sm">مركز المطور</p>
                <p className="text-[10px] text-muted-foreground">إدارة التراخيص السحابية</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            {activeTab === 'licenses' && (
              <button
                onClick={() => setShowForm(true)}
                className="btn-primary px-4 py-2.5 text-xs flex items-center gap-1.5"
              >
                <UserPlus size={14} /> إصدار ترخيص
              </button>
            )}
            {activeTab !== 'licenses' && <div />}
            <button
              onClick={logout}
              className="btn-logout !px-3 !py-2.5 !rounded-2xl text-muted-foreground hover:text-destructive"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* ===== Tab Bar — matches DistributorDashboard pattern ===== */}
        <div className="px-4 pb-3">
          <div className="card-elevated p-2 !rounded-3xl flex gap-1">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl transition-all duration-300 ${
                    isActive
                      ? `${tab.bgColor} text-white shadow-lg`
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <div className={`${isActive ? 'scale-110' : ''} transition-transform duration-300`}>
                    <Icon size={20} />
                  </div>
                  <span className="text-[10px] font-bold">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ===== Tab Content ===== */}
        <div
          className="px-4 pb-8"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 16px), 2rem)' }}
        >
          <AnimatedTabContent tabKey={activeTab}>
            {activeTab === 'licenses' && (
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
            )}
            {activeTab === 'subscriptions' && <SubscriptionsTab />}
            {activeTab === 'stats' && <StatsTab orgStats={orgStats} />}
            {activeTab === 'versions' && <VersionManagement />}
            {activeTab === 'deletion' && <OrgDeletionManager />}
          </AnimatedTabContent>
        </div>
      </div>

      {/* ===== Issue License Modal ===== */}
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
                <label className="text-xs font-bold text-muted-foreground block mb-1">الحد الأقصى للموظفين (1-500)</label>
                <input name="maxEmployees" type="number" defaultValue="10" min={1} max={500} className="input-field" />
              </div>
              <button type="submit" className="btn-primary w-full py-3.5 text-sm">توليد الترخيص التجريبي</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary w-full py-3.5 text-sm">إلغاء</button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// ============================================
// Licenses Tab (extracted)
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
  updateLicenseStatus
}) => {
  const [editingOrgName, setEditingOrgName] = useState<string | null>(null);
  const [newOrgName, setNewOrgName] = useState('');
  const [savingOrgName, setSavingOrgName] = useState(false);

  const handleUpdateOrgName = async (license: any) => {
    if (!newOrgName.trim() || newOrgName.trim().length < 2) return;
    setSavingOrgName(true);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      // Update organization name
      if (license.organizationId) {
        await supabase.from('organizations').update({ name: newOrgName.trim() }).eq('id', license.organizationId);
      }
      // Update license orgName
      await supabase.from('developer_licenses').update({ orgName: newOrgName.trim() }).eq('id', license.id);
      setEditingOrgName(null);
      // Force refresh
      window.location.reload();
    } catch (err) {
      console.error('Failed to update org name:', err);
    } finally {
      setSavingOrgName(false);
    }
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
            {/* Status + Type */}
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
            
            {/* Editable Org Name */}
            {editingOrgName === license.id ? (
              <div className="flex items-center gap-2 mb-2">
                <input 
                  type="text" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-border text-sm bg-background text-foreground font-bold"
                  placeholder="اسم المنشأة الجديد" autoFocus
                />
                <button onClick={() => handleUpdateOrgName(license)} disabled={savingOrgName}
                  className="text-primary"><Save size={16}/></button>
                <button onClick={() => setEditingOrgName(null)} className="text-muted-foreground"><X size={16}/></button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-black text-foreground text-base">{license.orgName}</h3>
                <button onClick={() => { setEditingOrgName(license.id); setNewOrgName(license.orgName); }} 
                  className="text-muted-foreground hover:text-primary"><Edit2 size={14}/></button>
              </div>
            )}
            
            {/* Employee limit */}
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
                    الحد: <span className="text-foreground">{license.maxEmployees}</span>
                    {stats && <span> ({stats.employee_count} نشط)</span>}
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
            
            {/* License Key */}
            <div onClick={() => copyKey(license.licenseKey)} className="glass-surface p-3 rounded-2xl flex justify-between items-center cursor-pointer hover:opacity-80 transition-all mb-3 group">
              <span className="font-mono font-black text-primary tracking-wider text-xs break-all">{license.licenseKey}</span>
              {copied === license.licenseKey ? <CheckCircle2 size={14} className="text-success shrink-0" /> : <Copy size={14} className="text-muted-foreground group-hover:text-primary shrink-0" />}
            </div>

            {/* Action buttons */}
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
// Stats Tab (extracted)
// ============================================
const StatsTab: React.FC<{ orgStats: OrgStats[] }> = ({ orgStats }) => {
  if (orgStats.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-bold">لا توجد بيانات</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orgStats.map((stat) => (
        <div key={stat.org_id} className="card-elevated p-4 space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h3 className="font-black text-base text-foreground">{stat.org_name}</h3>
            <span className={`badge ${
              stat.license_status === 'ACTIVE' ? 'badge-success' :
              stat.license_status === 'SUSPENDED' ? 'badge-danger' : ''
            }`}>
              {stat.license_status === 'ACTIVE' ? 'مفعل' : stat.license_status === 'SUSPENDED' ? 'موقوف' : stat.license_status || 'بدون'}
            </span>
          </div>

          {/* Employee usage bar */}
          <div>
            <div className="flex justify-between text-xs font-bold text-muted-foreground mb-1">
              <span className="flex items-center gap-1"><Users size={12}/> الموظفون</span>
              <span>{stat.employee_count} / {stat.max_employees}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all ${stat.employee_count >= stat.max_employees ? 'bg-destructive' : stat.employee_count >= stat.max_employees * 0.8 ? 'bg-warning' : 'bg-primary'}`}
                style={{ width: `${Math.min(100, (stat.employee_count / stat.max_employees) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">
              نشط: {stat.employee_count} | معلّق: {stat.pending_employees} | إجمالي: {stat.total_users}
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: ShoppingCart, label: 'المبيعات', value: stat.total_sales },
              { icon: Package, label: 'المنتجات', value: stat.total_products },
              { icon: Users, label: 'العملاء', value: stat.total_customers },
              { icon: Truck, label: 'التسليمات', value: stat.total_deliveries },
              { icon: ShoppingCart, label: 'المشتريات', value: stat.total_purchases },
              { icon: Activity, label: 'التحصيلات', value: stat.total_collections },
            ].map((item, i) => (
              <div key={i} className="glass-surface p-2 rounded-2xl text-center">
                <item.icon size={13} className="text-muted-foreground mx-auto mb-0.5" />
                <p className="text-sm font-black text-foreground">{item.value.toLocaleString('ar-EG')}</p>
                <p className="text-[8px] text-muted-foreground font-bold">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap justify-between text-xs border-t border-border pt-2 gap-2">
            <span className="font-bold text-muted-foreground">الإيرادات: <span className="text-foreground">{Number(stat.total_revenue).toLocaleString('ar-EG')} ل.س</span></span>
            <span className="font-bold text-muted-foreground">السجلات: <span className="text-foreground">{stat.total_records.toLocaleString('ar-EG')}</span></span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DeveloperHub;
