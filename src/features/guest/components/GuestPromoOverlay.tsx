/**
 * GuestPromoOverlay - Appears every 2 minutes in guest mode
 * Prompts user to book a trial license
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, X, Sparkles } from 'lucide-react';
import { SUPPORT_WHATSAPP } from '@/constants';
import { useGuest } from '@/store/GuestContext';

const GuestPromoOverlay: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { showPromo, dismissPromo } = useGuest();

  if (!showPromo) return null;

  const whatsappMsg = encodeURIComponent(
    i18n.language === 'ar'
      ? 'مرحباً، أود حجز رخصة تجريبية وجلسة شخصية لتحديد احتياجاتي.'
      : 'Hello, I would like to book a trial license and a personal session to define my needs.'
  );
  const whatsappUrl = `https://wa.me/${SUPPORT_WHATSAPP}?text=${whatsappMsg}`;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center animate-in fade-in duration-300">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={dismissPromo} />

      {/* Card */}
      <div className="relative w-[90%] max-w-sm mx-auto animate-in zoom-in-95 slide-in-from-bottom-4 duration-400">
        <div className="bg-background/95 backdrop-blur-2xl rounded-[2rem] p-8 shadow-2xl border border-border/50 text-center">
          {/* Close button */}
          <button
            onClick={dismissPromo}
            className="absolute top-4 end-4 w-8 h-8 rounded-full bg-muted/80 flex items-center justify-center active:scale-95 transition-transform"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>

          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>

          {/* Title */}
          <h3 className="text-lg font-black text-foreground mb-2">
            {t('guest.promoTitle')}
          </h3>

          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            {t('guest.promoMessage')}
          </p>

          {/* WhatsApp CTA */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-[#25D366] text-white font-bold text-sm active:scale-[0.97] transition-all shadow-lg shadow-[#25D366]/20 hover:shadow-[#25D366]/30 mb-3"
          >
            <MessageCircle className="w-5 h-5" />
            {t('guest.contactWhatsApp')}
          </a>

          {/* Dismiss */}
          <button
            onClick={dismissPromo}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors font-bold"
          >
            {t('guest.continueBrowsing')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuestPromoOverlay;
