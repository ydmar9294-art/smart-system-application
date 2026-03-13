/**
 * Developer Monitoring Tab
 * Comprehensive monitoring dashboard: org summaries, errors, performance,
 * security, resources, breach alerts, and database health.
 * 
 * Enhanced: Shows full error details with AI-generated analysis & solutions.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { performanceMonitor } from '@/utils/monitoring/performanceMonitor';
import {
  Activity, AlertTriangle, Shield, Database, Cpu, Bell,
  Heart, RefreshCw, CheckCircle2, XCircle, Clock,
  TrendingUp, Server, HardDrive, Zap, Eye,
  Building2, FileWarning, Brain, Lock, MonitorCheck,
  AlertCircle, Info, ChevronDown, ChevronUp, Loader2,
  Lightbulb, Code, Wrench
} from 'lucide-react';

// ============================================
// Types
// ============================================
interface OrgSummary {
  org_id: string;
  org_name: string;
  total_records: number;
  employee_count: number;
  license_status: string;
}

interface AuditError {
  id: string;
  action: string;
  entity_type: string;
  created_at: string;
  details: any;
  organization_id: string | null;
}

interface HealthCheck {
  label: string;
  status: 'healthy' | 'warning' | 'error';
  detail: string;
  checkedAt: string;
}

interface ErrorAnalysis {
  errorId: string;
  analysis: string;
  solution: string;
  loading: boolean;
}

type SectionId = 'orgs' | 'errors' | 'ai' | 'security' | 'resources' | 'alerts' | 'dbhealth';

const SECTIONS: { id: SectionId; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'orgs', label: 'ملخص المنشآت', icon: Building2, color: 'text-primary' },
  { id: 'errors', label: 'الأخطاء والتحذيرات', icon: FileWarning, color: 'text-destructive' },
  { id: 'ai', label: 'تقارير أداء AI', icon: Brain, color: 'text-purple-500' },
  { id: 'security', label: 'الثغرات الأمنية', icon: Shield, color: 'text-amber-500' },
  { id: 'resources', label: 'مراقبة الموارد', icon: Cpu, color: 'text-blue-500' },
  { id: 'alerts', label: 'تنبيهات الاختراق', icon: Bell, color: 'text-red-500' },
  { id: 'dbhealth', label: 'سلامة قاعدة البيانات', icon: Database, color: 'text-emerald-500' },
];

// ============================================
// AI Error Analysis Helper
// ============================================
function generateLocalErrorAnalysis(error: AuditError): { analysis: string; solution: string } {
  const action = error.action.toLowerCase();
  const entityType = error.entity_type.toLowerCase();
  const details = error.details || {};
  const detailsStr = typeof details === 'object' ? JSON.stringify(details) : String(details);

  // Pattern-based intelligent analysis
  if (action.includes('denied') || action.includes('unauthorized')) {
    return {
      analysis: `محاولة وصول غير مصرّح بها على ${error.entity_type}. المستخدم حاول تنفيذ عملية "${error.action}" لكن تم رفضها بواسطة سياسات RLS أو صلاحيات الدور.${detailsStr !== '{}' ? ` تفاصيل: ${detailsStr}` : ''}`,
      solution: `1. تحقق من سياسات RLS على جدول ${error.entity_type} في Supabase Dashboard.\n2. تأكد أن دور المستخدم يملك الصلاحية المطلوبة.\n3. إذا كان الوصول شرعياً، أضف سياسة RLS جديدة تسمح بالعملية.\n4. راجع سجل التدقيق للمستخدم المعني للتأكد من عدم وجود نمط مشبوه.`,
    };
  }

  if (action.includes('block') || action.includes('root') || action.includes('sideload')) {
    return {
      analysis: `تم اكتشاف نشاط أمني خطير: "${error.action}" على ${error.entity_type}. قد يشير هذا لمحاولة تشغيل التطبيق على جهاز مخترق (Root/Jailbreak) أو تحميل جانبي غير مصرح.${detailsStr !== '{}' ? ` بيانات إضافية: ${detailsStr}` : ''}`,
      solution: `1. حظر الجهاز المعني فوراً من لوحة التحكم.\n2. تفعيل التحقق الثنائي لحساب المستخدم.\n3. مراجعة جميع العمليات التي تمت من هذا الجهاز.\n4. التأكد من تفعيل فحوصات أمان التطبيق (Root Detection, Tamper Detection).`,
    };
  }

  if (action.includes('fail') && (action.includes('login') || action.includes('auth'))) {
    return {
      analysis: `فشل في عملية تسجيل الدخول/المصادقة: "${error.action}". قد يكون بسبب بيانات اعتماد خاطئة، جلسة منتهية، أو مشكلة في الشبكة.${detailsStr !== '{}' ? ` التفاصيل: ${detailsStr}` : ''}`,
      solution: `1. تحقق من حالة خدمة Supabase Auth.\n2. راجع إعدادات مزوّد OAuth (Google) في Supabase Dashboard.\n3. تأكد من صحة Redirect URLs.\n4. إذا كان الفشل متكرراً لنفس المستخدم، تواصل معه لإعادة تعيين كلمة المرور.`,
    };
  }

  if (action.includes('fail') && (action.includes('payment') || action.includes('subscription'))) {
    return {
      analysis: `فشل في عملية دفع/اشتراك: "${error.action}" على ${error.entity_type}.${detailsStr !== '{}' ? ` التفاصيل: ${detailsStr}` : ''}`,
      solution: `1. تحقق من حالة الاشتراك في جدول subscription_payments.\n2. تأكد من رفع صورة إيصال الدفع بنجاح.\n3. راجع صلاحيات Storage Bucket.\n4. تحقق من قيود Rate Limiting على عمليات الدفع.`,
    };
  }

  if (action.includes('fail') && entityType.includes('device')) {
    return {
      analysis: `فشل في عملية متعلقة بالجهاز: "${error.action}". قد يكون فشل في تسجيل جهاز جديد أو التحقق من الجلسة النشطة.${detailsStr !== '{}' ? ` التفاصيل: ${detailsStr}` : ''}`,
      solution: `1. تحقق من جدول devices للمستخدم المعني.\n2. تأكد من عمل Edge Function "device-check" بشكل صحيح.\n3. راجع سجلات الـ Edge Function في Supabase Dashboard.\n4. تأكد من أن SERVICE_ROLE_KEY مُعدّ بشكل صحيح.`,
    };
  }

  if (action.includes('fail')) {
    return {
      analysis: `عملية فاشلة: "${error.action}" على ${error.entity_type}. هذا يشير لخطأ في تنفيذ العملية قد يكون بسبب مشكلة في البيانات، الصلاحيات، أو الاتصال.${detailsStr !== '{}' ? ` التفاصيل: ${detailsStr}` : ''}`,
      solution: `1. راجع سجلات Edge Functions ذات الصلة.\n2. تحقق من صحة البيانات المُرسلة في الطلب.\n3. تأكد من سياسات RLS على الجدول المعني.\n4. افحص حالة الاتصال بقاعدة البيانات وخدمات Supabase.`,
    };
  }

  if (action.includes('error')) {
    return {
      analysis: `خطأ في النظام: "${error.action}" متعلق بـ ${error.entity_type}.${detailsStr !== '{}' ? ` المعلومات المتوفرة: ${detailsStr}` : ' لا تتوفر تفاصيل إضافية.'}`,
      solution: `1. افحص سجلات الخادم (Edge Function Logs) للعثور على تفاصيل الخطأ.\n2. تحقق من اتصال قاعدة البيانات.\n3. راجع التبعيات والمكتبات المستخدمة.\n4. أعد تشغيل الخدمة المتأثرة إن أمكن.`,
    };
  }

  // Generic fallback with full details
  return {
    analysis: `حدث "${error.action}" على ${error.entity_type} بتاريخ ${new Date(error.created_at).toLocaleString('ar-EG')}.${detailsStr !== '{}' ? ` البيانات المرفقة: ${detailsStr}` : ' لا توجد بيانات إضافية.'}`,
    solution: `1. راجع السجل الكامل في لوحة تحكم Supabase.\n2. تحقق من الجدول والسياسات المتعلقة بـ ${error.entity_type}.\n3. قارن مع أحداث مشابهة سابقة لتحديد النمط.`,
  };
}

function generateSecurityFindingDetails(finding: { recentErrors: AuditError[] }): { analysis: string; solution: string }[] {
  const results: { analysis: string; solution: string }[] = [];
  
  const denied = finding.recentErrors.filter(e => e.action.toLowerCase().includes('denied') || e.action.toLowerCase().includes('block'));
  denied.forEach(d => {
    const details = d.details && typeof d.details === 'object' ? JSON.stringify(d.details) : '';
    results.push({
      analysis: `⚠️ ${d.action} — ${d.entity_type} في ${new Date(d.created_at).toLocaleString('ar-EG')}${details ? `\nالتفاصيل: ${details}` : ''}`,
      solution: generateLocalErrorAnalysis(d).solution,
    });
  });

  return results;
}

const MonitoringTab: React.FC = () => {
  const [expandedSections, setExpandedSections] = useState<Set<SectionId>>(new Set(['orgs', 'errors']));
  const [orgSummaries, setOrgSummaries] = useState<OrgSummary[]>([]);
  const [recentErrors, setRecentErrors] = useState<AuditError[]>([]);
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [slowOps, setSlowOps] = useState<{ label: string; durationMs: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [resourceMetrics, setResourceMetrics] = useState({
    memoryUsed: 0, memoryTotal: 0, jsHeapSize: 0, domNodes: 0, connectionCount: 0,
  });

  const toggleSection = (id: SectionId) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const timer = performanceMonitor.startTimer('monitoring-data-fetch');
    try {
      const [statsRes, errorsRes, tableChecks] = await Promise.all([
        supabase.rpc('get_organization_stats_rpc'),
        supabase.from('audit_logs')
          .select('id, action, entity_type, created_at, details, organization_id')
          .or('action.ilike.%error%,action.ilike.%fail%,action.ilike.%denied%,action.ilike.%block%')
          .order('created_at', { ascending: false })
          .limit(20),
        Promise.all([
          supabase.from('organizations').select('id', { count: 'exact', head: true }),
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('sales').select('id', { count: 'exact', head: true }),
          supabase.from('products').select('id', { count: 'exact', head: true }),
          supabase.from('customers').select('id', { count: 'exact', head: true }),
        ]),
      ]);

      if (statsRes.data) {
        setOrgSummaries((statsRes.data as any[]).map(s => ({
          org_id: s.org_id,
          org_name: s.org_name,
          total_records: s.total_records,
          employee_count: s.employee_count,
          license_status: s.license_status,
        })));
      }

      if (errorsRes.data) {
        setRecentErrors(errorsRes.data as AuditError[]);
      }

      const checks: HealthCheck[] = [];
      const tableNames = ['organizations', 'profiles', 'sales', 'products', 'customers'];
      tableChecks.forEach((res, i) => {
        checks.push({
          label: `جدول ${tableNames[i]}`,
          status: res.error ? 'error' : 'healthy',
          detail: res.error ? res.error.message : `${res.count ?? 0} سجل`,
          checkedAt: new Date().toISOString(),
        });
      });
      setHealthChecks(checks);

      setSlowOps(performanceMonitor.getSlowOperations().slice(-10));

      const perf = performance as any;
      const mem = perf.memory;
      setResourceMetrics({
        memoryUsed: mem ? Math.round(mem.usedJSHeapSize / 1048576) : 0,
        memoryTotal: mem ? Math.round(mem.totalJSHeapSize / 1048576) : 0,
        jsHeapSize: mem ? Math.round(mem.jsHeapSizeLimit / 1048576) : 0,
        domNodes: document.querySelectorAll('*').length,
        connectionCount: (navigator as any).connection?.downlink || 0,
      });

      setLastRefresh(new Date());
    } catch (err) {
      logger.error('Monitoring fetch failed', 'MonitoringTab');
    } finally {
      timer();
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const recentLogs = logger.getRecentLogs();
  const errorLogs = recentLogs.filter(l => l.level === 'error' || l.level === 'critical');
  const warnLogs = recentLogs.filter(l => l.level === 'warn');

  const aiRecommendations = generateAIRecommendations({
    orgSummaries, recentErrors, healthChecks, slowOps,
    errorLogs: errorLogs.length, warnLogs: warnLogs.length,
    resourceMetrics,
  });

  const securityFindings = generateSecurityFindings({ recentErrors, orgSummaries });
  const breachAlerts = generateBreachAlerts({ recentErrors });

  return (
    <div className="space-y-3">
      {/* Header Stats */}
      <div className="grid grid-cols-4 gap-2">
        <MiniStat icon={Building2} value={orgSummaries.length} label="منشأة" color="text-primary" />
        <MiniStat icon={AlertTriangle} value={recentErrors.length} label="خطأ" color="text-destructive" />
        <MiniStat icon={Zap} value={slowOps.length} label="عملية بطيئة" color="text-amber-500" />
        <MiniStat icon={Heart} value={healthChecks.filter(h => h.status === 'healthy').length} label="سليم" color="text-emerald-500" />
      </div>

      {/* Refresh bar */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] text-muted-foreground font-bold flex items-center gap-1">
          <Clock size={10} /> آخر تحديث: {lastRefresh.toLocaleTimeString('ar-EG')}
        </span>
        <button onClick={fetchData} disabled={loading} className="text-primary text-[10px] font-bold flex items-center gap-1 disabled:opacity-50">
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} /> تحديث
        </button>
      </div>

      {/* Sections */}
      {SECTIONS.map((section) => (
        <div key={section.id} className="card-elevated overflow-hidden">
          <button
            onClick={() => toggleSection(section.id)}
            className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center bg-muted ${section.color}`}>
                <section.icon size={14} />
              </div>
              <span className="text-sm font-black text-foreground">{section.label}</span>
            </div>
            {expandedSections.has(section.id) ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
          </button>

          {expandedSections.has(section.id) && (
            <div className="px-3 pb-3 border-t border-border pt-3">
              {section.id === 'orgs' && <OrgSummarySection summaries={orgSummaries} />}
              {section.id === 'errors' && <ErrorsSection errors={recentErrors} errorLogs={errorLogs} warnLogs={warnLogs} />}
              {section.id === 'ai' && <AIReportsSection recommendations={aiRecommendations} />}
              {section.id === 'security' && <SecuritySection findings={securityFindings} errors={recentErrors} />}
              {section.id === 'resources' && <ResourcesSection metrics={resourceMetrics} />}
              {section.id === 'alerts' && <BreachAlertsSection alerts={breachAlerts} />}
              {section.id === 'dbhealth' && <DBHealthSection checks={healthChecks} />}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ============================================
// Mini Stat Card
// ============================================
const MiniStat: React.FC<{ icon: React.ElementType; value: number; label: string; color: string }> = ({ icon: Icon, value, label, color }) => (
  <div className="card-elevated p-2.5 text-center">
    <Icon size={14} className={`mx-auto mb-1 ${color}`} />
    <p className="text-lg font-black text-foreground">{value}</p>
    <p className="text-[8px] text-muted-foreground font-bold">{label}</p>
  </div>
);

// ============================================
// 1. Org Summary Section
// ============================================
const OrgSummarySection: React.FC<{ summaries: OrgSummary[] }> = ({ summaries }) => {
  if (summaries.length === 0) return <EmptyState text="لا توجد منشآت" />;
  return (
    <div className="space-y-2">
      {summaries.map(s => (
        <div key={s.org_id} className="glass-surface p-3 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-foreground">{s.org_name}</p>
            <p className="text-[10px] text-muted-foreground font-bold">{s.employee_count} موظف · {s.total_records.toLocaleString('ar-EG')} سجل</p>
          </div>
          <span className={`text-[10px] font-black px-2 py-1 rounded-full ${
            s.license_status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-600' :
            s.license_status === 'SUSPENDED' ? 'bg-red-500/10 text-red-500' :
            'bg-muted text-muted-foreground'
          }`}>
            {s.license_status === 'ACTIVE' ? 'نشط' : s.license_status === 'SUSPENDED' ? 'موقوف' : s.license_status || 'جاهز'}
          </span>
        </div>
      ))}
    </div>
  );
};

// ============================================
// 2. Errors & Warnings Section (Enhanced with details & AI solutions)
// ============================================
const ErrorsSection: React.FC<{
  errors: AuditError[];
  errorLogs: readonly any[];
  warnLogs: readonly any[];
}> = ({ errors, errorLogs, warnLogs }) => {
  const [expandedError, setExpandedError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {/* Client-side log summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="glass-surface p-2.5 rounded-2xl text-center">
          <XCircle size={14} className="text-destructive mx-auto mb-1" />
          <p className="text-lg font-black text-destructive">{errorLogs.length}</p>
          <p className="text-[8px] text-muted-foreground font-bold">أخطاء العميل</p>
        </div>
        <div className="glass-surface p-2.5 rounded-2xl text-center">
          <AlertTriangle size={14} className="text-amber-500 mx-auto mb-1" />
          <p className="text-lg font-black text-amber-500">{warnLogs.length}</p>
          <p className="text-[8px] text-muted-foreground font-bold">تحذيرات</p>
        </div>
      </div>

      {/* Recent client errors with details */}
      {errorLogs.length > 0 && (
        <div>
          <p className="text-xs font-black text-foreground mb-2">أخطاء حديثة (جانب العميل)</p>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {errorLogs.slice(-5).reverse().map((log, i) => (
              <div key={i} className="glass-surface p-2.5 rounded-xl space-y-1.5">
                <p className="text-[10px] font-bold text-destructive">{log.message}</p>
                <p className="text-[9px] text-muted-foreground">{log.context || 'عام'} · {new Date(log.timestamp).toLocaleTimeString('ar-EG')}</p>
                {/* AI Solution for client errors */}
                <div className="bg-primary/5 border border-primary/10 rounded-lg p-2 mt-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Lightbulb size={10} className="text-primary" />
                    <span className="text-[9px] font-black text-primary">تحليل ذكي</span>
                  </div>
                  <p className="text-[9px] text-muted-foreground leading-relaxed">
                    {log.context?.includes('Auth') ? 'خطأ في المصادقة. تحقق من صحة الجلسة وإعدادات Supabase Auth.' :
                     log.context?.includes('Network') ? 'مشكلة في الاتصال بالشبكة. تحقق من اتصال الإنترنت وحالة خوادم Supabase.' :
                     log.context?.includes('Device') ? 'خطأ متعلق بالجهاز. تحقق من Edge Function "device-check" وجدول devices.' :
                     'راجع سجلات الأخطاء في وحدة التحكم وتتبع مصدر الخطأ من الـ Stack Trace.'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit log errors with full details and AI analysis */}
      {errors.length > 0 ? (
        <div>
          <p className="text-xs font-black text-foreground mb-2">أحداث مشبوهة من سجل التدقيق</p>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {errors.map(err => {
              const isExpanded = expandedError === err.id;
              const analysis = isExpanded ? generateLocalErrorAnalysis(err) : null;
              
              return (
                <div key={err.id} className="glass-surface rounded-xl overflow-hidden">
                  {/* Error header - clickable */}
                  <button
                    onClick={() => setExpandedError(isExpanded ? null : err.id)}
                    className="w-full p-2.5 text-start hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <AlertCircle size={12} className="text-destructive shrink-0 mt-0.5" />
                        <p className="text-[10px] font-bold text-foreground">{err.action}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[9px] text-muted-foreground">{err.entity_type}</span>
                        {isExpanded ? <ChevronUp size={10} className="text-muted-foreground" /> : <ChevronDown size={10} className="text-muted-foreground" />}
                      </div>
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-0.5 ms-5">
                      {new Date(err.created_at).toLocaleString('ar-EG')}
                      {err.organization_id && ` · منشأة: ${err.organization_id.substring(0, 8)}...`}
                    </p>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && analysis && (
                    <div className="px-2.5 pb-2.5 space-y-2 border-t border-border pt-2 animate-in slide-in-from-top-2 duration-200">
                      {/* Raw details */}
                      {err.details && typeof err.details === 'object' && Object.keys(err.details).length > 0 && (
                        <div className="bg-muted/30 rounded-lg p-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Code size={10} className="text-muted-foreground" />
                            <span className="text-[9px] font-black text-muted-foreground">البيانات الخام</span>
                          </div>
                          <pre className="text-[8px] text-muted-foreground font-mono whitespace-pre-wrap break-all max-h-24 overflow-y-auto" dir="ltr">
                            {JSON.stringify(err.details, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* AI Analysis */}
                      <div className="bg-primary/5 border border-primary/10 rounded-lg p-2.5">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Brain size={11} className="text-primary" />
                          <span className="text-[9px] font-black text-primary">تحليل ذكي للخطأ</span>
                        </div>
                        <p className="text-[9px] text-foreground leading-relaxed">{analysis.analysis}</p>
                      </div>

                      {/* AI Solution */}
                      <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2.5">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Wrench size={11} className="text-emerald-600" />
                          <span className="text-[9px] font-black text-emerald-600">الحل المقترح</span>
                        </div>
                        <div className="text-[9px] text-foreground leading-relaxed whitespace-pre-line">{analysis.solution}</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground font-bold">لا توجد أخطاء في سجل التدقيق</p>
        </div>
      )}
    </div>
  );
};

// ============================================
// 3. AI Performance Reports
// ============================================
interface AIRecommendation {
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  action: string;
}

function generateAIRecommendations(ctx: {
  orgSummaries: OrgSummary[];
  recentErrors: AuditError[];
  healthChecks: HealthCheck[];
  slowOps: any[];
  errorLogs: number;
  warnLogs: number;
  resourceMetrics: any;
}): AIRecommendation[] {
  const recs: AIRecommendation[] = [];

  if (ctx.slowOps.length > 3) {
    recs.push({
      severity: 'warning',
      title: 'عمليات بطيئة متكررة',
      description: `تم رصد ${ctx.slowOps.length} عملية تجاوزت 3 ثوان. قد يؤثر ذلك على تجربة المستخدم.`,
      action: 'مراجعة الاستعلامات البطيئة وتحسين الفهارس في قاعدة البيانات.',
    });
  }

  if (ctx.errorLogs > 5) {
    recs.push({
      severity: 'critical',
      title: 'معدل أخطاء مرتفع',
      description: `${ctx.errorLogs} أخطاء في الجلسة الحالية. يُنصح بمراجعة السجلات فوراً.`,
      action: 'فحص سجلات الأخطاء وتحديد الأنماط المتكررة.',
    });
  }

  if (ctx.resourceMetrics.domNodes > 3000) {
    recs.push({
      severity: 'warning',
      title: 'عدد عناصر DOM مرتفع',
      description: `${ctx.resourceMetrics.domNodes} عنصر DOM. قد يؤدي لبطء الواجهة.`,
      action: 'استخدام القوائم الافتراضية (VirtualList) والتحميل الكسول.',
    });
  }

  if (ctx.resourceMetrics.memoryUsed > 200) {
    recs.push({
      severity: 'warning',
      title: 'استهلاك ذاكرة مرتفع',
      description: `${ctx.resourceMetrics.memoryUsed} MB مستخدمة من الذاكرة.`,
      action: 'التحقق من تسرب الذاكرة ومراجعة المكونات غير المحملة.',
    });
  }

  const unhealthy = ctx.healthChecks.filter(h => h.status !== 'healthy');
  if (unhealthy.length > 0) {
    recs.push({
      severity: 'critical',
      title: 'مشاكل في الجداول',
      description: `${unhealthy.length} جداول بها مشاكل: ${unhealthy.map(h => h.label).join(', ')}`,
      action: 'فحص صلاحيات RLS والتأكد من سلامة الجداول.',
    });
  }

  if (ctx.orgSummaries.some(o => o.license_status === 'SUSPENDED')) {
    recs.push({
      severity: 'info',
      title: 'تراخيص موقوفة',
      description: 'يوجد منشآت بتراخيص موقوفة. تأكد من أن ذلك مقصود.',
      action: 'مراجعة التراخيص الموقوفة في تبويب التراخيص.',
    });
  }

  if (recs.length === 0) {
    recs.push({
      severity: 'info',
      title: 'أداء ممتاز',
      description: 'لم يتم رصد أي مشاكل في الأداء. النظام يعمل بكفاءة.',
      action: 'الاستمرار في المراقبة الدورية.',
    });
  }

  return recs;
}

const AIReportsSection: React.FC<{ recommendations: AIRecommendation[] }> = ({ recommendations }) => (
  <div className="space-y-2">
    {recommendations.map((rec, i) => (
      <div key={i} className={`glass-surface p-3 rounded-2xl border-s-4 ${
        rec.severity === 'critical' ? 'border-s-destructive' :
        rec.severity === 'warning' ? 'border-s-amber-500' : 'border-s-primary'
      }`}>
        <div className="flex items-center gap-2 mb-1">
          {rec.severity === 'critical' ? <AlertCircle size={13} className="text-destructive" /> :
           rec.severity === 'warning' ? <AlertTriangle size={13} className="text-amber-500" /> :
           <Info size={13} className="text-primary" />}
          <p className="text-xs font-black text-foreground">{rec.title}</p>
        </div>
        <p className="text-[10px] text-muted-foreground font-medium mb-1">{rec.description}</p>
        <p className="text-[10px] text-primary font-bold">💡 {rec.action}</p>
      </div>
    ))}
  </div>
);

// ============================================
// 4. Security Findings (Enhanced with details)
// ============================================
interface SecurityFinding {
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  fix: string;
  relatedErrors?: AuditError[];
}

function generateSecurityFindings(ctx: { recentErrors: AuditError[]; orgSummaries: OrgSummary[] }): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  const deniedActions = ctx.recentErrors.filter(e => e.action.toLowerCase().includes('denied') || e.action.toLowerCase().includes('block'));
  if (deniedActions.length > 0) {
    findings.push({
      severity: 'high',
      title: 'محاولات وصول مرفوضة',
      description: `${deniedActions.length} محاولة وصول مرفوضة في الفترة الأخيرة.`,
      fix: 'مراجعة سياسات RLS والتأكد من صحة الصلاحيات.',
      relatedErrors: deniedActions,
    });
  }

  const failedActions = ctx.recentErrors.filter(e => e.action.toLowerCase().includes('fail'));
  if (failedActions.length > 3) {
    findings.push({
      severity: 'medium',
      title: 'عمليات فاشلة متكررة',
      description: `${failedActions.length} عملية فاشلة. قد تشير لمحاولات استغلال.`,
      fix: 'فحص سجلات العمليات الفاشلة وتحديد مصدرها.',
      relatedErrors: failedActions,
    });
  }

  if (findings.length === 0) {
    findings.push({
      severity: 'low',
      title: 'لا توجد ثغرات مكتشفة',
      description: 'لم يتم رصد أي نشاط مشبوه أو ثغرات في الوقت الحالي.',
      fix: 'الاستمرار في المراقبة الدورية وتحديث التبعيات.',
    });
  }

  return findings;
}

const SecuritySection: React.FC<{ findings: SecurityFinding[]; errors: AuditError[] }> = ({ findings, errors }) => {
  const [expandedFinding, setExpandedFinding] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {findings.map((f, i) => {
        const isExpanded = expandedFinding === i;
        return (
          <div key={i} className={`glass-surface rounded-2xl border-s-4 overflow-hidden ${
            f.severity === 'high' ? 'border-s-destructive' :
            f.severity === 'medium' ? 'border-s-amber-500' : 'border-s-emerald-500'
          }`}>
            <button
              onClick={() => setExpandedFinding(isExpanded ? null : i)}
              className="w-full p-3 text-start hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <Shield size={13} className={
                  f.severity === 'high' ? 'text-destructive' :
                  f.severity === 'medium' ? 'text-amber-500' : 'text-emerald-500'
                } />
                <p className="text-xs font-black text-foreground">{f.title}</p>
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ms-auto ${
                  f.severity === 'high' ? 'bg-red-500/10 text-red-500' :
                  f.severity === 'medium' ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'
                }`}>
                  {f.severity === 'high' ? 'حرج' : f.severity === 'medium' ? 'متوسط' : 'منخفض'}
                </span>
                {f.relatedErrors && f.relatedErrors.length > 0 && (
                  isExpanded ? <ChevronUp size={10} className="text-muted-foreground" /> : <ChevronDown size={10} className="text-muted-foreground" />
                )}
              </div>
              <p className="text-[10px] text-muted-foreground font-medium mb-1">{f.description}</p>
              <p className="text-[10px] text-primary font-bold">🔧 {f.fix}</p>
            </button>

            {/* Expanded: show related errors with AI analysis */}
            {isExpanded && f.relatedErrors && f.relatedErrors.length > 0 && (
              <div className="px-3 pb-3 space-y-2 border-t border-border pt-2 animate-in slide-in-from-top-2 duration-200">
                <p className="text-[9px] font-black text-muted-foreground">الأحداث المرتبطة ({f.relatedErrors.length})</p>
                {f.relatedErrors.slice(0, 5).map((err, j) => {
                  const analysis = generateLocalErrorAnalysis(err);
                  return (
                    <div key={j} className="bg-muted/20 rounded-lg p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-foreground">{err.action}</span>
                        <span className="text-[8px] text-muted-foreground">{new Date(err.created_at).toLocaleString('ar-EG')}</span>
                      </div>
                      {err.details && typeof err.details === 'object' && Object.keys(err.details).length > 0 && (
                        <pre className="text-[8px] text-muted-foreground font-mono bg-muted/30 rounded p-1.5 whitespace-pre-wrap break-all max-h-16 overflow-y-auto" dir="ltr">
                          {JSON.stringify(err.details, null, 2)}
                        </pre>
                      )}
                      <div className="bg-emerald-500/5 border border-emerald-500/10 rounded p-2">
                        <div className="flex items-center gap-1 mb-1">
                          <Wrench size={9} className="text-emerald-600" />
                          <span className="text-[8px] font-black text-emerald-600">الحل</span>
                        </div>
                        <p className="text-[8px] text-foreground leading-relaxed whitespace-pre-line">{analysis.solution}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ============================================
// 5. Resources Section
// ============================================
const ResourcesSection: React.FC<{ metrics: any }> = ({ metrics }) => {
  const memPercent = metrics.memoryTotal > 0 ? Math.round((metrics.memoryUsed / metrics.memoryTotal) * 100) : 0;
  
  return (
    <div className="space-y-3">
      <div className="glass-surface p-3 rounded-2xl">
        <div className="flex items-center gap-2 mb-2">
          <HardDrive size={13} className="text-blue-500" />
          <span className="text-xs font-black text-foreground">الذاكرة (JS Heap)</span>
        </div>
        {metrics.memoryTotal > 0 ? (
          <>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden mb-1">
              <div className={`h-2 rounded-full transition-all ${memPercent > 80 ? 'bg-destructive' : memPercent > 50 ? 'bg-amber-500' : 'bg-primary'}`}
                style={{ width: `${memPercent}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground font-bold">{metrics.memoryUsed} MB / {metrics.memoryTotal} MB ({memPercent}%)</p>
          </>
        ) : (
          <p className="text-[10px] text-muted-foreground font-bold">غير متوفر في هذا المتصفح</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="glass-surface p-2.5 rounded-2xl text-center">
          <MonitorCheck size={14} className="text-purple-500 mx-auto mb-1" />
          <p className="text-lg font-black text-foreground">{metrics.domNodes.toLocaleString('ar-EG')}</p>
          <p className="text-[8px] text-muted-foreground font-bold">عناصر DOM</p>
        </div>
        <div className="glass-surface p-2.5 rounded-2xl text-center">
          <Activity size={14} className="text-emerald-500 mx-auto mb-1" />
          <p className="text-lg font-black text-foreground">{metrics.connectionCount || '—'}</p>
          <p className="text-[8px] text-muted-foreground font-bold">سرعة الاتصال (Mbps)</p>
        </div>
      </div>

      <div className="glass-surface p-3 rounded-2xl">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={13} className="text-amber-500" />
          <span className="text-xs font-black text-foreground">تحميل الصفحة</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground font-bold">
          <span>DOM Content: {Math.round(performance.timing?.domContentLoadedEventEnd - performance.timing?.navigationStart || 0)} ms</span>
          <span>Full Load: {Math.round(performance.timing?.loadEventEnd - performance.timing?.navigationStart || 0)} ms</span>
        </div>
      </div>
    </div>
  );
};

// ============================================
// 6. Breach Alerts
// ============================================
interface BreachAlert {
  severity: 'warning' | 'critical';
  title: string;
  description: string;
  timestamp: string;
}

function generateBreachAlerts(ctx: { recentErrors: AuditError[] }): BreachAlert[] {
  const alerts: BreachAlert[] = [];

  const blocked = ctx.recentErrors.filter(e =>
    e.action.toLowerCase().includes('block') || e.action.toLowerCase().includes('root') || e.action.toLowerCase().includes('sideload')
  );
  blocked.forEach(b => {
    alerts.push({
      severity: 'critical',
      title: 'نشاط أمني محظور',
      description: `${b.action} — ${b.entity_type}`,
      timestamp: b.created_at,
    });
  });

  const denied = ctx.recentErrors.filter(e => e.action.toLowerCase().includes('denied'));
  if (denied.length >= 3) {
    alerts.push({
      severity: 'warning',
      title: 'محاولات وصول مرفوضة متكررة',
      description: `${denied.length} محاولة مرفوضة في الفترة الأخيرة. قد تشير لمحاولة اختراق.`,
      timestamp: denied[0]?.created_at || new Date().toISOString(),
    });
  }

  return alerts;
}

const BreachAlertsSection: React.FC<{ alerts: BreachAlert[] }> = ({ alerts }) => {
  if (alerts.length === 0) {
    return (
      <div className="text-center py-6">
        <Shield className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
        <p className="text-sm font-black text-foreground">النظام آمن</p>
        <p className="text-[10px] text-muted-foreground font-bold">لم يتم رصد أي تنبيهات اختراق</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((a, i) => (
        <div key={i} className={`glass-surface p-3 rounded-2xl border-s-4 ${a.severity === 'critical' ? 'border-s-destructive' : 'border-s-amber-500'}`}>
          <div className="flex items-center gap-2 mb-1">
            <Bell size={13} className={a.severity === 'critical' ? 'text-destructive' : 'text-amber-500'} />
            <p className="text-xs font-black text-foreground">{a.title}</p>
          </div>
          <p className="text-[10px] text-muted-foreground font-medium">{a.description}</p>
          <p className="text-[9px] text-muted-foreground mt-1">{new Date(a.timestamp).toLocaleString('ar-EG')}</p>
        </div>
      ))}
    </div>
  );
};

// ============================================
// 7. DB Health Section
// ============================================
const DBHealthSection: React.FC<{ checks: HealthCheck[] }> = ({ checks }) => (
  <div className="space-y-2">
    {checks.map((check, i) => (
      <div key={i} className="glass-surface p-3 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          {check.status === 'healthy' ? <CheckCircle2 size={14} className="text-emerald-500" /> :
           check.status === 'warning' ? <AlertTriangle size={14} className="text-amber-500" /> :
           <XCircle size={14} className="text-destructive" />}
          <div>
            <p className="text-xs font-black text-foreground">{check.label}</p>
            <p className="text-[9px] text-muted-foreground font-bold">{check.detail}</p>
          </div>
        </div>
        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
          check.status === 'healthy' ? 'bg-emerald-500/10 text-emerald-600' :
          check.status === 'warning' ? 'bg-amber-500/10 text-amber-600' :
          'bg-red-500/10 text-red-500'
        }`}>
          {check.status === 'healthy' ? 'سليم' : check.status === 'warning' ? 'تحذير' : 'خطأ'}
        </span>
      </div>
    ))}
  </div>
);

// ============================================
// Empty State
// ============================================
const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <div className="text-center py-6 text-muted-foreground">
    <Eye className="w-8 h-8 mx-auto mb-2 opacity-30" />
    <p className="text-xs font-bold">{text}</p>
  </div>
);

export default MonitoringTab;
