import React, { useState, useMemo } from 'react';
import { 
  Users,
  LogOut,
  LayoutDashboard,
  UserPlus,
  X,
  Copy,
  CheckCircle2,
  Clock,
  ShieldCheck,
  MessageCircle,
  TrendingUp,
  Package,
  Wallet,
  FileText,
  Warehouse as WarehouseIcon,
  BarChart3,
  UserX,
  UserCheck,
  Loader2
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { CURRENCY } from '@/constants';
import { UserRole, EmployeeType } from '@/types';
import AIAssistant from '@/features/ai/components/AIAssistant';
import WelcomeSplash from '@/components/ui/WelcomeSplash';
import DistributorWarehouseKPIs from '@/features/analytics/components/DistributorWarehouseKPIs';

type SalesManagerTabType = 'dashboard' | 'team' | 'sales' | 'kpi';

const SalesManagerDashboard: React.FC = () => {
  const { 
    user, 
    sales = [], 
    payments = [], 
    customers = [], 
    users = [],
    logout, 
    addDistributor, 
    pendingEmployees = [],
    deactivateEmployee,
    reactivateEmployee
  } = useApp();
  
  const [activeTab, setActiveTab] = useState<SalesManagerTabType>('dashboard');
  const [loggingOut, setLoggingOut] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newEmployeeCode, setNewEmployeeCode] = useState<string | null>(null);
  const [newEmployeeData, setNewEmployeeData] = useState<any | null>(null);
  const [togglingEmployee, setTogglingEmployee] = useState<string | null>(null);

  const stats = useMemo(() => {
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const todaySales = sales.filter(s => s.timestamp >= todayStart);
    const todayRevenue = todaySales.reduce((s, i) => s + i.grandTotal, 0);
    const totalCollections = payments.filter(c => c.timestamp >= todayStart).reduce((s, i) => s + i.amount, 0);
    return { todayRevenue, totalCollections, todaySalesCount: todaySales.length };
  }, [sales, payments]);

  const teamMembers = users.filter(u => 
    u.role === UserRole.EMPLOYEE && 
    (u.employeeType === EmployeeType.FIELD_AGENT || u.employeeType === EmployeeType.WAREHOUSE_KEEPER)
  );
  const distributors = users.filter(u => u.role === UserRole.EMPLOYEE && u.employeeType === EmployeeType.FIELD_AGENT);
  const warehouseKeepers = users.filter(u => u.role === UserRole.EMPLOYEE && u.employeeType === EmployeeType.WAREHOUSE_KEEPER);
  const myPendingEmployees = pendingEmployees.filter(pe => 
    !pe.is_used && (pe.employee_type === EmployeeType.FIELD_AGENT || pe.employee_type === EmployeeType.WAREHOUSE_KEEPER)
  );
  const myActivatedEmployees = pendingEmployees.filter(pe => 
    pe.is_used && (pe.employee_type === EmployeeType.FIELD_AGENT || pe.employee_type === EmployeeType.WAREHOUSE_KEEPER)
  );

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await logout(); } finally { setLoggingOut(false); }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const result = await addDistributor(
      fd.get('name') as string, fd.get('phone') as string, 
      UserRole.EMPLOYEE, fd.get('type') as EmployeeType
    );
    if (result.code) {
      setNewEmployeeCode(result.code);
      setNewEmployeeData(result.employee);
    }
  };

  const closeEmployeeModal = () => {
    setShowAddUserModal(false);
    setNewEmployeeCode(null);
    setNewEmployeeData(null);
  };

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
      case EmployeeType.FIELD_AGENT: return 'موزع ميداني';
      case EmployeeType.WAREHOUSE_KEEPER: return 'أمين مستودع';
      default: return type;
    }
  };

  const tabs: { id: SalesManagerTabType; label: string; icon: React.ReactNode; color: string; bgColor: string }[] = [
    { id: 'dashboard', label: 'الرئيسية', icon: <LayoutDashboard className="w-5 h-5" />, color: 'text-blue-600', bgColor: 'bg-blue-600' },
    { id: 'team', label: 'الفريق', icon: <Users className="w-5 h-5" />, color: 'text-orange-500', bgColor: 'bg-orange-500' },
    { id: 'kpi', label: 'الأداء', icon: <BarChart3 className="w-5 h-5" />, color: 'text-emerald-600', bgColor: 'bg-emerald-600' },
    { id: 'sales', label: 'المبيعات', icon: <TrendingUp className="w-5 h-5" />, color: 'text-purple-600', bgColor: 'bg-purple-600' },
  ];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="max-w-lg mx-auto">
        {/* Top Header */}
        <div className="bg-background pt-4 px-4 relative">
          <div className="flex justify-center pt-4 mb-3">
            <div className="flex items-center gap-3 bg-card px-4 py-2 rounded-full shadow-sm">
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div className="text-end">
                <p className="font-bold text-foreground text-sm">{user?.name || 'مدير المبيعات'}</p>
                <p className="text-[10px] text-muted-foreground">إدارة المبيعات</p>
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

        {/* Tab Navigation */}
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

        {/* Tab Content */}
        <div className="px-4 pb-8">
          {activeTab === 'dashboard' && (
            <div className="space-y-3 animate-fade-in">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-card p-4 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
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
                <h3 className="font-bold text-foreground mb-3 text-sm">إحصائيات الفريق</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-blue-500/10 p-3 rounded-xl text-center">
                    <Users className="w-5 h-5 mx-auto text-blue-600 dark:text-blue-400 mb-1" />
                    <p className="text-lg font-black text-foreground">{distributors.length}</p>
                    <p className="text-[8px] text-muted-foreground font-bold">الموزعين</p>
                  </div>
                  <div className="bg-purple-500/10 p-3 rounded-xl text-center">
                    <WarehouseIcon className="w-5 h-5 mx-auto text-purple-600 dark:text-purple-400 mb-1" />
                    <p className="text-lg font-black text-foreground">{warehouseKeepers.length}</p>
                    <p className="text-[8px] text-muted-foreground font-bold">أمناء المستودع</p>
                  </div>
                  <div className="bg-orange-500/10 p-3 rounded-xl text-center">
                    <FileText className="w-5 h-5 mx-auto text-orange-600 dark:text-orange-400 mb-1" />
                    <p className="text-lg font-black text-foreground">{stats.todaySalesCount}</p>
                    <p className="text-[8px] text-muted-foreground font-bold">فواتير اليوم</p>
                  </div>
                </div>
              </div>

              <div className="bg-card p-4 rounded-2xl shadow-sm">
                <h3 className="font-bold text-foreground mb-3 text-sm">إحصائيات الزبائن</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-emerald-500/10 p-3 rounded-xl text-center">
                    <p className="text-lg font-black text-foreground">{customers.length}</p>
                    <p className="text-[8px] text-muted-foreground font-bold">إجمالي الزبائن</p>
                  </div>
                  <div className="bg-red-500/10 p-3 rounded-xl text-center">
                    <p className="text-lg font-black text-foreground">{customers.filter(c => c.balance > 0).length}</p>
                    <p className="text-[8px] text-muted-foreground font-bold">ذمم مدينة</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="space-y-4 animate-fade-in">
              <button onClick={() => setShowAddUserModal(true)} 
                className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">
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
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black ${isActive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-destructive/10 text-destructive'}`}>
                              {u.name ? u.name.charAt(0) : '?'}
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
                            isActive ? 'bg-destructive/10 text-destructive hover:bg-destructive/20' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
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

          {activeTab === 'kpi' && (
            <DistributorWarehouseKPIs />
          )}

          {activeTab === 'sales' && (
            <div className="space-y-3 animate-fade-in">
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-3xl text-white shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs opacity-80 mb-1">إجمالي المبيعات اليوم</p>
                    <p className="text-3xl font-black">{stats.todayRevenue.toLocaleString()} {CURRENCY}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs opacity-80 mb-1">عدد الفواتير</p>
                    <p className="text-2xl font-black">{stats.todaySalesCount}</p>
                  </div>
                </div>
              </div>

              <div className="bg-card p-4 rounded-2xl shadow-sm">
                <h3 className="font-bold text-foreground mb-3 text-sm">آخر المبيعات</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {sales.slice(0, 10).map(sale => (
                    <div key={sale.id} className="flex justify-between items-center bg-muted p-3 rounded-xl">
                      <div>
                        <p className="font-bold text-foreground text-sm">{sale.customerName}</p>
                        <p className="text-xs text-muted-foreground">{new Date(sale.timestamp).toLocaleString('ar-EG')}</p>
                      </div>
                      <div className="text-left">
                        <p className="font-black text-emerald-600 dark:text-emerald-400">{sale.grandTotal.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">{CURRENCY}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
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
                      <p><span className="text-muted-foreground">النوع:</span> <span className="font-bold text-foreground">{getEmployeeTypeLabel(newEmployeeData.employee_type)}</span></p>
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
                    className="w-full px-4 py-3 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-muted-foreground" />
                  <input name="phone" type="tel" inputMode="numeric" pattern="[0-9]*" required placeholder="رقم الهاتف" 
                    className="w-full px-4 py-3 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-muted-foreground" />
                  <select name="type" className="w-full px-4 py-3 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-orange-500">
                    <option value={EmployeeType.FIELD_AGENT}>موزع ميداني</option>
                    <option value={EmployeeType.WAREHOUSE_KEEPER}>أمين مستودع</option>
                  </select>
                  <button type="submit" className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold">توليد كود التفعيل</button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesManagerDashboard;
