import React from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const EmailConfirmed: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir={document.documentElement.dir || 'rtl'}>
      <div className="w-full max-w-md bg-card border border-border rounded-3xl p-8 shadow-2xl text-center space-y-5">
        <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center"><CheckCircle2 className="w-10 h-10 text-primary" /></div>
        <h2 className="text-xl font-black text-foreground">{t('emailConfirmed.title')}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{t('emailConfirmed.description')}</p>
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2"><ShieldCheck className="w-4 h-4" /><span>{t('emailConfirmed.verified')}</span></div>
      </div>
    </div>
  );
};

export default EmailConfirmed;
