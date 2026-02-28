/**
 * Update Modal Component
 * Shows force or optional update dialog for hybrid app.
 */

import React from 'react';
import { Download, AlertTriangle } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import { type VersionInfo } from '@/lib/versionCheck';

interface UpdateModalProps {
  open: boolean;
  isForce: boolean;
  versionInfo?: VersionInfo;
  currentVersion?: string;
  onDismiss: () => void;
}

const UpdateModal: React.FC<UpdateModalProps> = ({
  open,
  isForce,
  versionInfo,
  currentVersion,
  onDismiss,
}) => {
  if (!open) return null;

  const handleUpdate = () => {
    if (versionInfo?.updateUrl) {
      window.open(versionInfo.updateUrl, '_blank');
    }
  };

  // Force update = full-screen blocking overlay
  if (isForce) {
    return (
      <div
        className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center safe-area-x"
        dir="rtl"
      >
        <div className="flex flex-col items-center gap-6 px-6 py-8 max-w-sm w-full text-center">
          <AppLogo size={64} />

          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-foreground">تحديث إجباري مطلوب</h2>
            <p className="text-sm text-muted-foreground font-bold leading-relaxed">
              يجب تحديث التطبيق للمتابعة. الإصدار الحالي ({currentVersion}) لم يعد مدعوماً.
            </p>
          </div>

          {versionInfo?.releaseNotes && (
            <p className="text-xs text-muted-foreground/70 bg-muted rounded-xl px-4 py-3 w-full">
              {versionInfo.releaseNotes}
            </p>
          )}

          <div className="w-full space-y-3 pt-2">
            <p className="text-xs text-muted-foreground">
              الإصدار الجديد: <strong className="text-foreground">{versionInfo?.latestVersion}</strong>
            </p>
            <button
              onClick={handleUpdate}
              className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black text-base shadow-lg active:scale-[0.97] transition-transform flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              تحديث الآن
            </button>
          </div>
        </div>

        {/* Safe area bottom spacer */}
        <div className="safe-area-bottom shrink-0" />
      </div>
    );
  }

  // Optional update = dismissible bottom banner
  return (
    <div className="fixed inset-0 z-[9998] flex items-end justify-center bg-black/40 animate-in fade-in duration-200" dir="rtl">
      <div className="w-full max-w-md bg-card border-t border-border rounded-t-3xl p-6 pb-8 safe-area-bottom space-y-4 animate-in slide-in-from-bottom duration-300">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Download className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-1 flex-1 min-w-0">
            <h3 className="text-base font-black text-foreground">تحديث جديد متاح</h3>
            <p className="text-xs text-muted-foreground">
              الإصدار {versionInfo?.latestVersion} متاح للتحميل
            </p>
          </div>
        </div>

        {versionInfo?.releaseNotes && (
          <p className="text-xs text-muted-foreground/70 bg-muted rounded-xl px-3 py-2">
            {versionInfo.releaseNotes}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleUpdate}
            className="flex-1 py-3 bg-primary text-primary-foreground rounded-2xl font-bold text-sm active:scale-[0.97] transition-transform flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            تحديث
          </button>
          <button
            onClick={onDismiss}
            className="flex-1 py-3 bg-muted text-muted-foreground rounded-2xl font-bold text-sm active:scale-[0.97] transition-transform"
          >
            لاحقاً
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateModal;
