import React from 'react';
import { Download, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AppLogo from '@/components/ui/AppLogo';
import { type VersionInfo } from '@/lib/versionCheck';

interface UpdateModalProps { open: boolean; isForce: boolean; versionInfo?: VersionInfo; currentVersion?: string; onDismiss: () => void; }

const UpdateModal: React.FC<UpdateModalProps> = ({ open, isForce, versionInfo, currentVersion, onDismiss }) => {
  const { t } = useTranslation();
  if (!open) return null;
  const handleUpdate = () => { if (versionInfo?.updateUrl) window.open(versionInfo.updateUrl, '_blank'); };

  if (isForce) {
    return (
      <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center overflow-auto" dir={document.documentElement.dir || 'rtl'}
        style={{ paddingTop: 'max(env(safe-area-inset-top, 16px), 16px)', paddingBottom: 'max(env(safe-area-inset-bottom, 16px), 16px)', paddingLeft: 'max(env(safe-area-inset-left, 16px), 16px)', paddingRight: 'max(env(safe-area-inset-right, 16px), 16px)' }}>
        <div className="flex flex-col items-center gap-5 px-5 py-6 max-w-sm w-full text-center my-auto">
          <AppLogo size={56} />
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center shrink-0"><AlertTriangle className="w-7 h-7 text-destructive" /></div>
          <div className="space-y-2">
            <h2 className="text-lg font-black text-foreground">{t('update.forceTitle')}</h2>
            <p className="text-sm text-muted-foreground font-bold leading-relaxed">{t('update.forceDesc', { version: currentVersion })}</p>
          </div>
          {versionInfo?.releaseNotes && <p className="text-xs text-muted-foreground/70 bg-muted rounded-xl px-4 py-3 w-full">{versionInfo.releaseNotes}</p>}
          <div className="w-full space-y-3 pt-2">
            <p className="text-xs text-muted-foreground">{t('update.newVersion')} <strong className="text-foreground">{versionInfo?.latestVersion}</strong></p>
            <button onClick={handleUpdate} className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black text-base shadow-lg active:scale-[0.97] transition-transform flex items-center justify-center gap-2">
              <Download className="w-5 h-5" />{t('update.updateNow')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-end justify-center bg-black/40 animate-in fade-in duration-200" dir={document.documentElement.dir || 'rtl'}>
      <div className="w-full max-w-md bg-card border-t border-border rounded-t-3xl p-5 space-y-4 animate-in slide-in-from-bottom duration-300"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 20px), 20px)' }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><Download className="w-5 h-5 text-primary" /></div>
          <div className="space-y-1 flex-1 min-w-0">
            <h3 className="text-base font-black text-foreground">{t('update.optionalTitle')}</h3>
            <p className="text-xs text-muted-foreground">{t('update.optionalDesc', { version: versionInfo?.latestVersion })}</p>
          </div>
        </div>
        {versionInfo?.releaseNotes && <p className="text-xs text-muted-foreground/70 bg-muted rounded-xl px-3 py-2">{versionInfo.releaseNotes}</p>}
        <div className="flex gap-3">
          <button onClick={handleUpdate} className="flex-1 py-3 bg-primary text-primary-foreground rounded-2xl font-bold text-sm active:scale-[0.97] transition-transform flex items-center justify-center gap-2">
            <Download className="w-4 h-4" />{t('update.update')}
          </button>
          <button onClick={onDismiss} className="flex-1 py-3 bg-muted text-muted-foreground rounded-2xl font-bold text-sm active:scale-[0.97] transition-transform">
            {t('update.later')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateModal;
