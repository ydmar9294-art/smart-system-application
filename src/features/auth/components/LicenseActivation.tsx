import React, { useState, useEffect } from 'react';
import { Key, Building2, User, Loader2, CheckCircle2, AlertCircle, Copy, Wallet, LogOut, MessageCircle, Clock, AlertTriangle } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { copyToClipboard } from '@/lib/clipboard';
import { logger } from '@/lib/logger';
import { useShamcashAddress } from '@/hooks/useAppSettings';

interface LicenseActivationProps {
  userId: string;
  email: string;
  fullName: string;
  onSuccess: () => void;
  onLogout: () => void;
}

const WHATSAPP_NUMBER = '963947744162';

const LicenseActivation: React.FC<LicenseActivationProps> = ({ userId, email, fullName, onSuccess, onLogout }) => {
  const { t } = useTranslation();
  const { address: shamcashAddress } = useShamcashAddress();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [codeType, setCodeType] = useState<'unknown' | 'org' | 'employee'>('unknown');
  const [showPayment, setShowPayment] = useState(false);
  const [copiedPayment, setCopiedPayment] = useState(false);

  const handleCopyPayment = async () => { await copyToClipboard(shamcashAddress); setCopiedPayment(true); setTimeout(() => setCopiedPayment(false), 2000); };

  const handleContactSupport = () => {
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
      t('auth.email') + ': ' + email
    )}`, '_blank');
  };

  useEffect(() => {
    const trimmedCode = code.trim().toUpperCase();
    if (trimmedCode.startsWith('EMP-')) setCodeType('employee');
    else if (trimmedCode.length >= 4) setCodeType('org');
    else setCodeType('unknown');
  }, [code]);

  const handleActivation = async () => {
    setError('');
    if (!code.trim()) { setError(t('activation.enterCode')); return; }
    setLoading(true);
    try {
      const trimmedCode = code.trim().toUpperCase();
      if (trimmedCode.startsWith('EMP-')) {
        const { data, error: rpcError } = await supabase.rpc('activate_employee_oauth', { p_user_id: userId, p_google_id: userId, p_email: email, p_full_name: fullName, p_activation_code: trimmedCode });
        if (rpcError) throw rpcError;
        const result = data as { success: boolean; error?: string; message?: string };
        if (!result.success) { setError(result.message || t('activation.activationFailed')); return; }
      } else {
        const { data, error: rpcError } = await supabase.rpc('activate_license_oauth', { p_user_id: userId, p_google_id: userId, p_email: email, p_full_name: fullName, p_license_key: trimmedCode });
        if (rpcError) throw rpcError;
        const result = data as { success: boolean; error?: string; message?: string };
        if (!result.success) { setError(result.message || t('activation.licenseFailed')); return; }
      }
      onSuccess();
    } catch (err: any) {
      logger.error('License activation failed', 'LicenseActivation', { error: err?.message });
      setError(err.message || t('activation.failed'));
    } finally { setLoading(false); }
  };

  const getCodeTypeInfo = () => {
    switch (codeType) {
      case 'org': return { icon: Building2, label: t('activation.orgCode'), description: t('activation.orgCodeDesc'), color: 'text-primary', bgColor: 'bg-primary/10', borderColor: 'border-primary/30', glowColor: 'shadow-primary/20' };
      case 'employee': return { icon: User, label: t('activation.empCode'), description: t('activation.empCodeDesc'), color: 'text-success', bgColor: 'bg-success/10', borderColor: 'border-success/30', glowColor: 'shadow-success/20' };
      default: return { icon: Key, label: t('activation.codeLabel'), description: t('activation.codeDesc'), color: 'text-muted-foreground', bgColor: 'bg-muted', borderColor: 'border-border', glowColor: '' };
    }
  };

  const typeInfo = getCodeTypeInfo();
  const TypeIcon = typeInfo.icon;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between bg-muted/50 p-4 rounded-2xl border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><User className="w-5 h-5 text-primary" /></div>
          <div>
            <p className="font-bold text-foreground text-sm">{fullName || email}</p>
            <p className="text-xs text-muted-foreground">{email}</p>
          </div>
        </div>
        <button onClick={onLogout} className="p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title={t('common.logout')}>
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      <div className="text-center space-y-2 pb-2">
        <div className="w-14 h-14 mx-auto rounded-2xl overflow-hidden flex items-center justify-center mb-3"><AppLogo size={56} /></div>
        <h3 className="text-lg font-black text-foreground">{t('activation.title')}</h3>
        <p className="text-xs text-muted-foreground">{t('activation.subtitle')}</p>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-bold text-foreground flex items-center gap-2"><Key className="w-4 h-4 text-primary" />{t('activation.activationCode')}</label>
        <div className="relative">
          <input type="text" placeholder={t('activation.placeholder')} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} disabled={loading}
            className={`input-field text-center tracking-[0.3em] font-mono text-lg transition-all duration-300 ${codeType !== 'unknown' ? `${typeInfo.bgColor} border-2 ${typeInfo.borderColor} shadow-lg ${typeInfo.glowColor}` : 'bg-muted'}`} dir="ltr" />
        </div>
        <div className={`overflow-hidden transition-all duration-500 ease-out ${code.length > 0 ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className={`flex items-center gap-3 p-4 rounded-2xl ${typeInfo.bgColor} border ${typeInfo.borderColor} transition-all duration-300`}>
            <div className={`w-10 h-10 rounded-xl ${typeInfo.bgColor} flex items-center justify-center`}><TypeIcon className={`w-5 h-5 ${typeInfo.color}`} /></div>
            <div className="flex-1">
              <p className={`text-sm font-black ${typeInfo.color}`}>{typeInfo.label}</p>
              <p className="text-[11px] text-muted-foreground">{typeInfo.description}</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-destructive/10 text-destructive rounded-2xl border border-destructive/20 animate-in slide-in-from-top duration-300">
          <AlertCircle className="w-5 h-5 flex-shrink-0" /><p className="text-sm font-bold">{error}</p>
        </div>
      )}

      <button onClick={handleActivation} disabled={loading || !code}
        className="w-full py-5 bg-foreground text-background rounded-2xl font-black text-base flex items-center justify-center gap-3 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 shadow-xl shadow-foreground/10 hover:shadow-2xl hover:shadow-foreground/20">
        {loading ? (<><Loader2 className="w-5 h-5 animate-spin" />{t('activation.activating')}</>) : (<><CheckCircle2 className="w-5 h-5" />{t('activation.activateAccount')}</>)}
      </button>

      <div className="pt-2 space-y-3">
        <button onClick={() => setShowPayment(!showPayment)}
          className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95">
          <Wallet className="w-5 h-5" />{t('activation.payViaShamcash')}
        </button>
        {showPayment && (
          <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-2xl border border-green-200 dark:border-green-800 space-y-4 animate-in slide-in-from-top duration-300">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 rounded-xl">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-800 dark:text-amber-200 text-xs mb-0.5">{t('activation.importantNote')}</h4>
                  <p className="text-amber-700 dark:text-amber-300 text-[10px] leading-relaxed">{t('activation.paymentNote')}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-blue-700 dark:text-blue-300 font-bold">{t('activation.awaitingConfirmation')}</span>
            </div>
            <div className="space-y-1">
              <p className="text-center text-xs text-gray-600 dark:text-gray-300 font-medium">{t('activation.paymentAddress')}</p>
              <div onClick={handleCopyPayment} className="bg-white dark:bg-gray-800 p-3 rounded-xl flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-green-200 dark:border-green-700">
                <span className="font-mono text-sm text-gray-800 dark:text-gray-200 tracking-wide" dir="ltr">{shamcashAddress}</span>
                {copiedPayment ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> : <Copy className="w-5 h-5 text-gray-400 flex-shrink-0" />}
              </div>
            </div>
            <button onClick={handleContactSupport}
              className="w-full py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95">
              <MessageCircle className="w-4 h-4" />{t('activation.contactFinanceSupport')}
            </button>
          </div>
        )}
      </div>

      <div className="text-center space-y-1 pt-2">
        <p className="text-[11px] text-muted-foreground"><span className="font-bold">{t('activation.orgCodeFormat')}</span> XXXX-XXXX</p>
        <p className="text-[11px] text-muted-foreground"><span className="font-bold">{t('activation.empCodeFormat')}</span> EMP-XXXX-XXXX</p>
      </div>
    </div>
  );
};

export default LicenseActivation;
