/**
 * Account Deletion Info Page - Public URL for Google Play
 */
import React from 'react';
import { Trash2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AccountDeletion: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="max-w-2xl mx-auto px-4 py-8 safe-area-top safe-area-bottom">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowRight className="w-5 h-5" />
          <span className="font-bold">رجوع</span>
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-destructive/10 rounded-2xl flex items-center justify-center">
            <Trash2 className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">حذف الحساب</h1>
            <p className="text-sm text-muted-foreground">معلومات حول حذف حسابك</p>
          </div>
        </div>

        <div className="space-y-5 text-foreground">
          <div className="bg-card p-5 rounded-2xl shadow-sm border">
            <h2 className="font-black text-foreground mb-3">كيفية حذف حسابك</h2>
            <div className="text-sm leading-relaxed text-muted-foreground space-y-2">
              <p>يمكنك حذف حسابك من داخل التطبيق باتباع الخطوات التالية:</p>
              <ol className="list-decimal pr-6 space-y-1">
                <li>افتح التطبيق وسجّل الدخول</li>
                <li>اضغط على أيقونة الإعدادات أو الملف الشخصي</li>
                <li>اختر "حذف الحساب"</li>
                <li>اكتب "حذف" للتأكيد</li>
                <li>اضغط على "تأكيد الحذف"</li>
              </ol>
            </div>
          </div>

          <div className="bg-card p-5 rounded-2xl shadow-sm border">
            <h2 className="font-black text-foreground mb-3">ما يحدث عند الحذف</h2>
            <div className="text-sm leading-relaxed">
              <ul className="list-disc pr-6 space-y-1 text-muted-foreground">
                <li>يتم إزالة بياناتك الشخصية (الاسم، البريد الإلكتروني، رقم الهاتف)</li>
                <li>يتم إلغاء تنشيط حسابك بشكل نهائي</li>
                <li>يتم حذف بيانات الجهاز والإشعارات المرتبطة</li>
                <li>لا يمكن استعادة الحساب بعد الحذف</li>
              </ul>
            </div>
          </div>

          <div className="bg-card p-5 rounded-2xl shadow-sm border">
            <h2 className="font-black text-foreground mb-3">البيانات المحتفظ بها</h2>
            <div className="text-sm leading-relaxed text-muted-foreground">
              <p>
                قد نحتفظ بسجلات المعاملات المالية (المبيعات، المشتريات) لأغراض
                المراجعة والامتثال القانوني، ولكن بدون أي بيانات شخصية تعريفية.
              </p>
            </div>
          </div>

          <div className="bg-card p-5 rounded-2xl shadow-sm border">
            <h2 className="font-black text-foreground mb-3">لأصحاب المنشآت</h2>
            <div className="text-sm leading-relaxed text-muted-foreground">
              <p>
                إذا كنت صاحب منشأة وترغب في حذف المنشأة بالكامل مع جميع البيانات المرتبطة،
                يرجى التواصل مع فريق الدعم عبر واتساب:
              </p>
              <p className="mt-1">
                <span className="text-foreground font-bold" dir="ltr">+963 947 744 162</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountDeletion;
