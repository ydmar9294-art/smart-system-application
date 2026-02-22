/**
 * Privacy Policy Page - Part 6: Google Play Store Readiness
 */
import React from 'react';
import { Shield, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="max-w-2xl mx-auto px-4 py-8">
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

        <div className="space-y-6 text-foreground">
          <Section title="1. المعلومات التي نجمعها">
            <p>يجمع تطبيق Smart System المعلومات التالية:</p>
            <ul className="list-disc pr-6 space-y-1 text-muted-foreground">
              <li>بيانات الحساب: الاسم، البريد الإلكتروني، رقم الهاتف</li>
              <li>بيانات الأعمال: الفواتير، المبيعات، المخزون، بيانات العملاء</li>
              <li>بيانات الاستخدام: سجلات الدخول، النشاط داخل التطبيق</li>
            </ul>
          </Section>

          <Section title="2. كيف نستخدم المعلومات">
            <ul className="list-disc pr-6 space-y-1 text-muted-foreground">
              <li>تقديم وتحسين خدمات التطبيق</li>
              <li>إدارة حسابات المستخدمين والصلاحيات</li>
              <li>إرسال إشعارات متعلقة بالنظام</li>
              <li>ضمان أمان البيانات وسلامة النظام</li>
            </ul>
          </Section>

          <Section title="3. حماية البيانات">
            <p className="text-muted-foreground">
              نستخدم تقنيات تشفير متقدمة وسياسات أمان صارمة لحماية بياناتك. يتم تخزين جميع البيانات
              على خوادم آمنة مع تطبيق سياسات الوصول الصارمة (Row Level Security) لضمان عزل بيانات كل منشأة.
            </p>
          </Section>

          <Section title="4. مشاركة البيانات">
            <p className="text-muted-foreground">
              لا نبيع أو نشارك بياناتك الشخصية مع أطراف ثالثة. البيانات محصورة داخل منشأتك
              ولا يمكن لمنشآت أخرى الوصول إليها.
            </p>
          </Section>

          <Section title="5. حقوق المستخدم">
            <ul className="list-disc pr-6 space-y-1 text-muted-foreground">
              <li>الحق في الوصول إلى بياناتك الشخصية</li>
              <li>الحق في تصحيح البيانات غير الدقيقة</li>
              <li>الحق في حذف حسابك وبياناتك</li>
              <li>الحق في تصدير بياناتك</li>
            </ul>
          </Section>

          <Section title="6. الاتصال بنا">
            <p className="text-muted-foreground">
              للاستفسارات المتعلقة بالخصوصية، يمكنك التواصل معنا عبر واتساب على الرقم: +963947744162
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-card p-5 rounded-2xl shadow-sm">
    <h2 className="font-black text-foreground mb-3">{title}</h2>
    <div className="text-sm leading-relaxed">{children}</div>
  </div>
);

export default PrivacyPolicy;
