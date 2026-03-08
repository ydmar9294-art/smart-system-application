import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { X, MessageCircle, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SUPPORT_WHATSAPP_URL } from '@/constants';

const PROMO_INTERVAL_MS = 2 * 60 * 1000;

const GuestPromoOverlay: React.FC = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const isRtl = document.documentElement.dir === 'rtl';
  const show = useCallback(() => setVisible(true), []);

  useEffect(() => {
    const timer = setInterval(show, PROMO_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [show]);

  if (!visible) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-6" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setVisible(false)} />
      <div className="relative z-10 w-full max-w-sm animate-in zoom-in-95 fade-in duration-300">
        <div className="rounded-[2.5rem] overflow-hidden shadow-2xl p-6 space-y-5"
          style={{ background: 'var(--card-glass-bg)', backdropFilter: 'blur(24px) saturate(1.5)', WebkitBackdropFilter: 'blur(24px) saturate(1.5)', border: '1px solid var(--card-glass-border)' }}>
          <button onClick={() => setVisible(false)} className="absolute top-4 left-4 p-2 rounded-xl hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-black text-foreground">{t('guest.likeSystem')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{t('guest.promoText')}</p>
          </div>
          <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 w-full py-3.5 bg-[hsl(142,70%,42%)] text-white rounded-2xl font-black text-sm shadow-lg transition-transform active:scale-[0.97] hover:brightness-110">
            <MessageCircle className="w-5 h-5" />{t('guest.contactWhatsapp')}
          </a>
          <button onClick={() => setVisible(false)} className="w-full text-center text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors font-bold">
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default GuestPromoOverlay;
