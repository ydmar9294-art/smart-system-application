/**
 * Help Center — fullscreen sheet with search, articles, and "restart tour".
 */
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, PlayCircle, Search, X, LifeBuoy } from 'lucide-react';
import { ROLE_ARTICLES, ROLE_LABEL, type HelpRole } from '../helpContent';
import { useBackButton } from '@/hooks/useBackButton';

interface Props {
  role: HelpRole;
  onClose: () => void;
  onStartTour: () => void;
}

const HelpCenterSheet: React.FC<Props> = ({ role, onClose, onStartTour }) => {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const articles = useMemo(() => {
    const all = ROLE_ARTICLES[role];
    const q = query.trim();
    if (!q) return all;
    return all.filter(a =>
      a.title.includes(q) || a.body.includes(q),
    );
  }, [role, query]);

  useBackButton(() => { onClose(); return true; }, true);

  return createPortal(
    <div
      className="fixed inset-0 bg-background flex flex-col"
      style={{
        zIndex: 9999,
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label="دليل الاستخدام"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-card/60 backdrop-blur-xl">
        <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
          <LifeBuoy className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-black text-foreground leading-none">دليل الاستخدام</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            واجهة {ROLE_LABEL[role]}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-muted/60 active:scale-95 transition"
          aria-label="إغلاق"
          type="button"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-3">
          {/* Restart tour CTA */}
          <button
            onClick={onStartTour}
            className="w-full flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-l from-primary/15 to-primary/5 border border-primary/30 active:scale-[0.98] transition"
            type="button"
          >
            <div className="w-11 h-11 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <PlayCircle className="w-6 h-6" />
            </div>
            <div className="flex-1 text-start">
              <p className="font-bold text-foreground text-sm">إعادة تشغيل الجولة التفاعلية</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                سنشرح لك كل زر خطوة بخطوة من جديد.
              </p>
            </div>
          </button>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="ابحث في الدليل..."
              className="w-full h-11 bg-muted/60 rounded-2xl pr-10 pl-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Articles */}
          <div className="space-y-2">
            {articles.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                لا توجد نتائج مطابقة.
              </p>
            )}
            {articles.map(a => {
              const isOpen = openId === a.id;
              return (
                <div
                  key={a.id}
                  className="bg-card/60 rounded-2xl border border-border/40 overflow-hidden"
                >
                  <button
                    onClick={() => setOpenId(isOpen ? null : a.id)}
                    className="w-full flex items-center gap-2 px-4 py-3.5 text-start active:bg-muted/40 transition"
                    type="button"
                  >
                    <span className="flex-1 font-bold text-sm text-foreground">{a.title}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-muted-foreground transition-transform duration-150 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 -mt-1 text-sm text-muted-foreground leading-relaxed whitespace-pre-line animate-in fade-in slide-in-from-top-1 duration-150">
                      {a.body}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default HelpCenterSheet;
