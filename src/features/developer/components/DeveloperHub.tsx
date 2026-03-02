import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { copyToClipboard } from '@/lib/clipboard';
import { useApp } from '@/store/AppContext';
import { LicenseStatus, OrgStats } from '@/types';
import { sanitizeText, sanitizePhone } from '@/lib/validation';
import VersionManagement from './VersionManagement';
import OrgDeletionManager from './OrgDeletionManager';

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
type TabId = 'licenses' | 'stats' | 'versions' | 'deletion';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'licenses', label: 'التراخيص', icon: Key },
  { id: 'stats', label: 'إحصائيات', icon: BarChart3 },
  { id: 'versions', label: 'الإصدارات', icon: Smartphone },
  { id: 'deletion', label: 'الحذف', icon: Trash2 },
];

const DeveloperHub: React.FC = () => {
  const {
    licenses, issueLicense, updateLicenseStatus, makeLicensePermanent,
    updateLicenseMaxEmployees, orgStats, refreshOrgStats, logout
  } = useApp();

  const [activeTab, setActiveTab] = useState<TabId>('licenses');
  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [licenseType, setLicenseType] = useState<'TRIAL' | 'PERMANENT'>('TRIAL');
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
    const type = fd.get('type') as 'TRIAL' | 'PERMANENT';
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
    if (type === 'TRIAL' && (days < 1 || days > 365)) {
      alert('عدد أيام التجربة يجب أن يكون بين 1 و 365');
      return;
    }
    try {
      await issueLicense(orgName, type, days, maxEmployees, ownerPhone || undefined);
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
    <div className="flex flex-col h-full min-h-[100dvh] bg-background" dir="rtl">
      {/* ===== Top Header ===== */}
      <div
        className="bg-slate-900 text-white px-4 pt-4 pb-3 flex items-center justify-between shrink-0"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 16px), 16px)' }}
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-primary" size={22} />
          <h1 className="text-lg font-black">لوحة المطور</h1>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'licenses' && (
            <button
              onClick={() => setShowForm(true)}
              className="px-3 py-2 bg-primary rounded-xl font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-transform"
            >
              <UserPlus size={14} /> إصدار
            </button>
          )}
          <button
            onClick={logout}
            className="p-2 bg-white/10 rounded-xl active:scale-95 transition-transform"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* ===== Top Tab Bar ===== */}
      <div className="bg-slate-900 border-b border-white/10 shrink-0">
        <div className="flex overflow-x-auto scrollbar-none">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 min-w-[80px] flex flex-col items-center gap-1 py-2.5 px-2 text-[10px] font-bold transition-colors relative
                  ${isActive ? 'text-primary' : 'text-slate-400'}`}
              >
                <tab.icon size={18} />
                <span>{tab.label}</span>
                {isActive && (
                  <div className="absolute bottom-0 inset-x-3 h-[3px] bg-primary rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== Tab Content (scrollable area) ===== */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 16px), 16px)' }}
      >
        {/* --- Licenses Tab --- */}
        {activeTab === 'licenses' && (
          <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {licenses.map((license) => {
                const stats = getStatsForLicense(license.orgName);
                return (
                  <div key={license.id} className={`p-4 rounded-2xl border-2 transition-all ${license.status === LicenseStatus.SUSPENDED ? 'bg-destructive/5 border-destructive/20' : 'bg-card border-border shadow-sm'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <span className={`text-[10px] font-black px-3 py-1 rounded-full ${license.status === LicenseStatus.ACTIVE ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : license.status === LicenseStatus.READY ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
                        {license.status === LicenseStatus.ACTIVE ? 'مفعل' : license.status === LicenseStatus.READY ? 'جاهز' : 'موقوف'}
                      </span>
                      <span className="text-[10px] font-black text-muted-foreground flex items-center gap-1">
                        {license.type === 'TRIAL' ? <Clock size={12}/> : <ShieldCheck size={12}/>}
                        {license.type === 'TRIAL' ? 'تجريبي' : 'دائم'}
                      </span>
                    </div>
                    
                    <h3 className="font-black text-foreground text-base mb-1">{license.orgName}</h3>
                    
                    {/* Employee limit */}
                    <div className="flex items-center gap-2 mb-2 text-xs">
                      <Users size={12} className="text-muted-foreground" />
                      {editingLimit === license.id ? (
                        <div className="flex items-center gap-1">
                          <input type="number" min={1} max={500} value={newLimit}
                            onChange={(e) => setNewLimit(Number(e.target.value))}
                            className="w-16 px-2 py-1 border rounded text-xs text-center bg-background text-foreground" />
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
                    
                    <div onClick={() => copyKey(license.licenseKey)} className="bg-muted p-3 rounded-xl flex justify-between items-center cursor-pointer hover:bg-muted/80 transition-colors mb-3 group">
                      <span className="font-mono font-black text-primary tracking-wider text-xs break-all">{license.licenseKey}</span>
                      {copied === license.licenseKey ? <CheckCircle2 size={14} className="text-green-500 shrink-0" /> : <Copy size={14} className="text-muted-foreground group-hover:text-primary shrink-0" />}
                    </div>

                    {license.status !== LicenseStatus.READY && (
                      <div className="flex gap-2 mb-3">
                        {license.status === LicenseStatus.ACTIVE ? (
                          <button onClick={() => updateLicenseStatus(license.id, license.ownerId || null, LicenseStatus.SUSPENDED)} className="flex-1 py-2.5 bg-destructive/10 text-destructive rounded-xl text-[10px] font-black flex items-center justify-center gap-1"><Lock size={14}/> إيقاف</button>
                        ) : (
                          <button onClick={() => updateLicenseStatus(license.id, license.ownerId || null, LicenseStatus.ACTIVE)} className="flex-1 py-2.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-xl text-[10px] font-black flex items-center justify-center gap-1"><Unlock size={14}/> تفعيل</button>
                        )}
                        {license.type === 'TRIAL' && (
                          <button onClick={() => makeLicensePermanent(license.id, license.ownerId || null)} className="flex-1 py-2.5 bg-primary/10 text-primary rounded-xl text-[10px] font-black flex items-center justify-center gap-1"><ShieldCheck size={14}/> تمليك</button>
                        )}
                      </div>
                    )}

                    <div className="text-[9px] text-muted-foreground font-bold border-t pt-2 flex flex-wrap justify-between gap-1">
                      <span>أنشئ: {new Date(license.issuedAt).toLocaleDateString('ar-EG')}</span>
                      {license.expiryDate && <span>ينتهي: {new Date(license.expiryDate).toLocaleDateString('ar-EG')}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            {licenses.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Key className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-bold">لا توجد تراخيص</p>
                <p className="text-sm mt-1">اضغط "إصدار" لإنشاء ترخيص جديد</p>
              </div>
            )}
          </div>
        )}

        {/* --- Stats Tab --- */}
        {activeTab === 'stats' && (
          <div className="space-y-4 animate-fade-in">
            {orgStats.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-bold">لا توجد بيانات</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {orgStats.map((stat) => (
                  <div key={stat.org_id} className="p-4 rounded-2xl border bg-card shadow-sm space-y-3">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <h3 className="font-black text-base text-foreground">{stat.org_name}</h3>
                      <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${stat.license_status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : stat.license_status === 'SUSPENDED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-muted text-muted-foreground'}`}>
                        {stat.license_status === 'ACTIVE' ? 'مفعل' : stat.license_status === 'SUSPENDED' ? 'موقوف' : stat.license_status || 'بدون'}
                      </span>
                    </div>

                    {/* Employee usage bar */}
                    <div>
                      <div className="flex justify-between text-xs font-bold text-muted-foreground mb-1">
                        <span className="flex items-center gap-1"><Users size={12}/> الموظفون</span>
                        <span>{stat.employee_count} / {stat.max_employees}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${stat.employee_count >= stat.max_employees ? 'bg-destructive' : stat.employee_count >= stat.max_employees * 0.8 ? 'bg-yellow-500' : 'bg-primary'}`}
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
                        <div key={i} className="bg-muted/50 p-2 rounded-xl text-center">
                          <item.icon size={13} className="text-muted-foreground mx-auto mb-0.5" />
                          <p className="text-sm font-black text-foreground">{item.value.toLocaleString('ar-EG')}</p>
                          <p className="text-[8px] text-muted-foreground font-bold">{item.label}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap justify-between text-xs border-t pt-2 gap-2">
                      <span className="font-bold text-muted-foreground">الإيرادات: <span className="text-foreground">{Number(stat.total_revenue).toLocaleString('ar-EG')} ل.س</span></span>
                      <span className="font-bold text-muted-foreground">السجلات: <span className="text-foreground">{stat.total_records.toLocaleString('ar-EG')}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- Versions Tab --- */}
        {activeTab === 'versions' && (
          <div className="animate-fade-in">
            <VersionManagement />
          </div>
        )}

        {/* --- Deletion Tab --- */}
        {activeTab === 'deletion' && (
          <div className="animate-fade-in">
            <OrgDeletionManager />
          </div>
        )}
      </div>

      {/* ===== Issue License Modal ===== */}
      {showForm && createPortal(
        <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-md flex items-center justify-center p-4 safe-area-x safe-area-bottom" dir="rtl">
          <div className="bg-card rounded-2xl w-full max-w-md p-5 space-y-5 animate-zoom-in shadow-2xl border border-border max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-black text-foreground">إصدار ترخيص جديد</h3>
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
                <label className="text-xs font-bold text-muted-foreground block mb-1">نوع الترخيص</label>
                <select name="type" className="input-field" value={licenseType} onChange={e => setLicenseType(e.target.value as any)}>
                  <option value="TRIAL">تجريبي (Trial)</option>
                  <option value="PERMANENT">دائم (Permanent)</option>
                </select>
              </div>
              {licenseType === 'TRIAL' && (
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">عدد أيام التجربة (1-365)</label>
                  <input name="days" type="number" defaultValue="30" min={1} max={365} className="input-field" />
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">الحد الأقصى للموظفين (1-500)</label>
                <input name="maxEmployees" type="number" defaultValue="10" min={1} max={500} className="input-field" />
              </div>
              <button type="submit" className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-black shadow-lg">توليد الترخيص</button>
              <button type="button" onClick={() => setShowForm(false)} className="w-full py-3.5 bg-muted text-muted-foreground rounded-xl font-black">إغلاء</button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default DeveloperHub;
