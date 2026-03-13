import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X, MessageCircle, Sparkles, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SUPPORT_WHATSAPP } from '@/constants';

/* ── Configurable ────────────────────────────────────── */
const PROMO_INTERVAL_MS = 30 * 1000; // 30 seconds

/* ── WhatsApp deep-link helper ─────────────────────── */
const openWhatsApp = () => {
  window.open(`https://wa.me/${SUPPORT_WHATSAPP}`, '_blank', 'noopener,noreferrer');
};

const GuestPromoOverlay: React.FC = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const impressionCount = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRtl = document.documentElement.dir === 'rtl';

  const show = useCallback(() => {
    impressionCount.current += 1;
    setVisible(true);
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
  }, []);

  useEffect(() => {
    // First appearance after 5s, then every PROMO_INTERVAL_MS
    const initial = setTimeout(() => {
      show();
      timerRef.current = setInterval(show, PROMO_INTERVAL_MS);
    }, 5000);
    return () => {
      clearTimeout(initial);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [show]);

  if (!visible) return null;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={dismiss}
      />

      {/* Modal card */}
      <div className="relative w-full max-w-sm animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-300">
        <div
          className="rounded-3xl overflow-hidden shadow-2xl border border-border/50"
          style={{
            background: 'hsl(var(--card))',
          }}
        >
          {/* Header gradient */}
          <div className="relative px-6 pt-8 pb-6 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
            {/* Close button */}
            <button
              onClick={dismiss}
              data-guest-allow
              className="absolute top-3 end-3 p-2 rounded-full hover:bg-muted/60 transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Icon */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg mb-4">
              <Sparkles className="w-8 h-8 text-primary-foreground" />
            </div>

            <h3 className="text-lg font-black text-foreground text-center leading-tight">
              {t('guest.likeSystem')}
            </h3>
          </div>

          {/* Body */}
          <div className="px-6 pb-6 space-y-4">
            <p className="text-sm text-muted-foreground text-center leading-relaxed">
              {t('guest.promoText')}
            </p>

            {/* Features list */}
            <div className="space-y-2">
              {['guest.feature1', 'guest.feature2', 'guest.feature3'].map((key, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-foreground/80">
                  <Star className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span>{t(key)}</span>
                </div>
              ))}
            </div>

            {/* WhatsApp CTA */}
            <button
              onClick={openWhatsApp}
              data-guest-allow
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-[hsl(142,70%,42%)] hover:bg-[hsl(142,70%,38%)] text-white rounded-2xl font-black text-sm shadow-lg transition-all active:scale-[0.97]"
            >
              <MessageCircle className="w-5 h-5" />
              {t('guest.contactWhatsapp')}
            </button>

            {/* Dismiss text */}
            <button
              onClick={dismiss}
              data-guest-allow
              className="w-full text-center text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1"
            >
              {t('guest.continueBrowsing')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default GuestPromoOverlay;
