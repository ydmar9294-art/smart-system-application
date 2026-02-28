/**
 * Privacy Policy Page - Google Play Compliant
 */
import React from 'react';
import { Shield, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="max-w-2xl mx-auto px-4 py-8 safe-area-top safe-area-bottom">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowRight className="w-5 h-5" />
          <span className="font-bold">رجوع</span>
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">سياسة الخصوصية</h1>
            <p className="text-sm text-muted-foreground">آخر تحديث: فبراير 2026</p>
          </div>
        </div>

        <div className="space-y-5 text-foreground">
          <Section title="1. المعلومات التي نجمعها">
            <p>يجمع تطبيق Smart System المعلومات التالية لتقديم الخدمة:</p>
            <ul className="list-disc pr-6 space-y-1 text-muted-foreground">
              <li><strong>بيانات الحساب:</strong> الاسم الكامل، البريد الإلكتروني، رقم الهاتف</li>
              <li><strong>بيانات الأعمال:</strong> الفواتير، المبيعات، المخزون، بيانات العملاء، المشتريات، التسليمات</li>
              <li><strong>بيانات الاستخدام:</strong> سجلات الدخول، معلومات الجهاز، النشاط داخل التطبيق</li>
              <li><strong>بيانات تقنية:</strong> معرف الجهاز، إصدار التطبيق، نظام التشغيل</li>
            </ul>
          </Section>

          <Section title="2. كيف نستخدم المعلومات">
            <ul className="list-disc pr-6 space-y-1 text-muted-foreground">
              <li>تقديم وتحسين خدمات إدارة المخزون والمبيعات</li>
              <li>إدارة حسابات المستخدمين والصلاحيات والأدوار</li>
              <li>إرسال إشعارات متعلقة بالنظام والتحديثات</li>
              <li>ضمان أمان البيانات ومنع الوصول غير المصرح به</li>
              <li>التحقق من هوية المستخدم وسياسة الجهاز الواحد</li>
            </ul>
          </Section>

          <Section title="3. تخزين البيانات وحمايتها">
            <p className="text-muted-foreground">
              يتم تخزين جميع البيانات على خوادم آمنة مشفرة باستخدام بروتوكول HTTPS.
              نطبق سياسات أمان صارمة تشمل عزل بيانات كل منشأة (Row Level Security)،
              تشفير البيانات المحلية بخوارزمية AES-256-GCM، والمصادقة متعددة الطبقات.
            </p>
          </Section>

          <Section title="4. فترة الاحتفاظ بالبيانات">
            <p className="text-muted-foreground">
              نحتفظ ببيانات حسابك طوال فترة استخدامك للخدمة. عند حذف الحساب،
              يتم إزالة أو إخفاء هوية البيانات الشخصية. قد نحتفظ بسجلات المعاملات
              المالية لأغراض قانونية ومحاسبية وفقاً للأنظمة المعمول بها.
            </p>
          </Section>

          <Section title="5. مشاركة البيانات">
            <p className="text-muted-foreground">
              لا نبيع أو نشارك بياناتك الشخصية مع أطراف ثالثة. البيانات محصورة
              داخل منشأتك ولا يمكن لمنشآت أخرى الوصول إليها.
              نستخدم خدمات Supabase لتخزين البيانات وGoogle للمصادقة فقط.
            </p>
          </Section>

          <Section title="6. حقوق المستخدم">
            <ul className="list-disc pr-6 space-y-1 text-muted-foreground">
              <li>الحق في الوصول إلى بياناتك الشخصية</li>
              <li>الحق في تصحيح البيانات غير الدقيقة</li>
              <li>الحق في حذف حسابك وبياناتك من داخل التطبيق</li>
              <li>الحق في سحب الموافقة في أي وقت</li>
            </ul>
          </Section>

          <Section title="7. حذف الحساب">
            <p className="text-muted-foreground">
              يمكنك حذف حسابك في أي وقت من إعدادات التطبيق. عند الحذف:
            </p>
            <ul className="list-disc pr-6 space-y-1 text-muted-foreground">
              <li>يتم إزالة بياناتك الشخصية (الاسم، البريد، الهاتف)</li>
              <li>يتم إلغاء تنشيط حسابك بشكل نهائي</li>
              <li>يتم حذف بيانات الجهاز والإشعارات</li>
              <li>قد تُحفظ سجلات المعاملات المالية لأغراض المراجعة</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              لأصحاب المنشآت: يجب التواصل مع الدعم لطلب حذف المنشأة بالكامل.
            </p>
          </Section>

          <Section title="8. أمان الأطفال">
            <p className="text-muted-foreground">
              هذا التطبيق غير موجه للأطفال دون سن 13 عاماً ولا نجمع بيانات من الأطفال عمداً.
            </p>
          </Section>

          <Section title="9. التغييرات على السياسة">
            <p className="text-muted-foreground">
              قد نقوم بتحديث هذه السياسة من وقت لآخر. سيتم إخطارك بأي تغييرات جوهرية
              عبر إشعار داخل التطبيق.
            </p>
          </Section>

          <Section title="10. الاتصال بنا">
            <p className="text-muted-foreground">
              للاستفسارات المتعلقة بالخصوصية أو لطلب حذف البيانات:
            </p>
            <p className="text-muted-foreground mt-1">
              واتساب: <span className="text-foreground font-bold" dir="ltr">+963 947 744 162</span>
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-card p-5 rounded-2xl shadow-sm border">
    <h2 className="font-black text-foreground mb-3">{title}</h2>
    <div className="text-sm leading-relaxed">{children}</div>
  </div>
);

export default PrivacyPolicy;
