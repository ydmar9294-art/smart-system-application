/**
 * Terms of Service Page - Google Play Compliant
 */
import React from 'react';
import { FileText, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TermsOfService: React.FC = () => {
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
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">شروط الاستخدام</h1>
            <p className="text-sm text-muted-foreground">آخر تحديث: فبراير 2026</p>
          </div>
        </div>

        <div className="space-y-5 text-foreground">
          <Section title="1. القبول بالشروط">
            <p className="text-muted-foreground">
              باستخدامك لتطبيق Smart System فإنك توافق على الالتزام بهذه الشروط والأحكام.
              إذا لم توافق على أي من هذه الشروط، يجب عليك التوقف عن استخدام التطبيق.
            </p>
          </Section>

          <Section title="2. وصف الخدمة">
            <p className="text-muted-foreground">
              Smart System هو نظام إدارة متكامل للمنشآت يشمل إدارة المخزون، المبيعات،
              العملاء، المشتريات، التسليمات، والتقارير المالية. الخدمة مقدمة عبر تراخيص
              مدفوعة تُصدر من قبل المطور.
            </p>
          </Section>

          <Section title="3. مسؤوليات المستخدم">
            <ul className="list-disc pr-6 space-y-1 text-muted-foreground">
              <li>الحفاظ على سرية بيانات الدخول وعدم مشاركتها</li>
              <li>استخدام التطبيق للأغراض التجارية المشروعة فقط</li>
              <li>عدم محاولة الوصول غير المصرح به لبيانات منشآت أخرى</li>
              <li>الإبلاغ الفوري عن أي استخدام غير مصرح به للحساب</li>
              <li>ضمان دقة البيانات المُدخلة</li>
            </ul>
          </Section>

          <Section title="4. الاستخدام المقبول">
            <p className="text-muted-foreground">يُحظر على المستخدم:</p>
            <ul className="list-disc pr-6 space-y-1 text-muted-foreground">
              <li>استخدام التطبيق لأي نشاط غير قانوني</li>
              <li>محاولة اختراق أو تعطيل النظام</li>
              <li>نسخ أو توزيع أو تعديل التطبيق</li>
              <li>استخدام التطبيق بطريقة تؤثر سلباً على الخدمة</li>
              <li>إدخال بيانات مضللة أو احتيالية</li>
            </ul>
          </Section>

          <Section title="5. التراخيص والاشتراكات">
            <p className="text-muted-foreground">
              يعمل التطبيق بنظام التراخيص. لكل ترخيص حد أقصى للموظفين وفترة صلاحية محددة.
              يحق للمطور تعليق أو إلغاء الترخيص في حالة مخالفة الشروط.
            </p>
          </Section>

          <Section title="6. تعليق الحساب">
            <p className="text-muted-foreground">يحق لنا تعليق أو إنهاء حسابك في الحالات التالية:</p>
            <ul className="list-disc pr-6 space-y-1 text-muted-foreground">
              <li>مخالفة شروط الاستخدام</li>
              <li>انتهاء صلاحية الترخيص</li>
              <li>طلب صاحب المنشأة</li>
              <li>نشاط مشبوه أو غير مصرح به</li>
            </ul>
          </Section>

          <Section title="7. ملكية البيانات">
            <p className="text-muted-foreground">
              تحتفظ المنشأة بملكية بياناتها التجارية المُدخلة في النظام. يحق للمنشأة
              طلب تصدير أو حذف بياناتها وفقاً لسياسة الخصوصية.
            </p>
          </Section>

          <Section title="8. حدود المسؤولية">
            <p className="text-muted-foreground">
              لا نتحمل المسؤولية عن أي خسائر ناتجة عن انقطاع الخدمة، فقدان البيانات
              بسبب سوء الاستخدام، أو أي أضرار غير مباشرة. نبذل قصارى جهدنا لضمان
              استمرارية الخدمة واستقرارها.
            </p>
          </Section>

          <Section title="9. التعديلات">
            <p className="text-muted-foreground">
              نحتفظ بالحق في تعديل هذه الشروط في أي وقت. سيتم إخطارك بالتغييرات
              الجوهرية عبر إشعار داخل التطبيق. استمرارك في استخدام التطبيق يعني
              موافقتك على الشروط المُعدلة.
            </p>
          </Section>

          <Section title="10. الاتصال بنا">
            <p className="text-muted-foreground">
              للاستفسارات المتعلقة بالشروط:
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

export default TermsOfService;
