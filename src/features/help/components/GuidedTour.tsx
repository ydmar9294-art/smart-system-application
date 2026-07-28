/**
 * Sequential coach-mark cards. Portal at z-[10000], centered, Liquid-Glass.
 * Uses jumpTab/jumpSub callbacks (registered by each dashboard) to navigate
 * to the relevant screen before showing each step.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';
import type { TourStep } from '../helpContent';
import { useBackButton } from '@/hooks/useBackButton';

interface Props {
  steps: TourStep[];
  onFinish: () => void;
  onSkip: () => void;
  onJumpTab?: (tabId: string) => void;
  onJumpSub?: (subId: string) => void;
}

const GuidedTour: React.FC<Props> = ({ steps, onFinish, onSkip, onJumpTab, onJumpSub }) => {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  // Perform jump when step changes
  useEffect(() => {
    if (!step) return;
    if (step.jumpSub && onJumpSub) onJumpSub(step.jumpSub);
    else if (step.jumpTab && onJumpTab) onJumpTab(step.jumpTab);
  }, [step, onJumpTab, onJumpSub]);

  // ESC / Android back to skip
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
      else if (e.key === 'ArrowRight') setIndex(i => Math.min(i + 1, steps.length - 1));
      else if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, 0));
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

  return createPortal(
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center p-4"
      style={{ zIndex: 10000, paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1rem)' }}
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label="جولة تعريفية"
    >
      <div className="absolute inset-0 bg-background/70 backdrop-blur-md" onClick={onSkip} />

      <div
        className="relative w-full max-w-md bg-card/95 backdrop-blur-2xl rounded-3xl border border-border/60 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
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
            aria-label="تخطي الجولة"
            type="button"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mx-5 h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-150"
            style={{ width: `${((index + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Body */}
        <div className="px-5 pt-4 pb-2">
          <h3 className="text-lg font-black text-foreground mb-2">{step.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {step.body}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 pt-3 pb-5">
          <button
            onClick={onSkip}
            className="text-xs font-bold text-muted-foreground hover:text-foreground px-2 py-2"
            type="button"
          >
            تخطي
          </button>
          <div className="flex-1" />
          <button
            onClick={prev}
            disabled={isFirst}
            className="w-10 h-10 rounded-xl bg-muted/60 hover:bg-muted flex items-center justify-center disabled:opacity-40 active:scale-95 transition"
            type="button"
            aria-label="السابق"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            className="min-w-24 h-10 rounded-xl bg-primary text-primary-foreground font-bold text-sm px-4 flex items-center justify-center gap-1 active:scale-95 transition"
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
