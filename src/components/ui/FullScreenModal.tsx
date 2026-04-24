import React, { useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import { useBackButton } from '@/hooks/useBackButton';

interface FullScreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  headerColor?: 'primary' | 'success' | 'destructive' | 'warning' | 'default';
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const headerColors = {
  primary: 'bg-primary text-primary-foreground',
  success: 'bg-success text-white',
  destructive: 'bg-destructive text-white',
  warning: 'bg-warning text-white',
  default: 'bg-card text-foreground'
};

/**
 * FullScreenModal — Mobile-first full-screen overlay.
 *
 * Architecture:
 * - Single fixed container that captures ALL pointer events (no leaks to underlying UI).
 * - Header & footer use normal flex layout (NOT position:fixed) so they stay inside the modal.
 * - Renders via portal to body to avoid z-index conflicts with parent Sheets/Drawers.
 * - Z-index: 200 (above Drawer/Sheet which sit at 50).
 * - Locks body scroll while open.
 */
const FullScreenModal: React.FC<FullScreenModalProps> = ({
  isOpen,
  onClose,
  title,
  icon,
  headerColor = 'default',
  children,
  footer
}) => {
  // Lock body scroll
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Capacitor hardware back button — close modal first
  const handleBack = useCallback(() => {
    onClose();
    return true; // consumed
  }, [onClose]);
  useBackButton(handleBack, isOpen);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 flex flex-col animate-fade-in"
      style={{
        zIndex: 200,
        background: 'hsl(var(--background))',
        // Critical: ensures we capture every touch/click, blocking pass-through
        pointerEvents: 'auto',
        touchAction: 'manipulation',
      }}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        className={`${headerColors[headerColor]} px-4 py-3 flex items-center justify-between shrink-0 shadow-md`}
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      >
        <h2 className="text-base font-black flex items-center gap-2 min-w-0 flex-1">
          {icon}
          <span className="truncate">{title}</span>
        </h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-xl transition-colors active:scale-95 shrink-0"
          aria-label="إغلاق"
          type="button"
        >
          <X size={22} />
        </button>
      </div>

      {/* Body — scrollable */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="p-4 space-y-4">
          {children}
        </div>
      </div>

      {/* Footer */}
      {footer && (
        <div
          className="shrink-0 border-t border-border bg-card p-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
        >
          {footer}
        </div>
      )}
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default FullScreenModal;
