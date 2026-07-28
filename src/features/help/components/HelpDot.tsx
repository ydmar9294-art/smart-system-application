/**
 * Small (?) icon that shows a short explanation popover on tap.
 * Can be placed next to any button/section.
 */
import React, { useRef, useState, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';

interface Props {
  text: string;
  className?: string;
}

const HelpDot: React.FC<Props> = ({ text, className }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative inline-flex ${className || ''}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 active:scale-95 transition"
        aria-label="مساعدة"
      >
        <HelpCircle className="w-4 h-4" />
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute top-full mt-2 right-0 z-[10000] w-64 max-w-[80vw] p-3 rounded-2xl bg-card border border-border shadow-xl text-xs text-foreground leading-relaxed animate-in fade-in zoom-in-95 duration-100"
        >
          {text}
        </div>
      )}
    </div>
  );
};

export default HelpDot;
