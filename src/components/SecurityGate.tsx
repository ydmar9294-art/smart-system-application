import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { runSecurityChecks, clearSecurityCache, SecurityCheckResult } from '@/lib/appSecurity';

interface SecurityGateProps { children: React.ReactNode; blockRooted?: boolean; blockSideloaded?: boolean; }

const SecurityGate: React.FC<SecurityGateProps> = ({ children, blockRooted = false, blockSideloaded = false }) => {
  const { t } = useTranslation();
  const [checkResult, setCheckResult] = useState<SecurityCheckResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const performCheck = useCallback(async () => { clearSecurityCache(); const result = await runSecurityChecks(); setCheckResult(result); }, []);

  useEffect(() => {
    performCheck();
    let listener: any;
    (async () => { try { const { App } = await import('@capacitor/app'); listener = await App.addListener('resume', () => { performCheck(); }); } catch {} })();
    return () => { listener?.remove?.(); };
  }, [performCheck]);

  if (!checkResult) return <>{children}</>;
  const hasIssue = checkResult.isRooted || checkResult.isSideloaded || !checkResult.isSignatureValid;
  if (!hasIssue || dismissed) return <>{children}</>;
  const shouldBlock = (checkResult.isRooted && blockRooted) || (checkResult.isSideloaded && blockSideloaded) || !checkResult.isSignatureValid;

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center p-6" dir={document.documentElement.dir || 'rtl'}>
      <div className="bg-card border border-destructive/30 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-xl font-black text-foreground">{t('security.warning')}</h2>
        <div className="space-y-3 text-sm text-muted-foreground text-start">
          {checkResult.isRooted && (
            <div className="flex items-start gap-3 bg-destructive/5 p-3 rounded-xl"><span className="text-destructive font-bold mt-0.5">⚠</span><div><p className="font-bold text-foreground">{t('security.rootedTitle')}</p><p>{t('security.rootedDesc')}</p></div></div>
          )}
          {checkResult.isSideloaded && (
            <div className="flex items-start gap-3 bg-warning/10 p-3 rounded-xl"><span className="text-warning font-bold mt-0.5">⚠</span><div><p className="font-bold text-foreground">{t('security.sideloadedTitle')}</p><p>{t('security.sideloadedDesc')}</p></div></div>
          )}
          {!checkResult.isSignatureValid && (
            <div className="flex items-start gap-3 bg-destructive/5 p-3 rounded-xl"><span className="text-destructive font-bold mt-0.5">🚫</span><div><p className="font-bold text-foreground">{t('security.invalidSignature')}</p><p>{t('security.invalidSignatureDesc')}</p></div></div>
          )}
        </div>
        {shouldBlock ? (
          <p className="text-destructive font-bold text-sm">{t('security.cannotUse')}</p>
        ) : (
          <button onClick={() => setDismissed(true)} className="w-full bg-primary text-primary-foreground font-black py-4 rounded-2xl hover:opacity-90 transition-all active:scale-[0.98]">
            {t('security.proceedAtOwnRisk')}
          </button>
        )}
      </div>
    </div>
  );
};

export default SecurityGate;
