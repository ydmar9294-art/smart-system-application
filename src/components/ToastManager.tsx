import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '@/store/AppContext';
import { AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Notification } from '@/types';

const DISMISS_MS = 2000;
const ANIM_MS = 300;

interface ToastEntry extends Notification {
  exiting?: boolean;
}

export const ToastManager: React.FC = () => {
  const { notifications } = useApp();
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const seenRef = useRef<Set<number>>(new Set());

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), ANIM_MS);
  }, []);

  useEffect(() => {
    if (notifications.length === 0) return;
    const latest = notifications[0];
    if (seenRef.current.has(latest.id)) return;
    seenRef.current.add(latest.id);
    // Keep set bounded
    if (seenRef.current.size > 200) {
      const arr = Array.from(seenRef.current);
      seenRef.current = new Set(arr.slice(-100));
    }
    setToasts(prev => [latest, ...prev].slice(0, 3)); // max 3 visible
    const timer = setTimeout(() => dismiss(latest.id), DISMISS_MS);
    return () => clearTimeout(timer);
  }, [notifications, dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all duration-300 ${
            toast.exiting ? 'opacity-0 -translate-y-2 scale-95' : 'opacity-100 translate-y-0 scale-100 animate-fade-in'
          } ${getGlassStyle(toast.type)}`}
          style={{
            backdropFilter: 'blur(20px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
          }}
        >
          {getIcon(toast.type)}
          <p className="flex-1 font-semibold text-sm text-end leading-relaxed">{toast.message}</p>
        </div>
      ))}
    </div>
  );
};

function getGlassStyle(type: string) {
  switch (type) {
    case 'error':
      return 'bg-red-500/15 border-red-500/25 text-red-700 dark:bg-red-500/20 dark:border-red-400/30 dark:text-red-300 shadow-[0_8px_32px_-8px_rgba(239,68,68,0.3)]';
    case 'warning':
      return 'bg-amber-500/15 border-amber-500/25 text-amber-700 dark:bg-amber-500/20 dark:border-amber-400/30 dark:text-amber-300 shadow-[0_8px_32px_-8px_rgba(245,158,11,0.3)]';
    default:
      return 'bg-emerald-500/15 border-emerald-500/25 text-emerald-700 dark:bg-emerald-500/20 dark:border-emerald-400/30 dark:text-emerald-300 shadow-[0_8px_32px_-8px_rgba(16,185,129,0.3)]';
  }
}

function getIcon(type: string) {
  const cls = "h-5 w-5 shrink-0";
  switch (type) {
    case 'error': return <AlertCircle className={cls} />;
    case 'warning': return <AlertTriangle className={cls} />;
    default: return <CheckCircle2 className={cls} />;
  }
}
