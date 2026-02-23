import React, { useState, useEffect } from 'react';
import { useApp } from '@/store/AppContext';
import { LicenseStatus, OrgStats } from '@/types';
import { sanitizeText, sanitizePhone } from '@/lib/validation';

import {
  ShieldCheck, Key, UserPlus, LogOut,
  Copy, CheckCircle2,
  Clock, Lock, Unlock, Activity,
  Users, Package, ShoppingCart, Truck,
  BarChart3, AlertTriangle, Phone, Edit2, Save, X
} from 'lucide-react';

const DeveloperHub: React.FC = () => {
  const {
    licenses, issueLicense, updateLicenseStatus, makeLicensePermanent,
    updateLicenseMaxEmployees, orgStats, refreshOrgStats, logout
  } = useApp();

  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [licenseType, setLicenseType] = useState<'TRIAL' | 'PERMANENT'>('TRIAL');
  const [editingLimit, setEditingLimit] = useState<string | null>(null);
  const [newLimit, setNewLimit] = useState<number>(10);
  const [showStats, setShowStats] = useState(true);

  useEffect(() => {
    refreshOrgStats();
  }, [refreshOrgStats]);

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
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
    <div className="space-y-6 animate-fade-in pb-12 pt-4 text-end" dir="rtl">
      {/* Header - Fix #3: Responsive */}
      <div className="bg-slate-900 rounded-2xl md:rounded-[3rem] p-5 md:p-10 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-4xl font-black flex items-center gap-3">نظام التراخيص <Key className="text-primary" size={24} /></h1>
              <p className="text-slate-400 font-bold mt-1 text-sm">إصدار ومراقبة مفاتيح التفعيل السحابية.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowForm(true)} className="px-5 py-3 md:px-8 md:py-4 bg-primary rounded-xl md:rounded-2xl font-black shadow-xl flex items-center gap-2 active:scale-95 transition-all text-sm"><UserPlus size={18} /> إصدار ترخيص</button>
            <button onClick={() => { setShowStats(!showStats); if (!showStats) refreshOrgStats(); }} className="px-4 py-3 md:px-6 md:py-4 bg-white/10 rounded-xl md:rounded-2xl font-black hover:bg-white/20 active:scale-95 transition-all flex items-center gap-2 text-sm"><BarChart3 size={18} /> إحصائيات</button>
            <button onClick={logout} className="px-4 py-3 md:px-6 md:py-4 bg-white/10 rounded-xl md:rounded-2xl font-black hover:bg-destructive/20 active:scale-95 transition-all"><LogOut size={18} /></button>
          </div>
        </div>
      </div>

      {/* Organization Statistics - Fix #3: Responsive grid */}
      {showStats && orgStats.length > 0 && (
        <div className="bg-card rounded-2xl md:rounded-[2.5rem] p-4 md:p-8 border shadow-sm">
          <h2 className="text-lg md:text-xl font-black flex items-center gap-2 mb-4 md:mb-6"><BarChart3 size={20} className="text-primary"/> إحصائيات الشركات</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {orgStats.map((stat) => (
              <div key={stat.org_id} className="p-4 md:p-6 rounded-2xl md:rounded-[2rem] border bg-muted/30 space-y-3 md:space-y-4">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <h3 className="font-black text-base md:text-lg text-foreground">{stat.org_name}</h3>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${stat.license_status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : stat.license_status === 'SUSPENDED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'}`}>
                    {stat.license_status === 'ACTIVE' ? 'مفعل' : stat.license_status === 'SUSPENDED' ? 'موقوف' : stat.license_status || 'بدون ترخيص'}
                  </span>
                </div>

                {/* Employee usage bar - based on ACTIVE employees only */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-muted-foreground mb-1">
                    <span className="flex items-center gap-1"><Users size={12}/> الموظفون النشطون</span>
                    <span>{stat.employee_count} / {stat.max_employees}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all ${stat.employee_count >= stat.max_employees ? 'bg-destructive' : stat.employee_count >= stat.max_employees * 0.8 ? 'bg-yellow-500' : 'bg-primary'}`}
                      style={{ width: `${Math.min(100, (stat.employee_count / stat.max_employees) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <p className="text-[10px] text-muted-foreground font-bold">
                      نشط: {stat.employee_count} | معلّق: {stat.pending_employees} | إجمالي مستخدمين: {stat.total_users}
                    </p>
                  </div>
                  {stat.employee_count >= stat.max_employees && (
                    <p className="text-[10px] text-destructive font-bold mt-1 flex items-center gap-1"><AlertTriangle size={10}/> تم الوصول للحد الأقصى للموظفين النشطين</p>
                  )}
                </div>

                {/* Stats grid - responsive */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: ShoppingCart, label: 'المبيعات', value: stat.total_sales },
                    { icon: Package, label: 'المنتجات', value: stat.total_products },
                    { icon: Users, label: 'العملاء', value: stat.total_customers },
                    { icon: Truck, label: 'التسليمات', value: stat.total_deliveries },
                    { icon: ShoppingCart, label: 'المشتريات', value: stat.total_purchases },
                    { icon: Activity, label: 'التحصيلات', value: stat.total_collections },
                  ].map((item, i) => (
                    <div key={i} className="bg-card p-2 md:p-3 rounded-xl text-center">
                      <item.icon size={14} className="text-muted-foreground mx-auto mb-1" />
                      <p className="text-sm md:text-lg font-black text-foreground">{item.value.toLocaleString('ar-EG')}</p>
                      <p className="text-[8px] md:text-[9px] text-muted-foreground font-bold">{item.label}</p>
                    </div>
                  ))}
                </div>

                {/* Revenue & records estimate */}
                <div className="flex flex-wrap justify-between text-xs border-t pt-3 gap-2">
                  <span className="font-bold text-muted-foreground">إجمالي الإيرادات: <span className="text-foreground">{Number(stat.total_revenue).toLocaleString('ar-EG')} ل.س</span></span>
                  <span className="font-bold text-muted-foreground">إجمالي السجلات: <span className="text-foreground">{stat.total_records.toLocaleString('ar-EG')}</span></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* License Cards - Fix #3: Responsive grid */}
      <div className="bg-card rounded-2xl md:rounded-[2.5rem] p-4 md:p-8 border shadow-sm">
        <div className="flex justify-between items-center mb-6 md:mb-8">
          <h2 className="text-lg md:text-xl font-black flex items-center gap-2"><Activity size={20} className="text-primary"/> سجل التراخيص الصادرة</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
          {licenses.map((license) => {
            const stats = getStatsForLicense(license.orgName);
            return (
              <div key={license.id} className={`p-5 md:p-6 rounded-2xl md:rounded-[2.5rem] border-2 transition-all ${license.status === LicenseStatus.SUSPENDED ? 'bg-destructive/5 border-destructive/20' : 'bg-card border-border shadow-md'}`}>
                <div className="flex justify-between items-start mb-4">
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full ${license.status === LicenseStatus.ACTIVE ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : license.status === LicenseStatus.READY ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
                    {license.status === LicenseStatus.ACTIVE ? 'مفعل' : license.status === LicenseStatus.READY ? 'جاهز للتسليم' : 'موقوف'}
                  </span>
                  <span className="text-[10px] font-black text-muted-foreground flex items-center gap-1">
                    {license.type === 'TRIAL' ? <Clock size={12}/> : <ShieldCheck size={12}/>}
                    {license.type === 'TRIAL' ? 'تجريبي' : 'دائم'}
                  </span>
                </div>
                
                <h3 className="font-black text-foreground text-lg mb-1">{license.orgName}</h3>
                
                {/* Employee limit - editable */}
                <div className="flex items-center gap-2 mb-2 text-xs">
                  <Users size={12} className="text-muted-foreground" />
                  {editingLimit === license.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={newLimit}
                        onChange={(e) => setNewLimit(Number(e.target.value))}
                        className="w-16 px-2 py-1 border rounded text-xs text-center bg-background text-foreground"
                      />
                      <button onClick={() => handleUpdateLimit(license.id)} className="text-primary hover:text-primary/80"><Save size={14}/></button>
                      <button onClick={() => setEditingLimit(null)} className="text-muted-foreground hover:text-foreground"><X size={14}/></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-muted-foreground">
                        الحد: <span className="text-foreground">{license.maxEmployees}</span> موظف
                        {stats && <span className="text-muted-foreground"> ({stats.employee_count} نشط + {stats.pending_employees} معلّق)</span>}
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
                
                <div onClick={() => copyKey(license.licenseKey)} className="bg-muted p-3 rounded-xl flex justify-between items-center cursor-pointer hover:bg-muted/80 transition-colors mb-4 md:mb-6 group">
                  <span className="font-mono font-black text-primary tracking-wider text-xs md:text-sm break-all">{license.licenseKey}</span>
                  {copied === license.licenseKey ? <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" /> : <Copy size={16} className="text-muted-foreground group-hover:text-primary flex-shrink-0" />}
                </div>

                {license.status !== LicenseStatus.READY && (
                  <div className="flex gap-2 mb-4 md:mb-6">
                    {license.status === LicenseStatus.ACTIVE ? (
                      <button onClick={() => updateLicenseStatus(license.id, license.ownerId || null, LicenseStatus.SUSPENDED)} className="flex-1 py-2.5 md:py-3 bg-destructive/10 text-destructive rounded-xl text-[10px] font-black flex items-center justify-center gap-1.5"><Lock size={14}/> إيقاف</button>
                    ) : (
                      <button onClick={() => updateLicenseStatus(license.id, license.ownerId || null, LicenseStatus.ACTIVE)} className="flex-1 py-2.5 md:py-3 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-xl text-[10px] font-black flex items-center justify-center gap-1.5"><Unlock size={14}/> تفعيل</button>
                    )}
                    {license.type === 'TRIAL' && (
                      <button onClick={() => makeLicensePermanent(license.id, license.ownerId || null)} className="flex-1 py-2.5 md:py-3 bg-primary/10 text-primary rounded-xl text-[10px] font-black flex items-center justify-center gap-1.5"><ShieldCheck size={14}/> تمليك</button>
                    )}
                  </div>
                )}

                <div className="text-[9px] text-muted-foreground font-bold border-t pt-3 md:pt-4 flex flex-wrap justify-between gap-1">
                  <span>أنشئ: {new Date(license.issuedAt).toLocaleDateString('ar-EG')}</span>
                  {license.expiryDate && <span>ينتهي: {new Date(license.expiryDate).toLocaleDateString('ar-EG')}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Issue License Modal */}
      {showForm && (
        <div className="modal-overlay p-4">
          <div className="bg-card rounded-2xl md:rounded-[3rem] w-full max-w-md p-6 md:p-8 space-y-6 animate-zoom-in max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-black text-foreground">إصدار ترخيص جديد</h3>
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

              <button type="submit" className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-black shadow-lg">توليد الترخيص</button>
              <button type="button" onClick={() => setShowForm(false)} className="w-full py-4 bg-muted text-muted-foreground rounded-xl font-black">إغلاق</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeveloperHub;
