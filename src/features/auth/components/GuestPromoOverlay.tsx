import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X, MessageCircle, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SUPPORT_WHATSAPP_URL, SUPPORT_WHATSAPP } from '@/constants';

/* ── Configurable ────────────────────────────────────── */
const PROMO_INTERVAL_MS = 30 * 1000;      // 30 seconds
const AUTO_DISMISS_MS   = 12 * 1000;      // auto-hide after 12s

/* ── WhatsApp deep-link helper (Capacitor-safe) ─────── */
const openWhatsApp = () => {
  // On mobile Capacitor, wa.me usually opens the native app.
  // We attempt the native intent first; if it fails the browser fallback works.
  const waUrl = `https://wa.me/${SUPPORT_WHATSAPP}`;
  window.open(waUrl, '_blank', 'noopener,noreferrer');
};

const GuestPromoOverlay: React.FC = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const impressionCount = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRtl = document.documentElement.dir === 'rtl';

  const show = useCallback(() => {
    impressionCount.current += 1;
    setVisible(true);

    // Auto-dismiss after AUTO_DISMISS_MS
    dismissRef.current = setTimeout(() => setVisible(false), AUTO_DISMISS_MS);
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    if (dismissRef.current) {
      clearTimeout(dismissRef.current);
      dismissRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Show first promo after 5 seconds, then every PROMO_INTERVAL_MS
    const initialTimer = setTimeout(() => {
      show();
      timerRef.current = setInterval(show, PROMO_INTERVAL_MS);
    }, 5000);
    return () => {
      clearTimeout(initialTimer);
      if (timerRef.current) clearInterval(timerRef.current);
      if (dismissRef.current) clearTimeout(dismissRef.current);
    };
  }, [show]);

  if (!visible) return null;

  /* ── Non-intrusive sliding toast at the bottom ─────── */
  return ReactDOM.createPortal(
    <div
      className="fixed bottom-20 inset-x-0 z-[9997] flex justify-center px-4 pointer-events-none"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="pointer-events-auto w-full max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
        <div
          className="rounded-2xl overflow-hidden shadow-2xl p-4 flex items-start gap-3"
          style={{
            background: 'var(--card-glass-bg)',
            backdropFilter: 'blur(20px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
            border: '1px solid var(--card-glass-border)',
          }}
        >
          {/* Icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-md">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>

          {/* Body */}
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-xs font-bold text-foreground leading-snug">
              {t('guest.likeSystem')}
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {t('guest.promoText')}
            </p>

            <button
              onClick={openWhatsApp}
              data-guest-allow
              className="flex items-center gap-2 px-3 py-2 bg-[hsl(142,70%,42%)] text-white rounded-xl font-bold text-xs shadow transition-transform active:scale-[0.97] hover:brightness-110"
            >
              <MessageCircle className="w-4 h-4" />
              {t('guest.contactWhatsapp')}
            </button>
          </div>

          {/* Close */}
          <button
            onClick={dismiss}
            data-guest-allow
            className="flex-shrink-0 p-1 rounded-lg hover:bg-muted/60 transition-colors"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default GuestPromoOverlay;
