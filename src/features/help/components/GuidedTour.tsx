/**
 * Real spotlight coach-mark tour.
 *  - Cuts a rounded hole around the target element using an SVG mask.
 *  - Renders a floating card + arrow pointing at the target.
 *  - Falls back to a centered card if the target isn't in the DOM.
 *  - Auto-scrolls target into view and re-measures on scroll/resize.
 *  - "Don't show again" dismisses the tour permanently for this role.
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';
import type { TourStep } from '../helpContent';
import { useBackButton } from '@/hooks/useBackButton';

interface Props {
  steps: TourStep[];
  onFinish: () => void;
  onSkip: () => void;
  onDismissForever: () => void;
  onJumpTab?: (tabId: string) => void;
  onJumpSub?: (subId: string) => void;
}

interface Rect { top: number; left: number; width: number; height: number }

const PAD = 8;               // spotlight padding around target
const CARD_GAP = 14;         // gap between spotlight and card
const CARD_MAX_W = 340;
const CARD_MARGIN = 12;

const measure = (selector?: string): Rect | null => {
  if (!selector) return null;
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
};

const GuidedTour: React.FC<Props> = ({
  steps, onFinish, onSkip, onDismissForever, onJumpTab, onJumpSub,
}) => {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [vw, setVw] = useState(() => window.innerWidth);
  const [vh, setVh] = useState(() => window.innerHeight);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardH, setCardH] = useState(180);

  const step = steps[index];
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  // Jump to tab/sub-page when step changes
  useEffect(() => {
    if (!step) return;
    if (step.jumpSub && onJumpSub) onJumpSub(step.jumpSub);
    else if (step.jumpTab && onJumpTab) onJumpTab(step.jumpTab);
  }, [step, onJumpTab, onJumpSub]);

  // Poll for target — DOM may take a moment after tab switch
  useLayoutEffect(() => {
    if (!step) return;
    let cancelled = false;
    let raf = 0;
    let tries = 0;
    const tick = () => {
      if (cancelled) return;
      const r = measure(step.target);
      setRect(r);
      if (r) {
        // Scroll into view once, softly
        if (tries === 0) {
          const el = step.target ? document.querySelector(step.target) as HTMLElement | null : null;
          el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }
      tries++;
      if (tries < 40) raf = requestAnimationFrame(tick); // ~650ms of polling
    };
    tick();
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [step]);

  // Track viewport + scroll
  useEffect(() => {
    const update = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
      if (step?.target) setRect(measure(step.target));
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [step]);

  // Card height (for placement math)
  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [index, rect]);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
      else if (e.key === 'ArrowRight') setIndex(i => Math.max(i - 1, 0));       // RTL: right = prev
      else if (e.key === 'ArrowLeft') setIndex(i => Math.min(i + 1, steps.length - 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onSkip, steps.length]);

  useBackButton(() => { onSkip(); return true; }, true);

  const next = useCallback(() => {
    if (isLast) onFinish();
    else setIndex(i => i + 1);
  }, [isLast, onFinish]);
  const prev = useCallback(() => setIndex(i => Math.max(0, i - 1)), []);

  if (!step) return null;

  // --- Placement math ---
  const hole = rect
    ? { x: rect.left - PAD, y: rect.top - PAD, w: rect.width + PAD * 2, h: rect.height + PAD * 2 }
    : null;

  // Card position — prefer above the target on bottom half, below otherwise
  const cardW = Math.min(CARD_MAX_W, vw - CARD_MARGIN * 2);
  let cardTop = (vh - cardH) / 2;
  let cardLeft = (vw - cardW) / 2;
  let arrowSide: 'top' | 'bottom' | null = null;
  let arrowLeft = 0;

  if (hole) {
    const spaceBelow = vh - (hole.y + hole.h) - CARD_GAP;
    const spaceAbove = hole.y - CARD_GAP;
    if (spaceBelow >= cardH + CARD_MARGIN) {
      cardTop = hole.y + hole.h + CARD_GAP;
      arrowSide = 'top';
    } else if (spaceAbove >= cardH + CARD_MARGIN) {
      cardTop = hole.y - cardH - CARD_GAP;
      arrowSide = 'bottom';
    } else {
      // Not enough room — center vertically, no arrow
      cardTop = Math.max(CARD_MARGIN, Math.min(vh - cardH - CARD_MARGIN, (vh - cardH) / 2));
    }
    // Horizontal: try to center card under/above the target, clamp within viewport
    const targetCx = hole.x + hole.w / 2;
    cardLeft = Math.max(CARD_MARGIN, Math.min(vw - cardW - CARD_MARGIN, targetCx - cardW / 2));
    if (arrowSide) {
      arrowLeft = Math.max(20, Math.min(cardW - 20, targetCx - cardLeft));
    }
  }

  return createPortal(
    <div
      className="fixed inset-0"
      style={{ zIndex: 10000 }}
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label="جولة تفاعلية"
    >
      {/* Dim + spotlight cutout via SVG mask */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-auto"
        onClick={onSkip}
        aria-hidden="true"
      >
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {hole && (
              <rect
                x={hole.x} y={hole.y} width={hole.w} height={hole.h}
                rx={14} ry={14} fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%"
          fill="rgba(0,0,0,0.62)"
          mask="url(#tour-mask)"
          style={{ transition: 'all 180ms ease' }}
        />
        {hole && (
          <rect
            x={hole.x} y={hole.y} width={hole.w} height={hole.h}
            rx={14} ry={14}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            style={{ transition: 'all 180ms ease', filter: 'drop-shadow(0 0 8px hsl(var(--primary) / 0.6))' }}
          />
        )}
      </svg>

      {/* Card */}
      <div
        ref={cardRef}
        className="absolute bg-card/95 backdrop-blur-2xl rounded-3xl border border-border/60 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        style={{
          top: cardTop,
          left: cardLeft,
          width: cardW,
          transition: 'top 180ms ease, left 180ms ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Arrow tip */}
        {arrowSide === 'top' && (
          <div
            className="absolute w-3 h-3 bg-card border-t border-r border-border/60 rotate-[-45deg]"
            style={{ top: -6, left: arrowLeft - 6 }}
          />
        )}
        {arrowSide === 'bottom' && (
          <div
            className="absolute w-3 h-3 bg-card border-b border-l border-border/60 rotate-[-45deg]"
            style={{ bottom: -6, left: arrowLeft - 6 }}
          />
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-muted-foreground">
              {index + 1} / {steps.length}
            </span>
          </div>
          <button
            onClick={onSkip}
            className="p-2 rounded-xl hover:bg-muted/60 active:scale-95 transition"
            aria-label="إغلاق"
            type="button"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="mx-5 h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-150"
            style={{ width: `${((index + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Body */}
        <div className="px-5 pt-4 pb-2">
          <h3 className="text-base font-black text-foreground mb-1.5">{step.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {step.body}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 pt-3 pb-4">
          <button
            onClick={onDismissForever}
            className="text-[11px] font-bold text-muted-foreground/80 hover:text-destructive px-1 py-2"
            type="button"
          >
            لا تظهر مجدداً
          </button>
          <div className="flex-1" />
          <button
            onClick={prev}
            disabled={isFirst}
            className="w-9 h-9 rounded-xl bg-muted/60 hover:bg-muted flex items-center justify-center disabled:opacity-40 active:scale-95 transition"
            type="button"
            aria-label="السابق"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={next}
            className="min-w-20 h-9 rounded-xl bg-primary text-primary-foreground font-bold text-sm px-4 flex items-center justify-center gap-1 active:scale-95 transition"
            type="button"
          >
            {isLast ? 'إنهاء' : (
              <>
                التالي
                <ChevronLeft className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default GuidedTour;
