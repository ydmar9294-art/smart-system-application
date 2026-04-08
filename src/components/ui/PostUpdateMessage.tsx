/**
 * Post-Update Migration Message
 * Shows a one-time message after androidScheme migration (myapp → https)
 * informing users they need to re-login due to storage origin change.
 */

import React, { useState, useEffect } from 'react';
import { RefreshCw, Info } from 'lucide-react';

const STORAGE_KEY = 'post_update_v2_seen';

const PostUpdateMessage: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable — skip
    }
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4"
      dir="rtl"
    >
      <div className="max-w-sm w-full bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-primary/10 px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <RefreshCw className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-base font-black text-foreground">تم تحديث التطبيق بنجاح!</h2>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              تم ترقية نظام الأمان في هذا التحديث. قد تحتاج لإعادة تسجيل الدخول مرة واحدة فقط.
            </p>
          </div>
          <div className="bg-muted rounded-xl px-4 py-3 space-y-1">
            <p className="text-xs text-muted-foreground">✅ تحسين أمان البيانات المحلية</p>
            <p className="text-xs text-muted-foreground">✅ دعم أجهزة Android القديمة</p>
            <p className="text-xs text-muted-foreground">✅ تحسين سرعة الإقلاع</p>
          </div>
          <p className="text-xs text-muted-foreground/70">
            جميع بياناتك المخزنة على السيرفر آمنة ولن تتأثر.
          </p>
        </div>

        {/* Action */}
        <div className="px-5 pb-5">
          <button
            onClick={handleDismiss}
            className="w-full py-3.5 bg-primary text-primary-foreground rounded-2xl font-bold text-sm active:scale-[0.97] transition-transform"
          >
            فهمت، متابعة
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostUpdateMessage;
