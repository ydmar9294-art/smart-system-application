import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Package, 
  Users,
  TrendingUp,
  LogOut,
  LayoutDashboard,
  Receipt,
  Wallet,
  UserPlus,
  X,
  Copy,
  CheckCircle2,
  Clock,
  ShieldCheck,
  MessageCircle,
  AlertTriangle,
  Phone,
  MapPin,
  CircleDollarSign,
  Shield,
  UserX,
  UserCheck,
  Loader2
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { CURRENCY } from '@/constants';
import { UserRole, EmployeeType } from '@/types';
import { AreaChart, Area, XAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { InventoryTab } from './InventoryTab';
import { FinanceTab } from './FinanceTab';
import { EmployeeKPIs } from './EmployeeKPIs';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import AIAssistant from '@/components/ai/AIAssistant';
import WelcomeSplash from '@/components/ui/WelcomeSplash';
import LegalInfoTab from './LegalInfoTab';

type OwnerTabType = 'daily' | 'team' | 'customers' | 'finance' | 'legal';

const OwnerDashboard: React.FC = () => {
  const { 
    user, sales = [], payments = [], customers = [], users = [],
    products = [], logout, addDistributor, pendingEmployees = [],
    deactivateEmployee, reactivateEmployee
  } = useApp();
  
  const [activeTab, setActiveTab] = useState<OwnerTabType>('daily');
  const [loggingOut, setLoggingOut] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [newEmployeeCode, setNewEmployeeCode] = useState<string | null>(null);
  const [newEmployeeData, setNewEmployeeData] = useState<any | null>(null);
  const [togglingEmployee, setTogglingEmployee] = useState<string | null>(null);

  React.useEffect(() => { setIsMounted(true); }, []);

  const stats = useMemo(() => {
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const todaySales = sales.filter(s => s.timestamp >= todayStart);
    const todayRevenue = todaySales.reduce((s, i) => s + i.grandTotal, 0);
    const totalCollections = payments.filter(c => c.timestamp >= todayStart).reduce((s, i) => s + i.amount, 0);
    const chartData = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const sOfDay = new Date(d).setHours(0, 0, 0, 0);
      const eOfDay = new Date(d).setHours(23, 59, 59, 999);
      const daySales = sales.filter(s => s.timestamp >= sOfDay && s.timestamp <= eOfDay);
      return { day: d.toLocaleDateString('ar-EG', { weekday: 'short' }), revenue: daySales.reduce((s, v) => s + v.grandTotal, 0) };
    });
    return { todayRevenue, totalCollections, chartData };
  }, [sales, payments]);

  const teamMembers = users.filter(u => u.role === UserRole.EMPLOYEE);

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await logout(); } finally { setLoggingOut(false); }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const result = await addDistributor(fd.get('name') as string, fd.get('phone') as string, UserRole.EMPLOYEE, fd.get('type') as EmployeeType);
    if (result.code) { setNewEmployeeCode(result.code); setNewEmployeeData(result.employee); }
  };

  const closeEmployeeModal = () => { setShowAddUserModal(false); setNewEmployeeCode(null); setNewEmployeeData(null); };

  const handleToggleEmployee = async (employeeId: string, isActive: boolean) => {
    setTogglingEmployee(employeeId);
    try {
      if (isActive) {
        await deactivateEmployee(employeeId);
      } else {
        await reactivateEmployee(employeeId);
      }
    } finally {
      setTogglingEmployee(null);
    }
  };

  const getEmployeeTypeLabel = (type: EmployeeType) => {
    switch (type) {
      case EmployeeType.SALES_MANAGER: return 'مدير مبيعات';
      case EmployeeType.ACCOUNTANT: return 'محاسب';
      case EmployeeType.FIELD_AGENT: return 'موزع ميداني';
      case EmployeeType.WAREHOUSE_KEEPER: return 'أمين مستودع';
      default: return type;
    }
  };

  const myPendingEmployees = pendingEmployees.filter(pe => !pe.is_used);
  const myActivatedEmployees = pendingEmployees.filter(pe => pe.is_used);

  const tabs: { id: OwnerTabType; label: string; icon: React.ReactNode; color: string; bgColor: string }[] = [
    { id: 'daily', label: 'الرئيسية', icon: <LayoutDashboard className="w-5 h-5" />, color: 'text-blue-600', bgColor: 'bg-blue-600' },
    { id: 'team', label: 'الفريق', icon: <Users className="w-5 h-5" />, color: 'text-orange-500', bgColor: 'bg-orange-500' },
    { id: 'customers', label: 'الزبائن', icon: <span className="text-sm font-bold">ل.س</span>, color: 'text-red-500', bgColor: 'bg-red-500' },
    { id: 'finance', label: 'المالية', icon: <TrendingUp className="w-5 h-5" />, color: 'text-purple-600', bgColor: 'bg-purple-600' },
    { id: 'legal', label: 'القانونية', icon: <Shield className="w-5 h-5" />, color: 'text-indigo-600', bgColor: 'bg-indigo-600' },
  ];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="max-w-lg mx-auto">
        <div className="bg-background pt-4 px-4 relative">
          <div className="absolute -top-1 left-1 z-10"><NotificationCenter /></div>

          <div className="flex justify-center pt-4 mb-3">
            <div className="flex items-center gap-3 bg-card px-4 py-2 rounded-full shadow-sm">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-white" />
              </div>
              <div className="text-end">
                <p className="font-bold text-foreground text-sm">{user?.name || 'المالك'}</p>
                <p className="text-[10px] text-muted-foreground">لوحة الإدارة</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5 bg-card/80 backdrop-blur-sm px-2 py-1.5 rounded-xl shadow-sm">
              <AIAssistant className="!p-1.5 !rounded-lg" />
              <div className="w-px h-5 bg-border" />
              <a href="https://wa.me/963947744162" target="_blank" rel="noopener noreferrer"
                className="p-1.5 bg-gradient-to-br from-green-400 to-green-600 rounded-lg text-white hover:shadow-md transition-all active:scale-95" title="فريق الدعم">
                <MessageCircle className="w-4 h-4" />
              </a>
            </div>
            <button onClick={handleLogout} disabled={loggingOut}
              className="p-2.5 bg-card/80 backdrop-blur-sm rounded-full shadow-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all" title="تسجيل الخروج">
              <LogOut className={`w-5 h-5 ${loggingOut ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <WelcomeSplash />

        <div className="px-4 pb-4">
          <div className="bg-card rounded-3xl p-2 shadow-sm flex gap-1">
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl transition-all duration-300 ${
                  activeTab === tab.id ? `${tab.bgColor} text-white shadow-lg` : 'text-muted-foreground hover:bg-muted'
                }`}>
                <div className={`${activeTab === tab.id ? 'scale-110' : ''} transition-transform duration-300`}>{tab.icon}</div>
                <span className="text-[10px] font-bold">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 pb-8">
        {activeTab === 'daily' && (
          <div className="space-y-3 animate-fade-in">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-card p-4 rounded-2xl shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">مبيعات اليوم</p>
                <p className="text-xl font-black text-foreground">{stats.todayRevenue.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">{CURRENCY}</p>
              </div>
              
              <div className="bg-card p-4 rounded-2xl shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">التحصيلات</p>
                <p className="text-xl font-black text-foreground">{stats.totalCollections.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">{CURRENCY}</p>
              </div>
            </div>

            <div className="bg-card p-4 rounded-2xl shadow-sm">
              <h3 className="font-bold text-foreground mb-3 text-sm">ملخص النظام</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-blue-500/10 p-3 rounded-xl text-center">
                  <FileText className="w-5 h-5 mx-auto text-blue-600 dark:text-blue-400 mb-1" />
                  <p className="text-lg font-black text-foreground">{sales.filter(s => s.timestamp >= new Date().setHours(0,0,0,0)).length}</p>
                  <p className="text-[8px] text-muted-foreground font-bold">فواتير اليوم</p>
                </div>
                <div className="bg-red-500/10 p-3 rounded-xl text-center">
                  <AlertTriangle className="w-5 h-5 mx-auto text-red-600 dark:text-red-400 mb-1" />
                  <p className="text-lg font-black text-foreground">{products.filter(p => p.stock <= p.minStock && !p.isDeleted).length}</p>
                  <p className="text-[8px] text-muted-foreground font-bold">مواد منخفضة</p>
                </div>
                <div className="bg-purple-500/10 p-3 rounded-xl text-center">
                  <Users className="w-5 h-5 mx-auto text-purple-600 dark:text-purple-400 mb-1" />
                  <p className="text-lg font-black text-foreground">{customers.length}</p>
                  <p className="text-[8px] text-muted-foreground font-bold">إجمالي الزبائن</p>
                </div>
                <div className="bg-orange-500/10 p-3 rounded-xl text-center">
                  <Package className="w-5 h-5 mx-auto text-orange-600 dark:text-orange-400 mb-1" />
                  <p className="text-lg font-black text-foreground">{teamMembers.length}</p>
                  <p className="text-[8px] text-muted-foreground font-bold">الموظفين النشطين</p>
                </div>
              </div>
            </div>

            {products.filter(p => p.stock <= p.minStock && !p.isDeleted).length > 0 && (
              <div className="bg-card p-4 rounded-2xl shadow-sm border-r-4 border-red-500">
                <h3 className="font-bold text-foreground mb-3 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" /> منتجات قاربت على النفاد
                </h3>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {products.filter(p => p.stock <= p.minStock && !p.isDeleted).slice(0, 5).map(p => (
                    <div key={p.id} className="flex justify-between items-center bg-red-500/10 p-2 rounded-lg">
                      <span className="font-bold text-xs text-foreground">{p.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-600 dark:text-red-400 font-black">{p.stock}</span>
                        <span className="text-[8px] text-muted-foreground">/ {p.minStock}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <EmployeeKPIs />
          </div>
        )}

        {activeTab === 'team' && (
          <div className="space-y-4 animate-fade-in">
            <button onClick={() => setShowAddUserModal(true)} 
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">
              <UserPlus className="w-5 h-5" /> إضافة موظف
            </button>
            
            {myPendingEmployees.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-bold text-foreground text-sm flex items-center gap-2 px-2">
                  <Clock className="w-4 h-4 text-orange-500" /> أكواد تفعيل معلقة
                </h3>
                {myPendingEmployees.map(pe => (
                  <div key={pe.id} className="bg-orange-500/10 p-4 rounded-2xl border border-orange-500/20">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold text-foreground">{pe.name}</p>
                        <p className="text-xs text-muted-foreground">{pe.phone}</p>
                      </div>
                      <span className="bg-orange-500/15 text-orange-600 dark:text-orange-400 px-2 py-1 rounded-lg text-xs font-bold">
                        {getEmployeeTypeLabel(pe.employee_type)}
                      </span>
                    </div>
                    <div onClick={() => { navigator.clipboard.writeText(pe.activation_code); setCopiedId(pe.id); setTimeout(() => setCopiedId(null), 2000); }}
                      className="bg-card p-3 rounded-xl flex justify-between items-center cursor-pointer hover:bg-muted transition-colors">
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400 tracking-wider">{pe.activation_code}</span>
                      {copiedId === pe.id ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5 text-muted-foreground" />}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {myActivatedEmployees.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-bold text-foreground text-sm flex items-center gap-2 px-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> أكواد مفعّلة
                </h3>
                {myActivatedEmployees.map(pe => (
                  <div key={pe.id} className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold text-foreground">{pe.name}</p>
                        <p className="text-xs text-muted-foreground">{pe.phone}</p>
                      </div>
                      <span className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-lg text-xs font-bold">
                        مفعّل ✓
                      </span>
                    </div>
                    <div className="bg-card p-3 rounded-xl">
                      <span className="font-mono text-muted-foreground text-xs line-through">{pe.activation_code}</span>
                      {pe.activated_at && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          تم التفعيل: {new Date(pe.activated_at).toLocaleDateString('ar-SY')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {teamMembers.length === 0 && myPendingEmployees.length === 0 ? (
                <div className="bg-card p-8 rounded-3xl text-center">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground font-medium">لا يوجد موظفين</p>
                </div>
              ) : (
                teamMembers.map(u => {
                  const isActive = u.isActive !== false;
                  return (
                    <div key={u.id} className={`bg-card p-4 rounded-2xl shadow-sm ${!isActive ? 'opacity-60' : ''}`}>
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isActive ? 'bg-emerald-500/10' : 'bg-destructive/10'}`}>
                            {isActive ? (
                              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <UserX className="w-6 h-6 text-destructive" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-foreground">{u.name}</p>
                            <p className="text-xs text-muted-foreground">{getEmployeeTypeLabel(u.employeeType!)}</p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold ${isActive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-destructive/10 text-destructive'}`}>
                          {isActive ? 'نشط' : 'معطّل'}
                        </span>
                      </div>
                      <button
                        onClick={() => handleToggleEmployee(u.id, isActive)}
                        disabled={togglingEmployee === u.id}
                        className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                          isActive
                            ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                        }`}
                      >
                        {togglingEmployee === u.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isActive ? (
                          <><UserX className="w-4 h-4" /> إيقاف الموظف</>
                        ) : (
                          <><UserCheck className="w-4 h-4" /> إعادة التنشيط</>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="space-y-3 animate-fade-in">
            <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-3xl text-white shadow-lg">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs opacity-80 mb-1">إجمالي ذمم السوق</p>
                  <p className="text-3xl font-black">{customers.reduce((s, c) => s + c.balance, 0).toLocaleString()} {CURRENCY}</p>
                </div>
                <div className="text-left">
                  <p className="text-xs opacity-80 mb-1">عدد الزبائن</p>
                  <p className="text-2xl font-black">{customers.length}</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-white/20 flex justify-between text-xs">
                <span className="opacity-80">زبائن بذمم مدينة</span>
                <span className="font-bold">{customers.filter(c => c.balance > 0).length}</span>
              </div>
            </div>

            {customers.length === 0 ? (
              <div className="bg-card p-8 rounded-3xl text-center">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground font-medium">لا يوجد زبائن بعد</p>
              </div>
            ) : (
              <div className="space-y-2">
                {customers.map(c => (
                  <div key={c.id} className="bg-card p-4 rounded-2xl shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.balance > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                          <CircleDollarSign className={`w-5 h-5 ${c.balance > 0 ? 'text-red-500' : 'text-emerald-500'}`} />
                        </div>
                        <div>
                          <p className="font-bold text-foreground">{c.name}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.balance > 0 ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                            {c.balance > 0 ? 'ذمة مدينة' : 'لا توجد ذمم'}
                          </span>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className={`font-black text-lg ${c.balance > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{c.balance.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">{CURRENCY}</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-3 pt-3 border-t border-border">
                      {c.phone && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Phone className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium" dir="ltr">{c.phone}</span>
                        </div>
                      )}
                      {c.location && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <MapPin className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">{c.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Collections History */}
            {payments.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-bold text-foreground text-sm flex items-center gap-2 px-2 mt-4">
                  <Wallet className="w-4 h-4 text-emerald-500" /> سجل التحصيلات
                </h3>
                {payments.filter(p => !p.isReversed).slice(0, 10).map(p => {
                  // Find customer name from associated sale
                  const sale = sales.find(s => s.id === p.saleId);
                  return (
                    <div key={p.id} className="bg-card p-3 rounded-2xl shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                          <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <p className="font-bold text-foreground text-sm">{sale?.customerName || 'غير محدد'}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(p.timestamp).toLocaleDateString('ar-SA')}</p>
                        </div>
                      </div>
                      <p className="font-black text-emerald-600 dark:text-emerald-400">{p.amount.toLocaleString()} {CURRENCY}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'finance' && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-card rounded-3xl shadow-sm p-4"><FinanceTab /></div>
          </div>
        )}

        {activeTab === 'legal' && (
          <div className="animate-fade-in"><LegalInfoTab /></div>
        )}
      </div>

      {/* Add Employee Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-3xl w-full max-w-md p-6 space-y-4 animate-zoom-in">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-foreground">
                {newEmployeeCode ? 'تم إنشاء كود التفعيل' : 'إضافة موظف جديد'}
              </h2>
              <button onClick={closeEmployeeModal} className="p-2 bg-muted rounded-full hover:bg-accent">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            
            {newEmployeeCode ? (
              <div className="space-y-4">
                <div className="bg-emerald-500/10 p-6 rounded-2xl border border-emerald-500/20 text-center">
                  <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
                  <p className="text-sm text-muted-foreground mb-2">كود تفعيل الموظف:</p>
                  <p className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-400 tracking-widest">{newEmployeeCode}</p>
                </div>
                
                {newEmployeeData && (
                  <div className="bg-muted p-4 rounded-xl space-y-2 text-sm">
                    <p><span className="text-muted-foreground">الاسم:</span> <span className="font-bold text-foreground">{newEmployeeData.name}</span></p>
                    <p><span className="text-muted-foreground">الهاتف:</span> <span className="font-bold text-foreground">{newEmployeeData.phone}</span></p>
                    <p><span className="text-muted-foreground">النوع:</span> <span className="font-bold text-foreground">{newEmployeeData.employee_type === EmployeeType.FIELD_AGENT ? 'موزع ميداني' : newEmployeeData.employee_type === EmployeeType.SALES_MANAGER ? 'مدير مبيعات' : newEmployeeData.employee_type === EmployeeType.WAREHOUSE_KEEPER ? 'أمين مستودع' : 'محاسب'}</span></p>
                  </div>
                )}
                
                <button onClick={() => { navigator.clipboard.writeText(newEmployeeCode); }}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                  <Copy className="w-5 h-5" /> نسخ الكود
                </button>
                <button onClick={closeEmployeeModal} className="w-full py-3 bg-muted text-muted-foreground rounded-xl font-bold">إغلاق</button>
              </div>
            ) : (
              <form onSubmit={handleAddEmployee} className="space-y-4">
                <input name="name" required placeholder="اسم الموظف" 
                  className="w-full px-4 py-3 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-muted-foreground" />
                <input name="phone" type="tel" inputMode="numeric" pattern="[0-9]*" required placeholder="رقم الهاتف" 
                  className="w-full px-4 py-3 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-muted-foreground" />
                <select name="type" className="w-full px-4 py-3 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-500">
                  <option value={EmployeeType.SALES_MANAGER}>مدير مبيعات</option>
                  <option value={EmployeeType.ACCOUNTANT}>محاسب مالي</option>
                  <option value={EmployeeType.FIELD_AGENT}>موزع ميداني</option>
                  <option value={EmployeeType.WAREHOUSE_KEEPER}>أمين مستودع</option>
                </select>
                <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold">توليد كود التفعيل</button>
              </form>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default OwnerDashboard;
