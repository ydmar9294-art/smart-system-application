import React from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';

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

const FullScreenModal: React.FC<FullScreenModalProps> = ({
  isOpen,
  onClose,
  title,
  icon,
  headerColor = 'default',
  children,
  footer
}) => {
  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{
        background: 'var(--card-glass-bg)',
        backdropFilter: 'blur(24px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
      }}
    >
      {/* Full Screen Modal Container */}
      <div className="flex flex-col w-full h-full overflow-hidden animate-fade-in">
        {/* Header - Rounded at top on mobile, respects notch */}
        <div
          className={`${headerColors[headerColor]} px-5 py-4 flex items-center justify-between shrink-0 rounded-t-[2rem] mt-2 mx-2 shadow-lg fixed-top-safe`}
          style={{
            boxShadow: 'var(--glass-highlight), 0 4px 20px hsla(0,0%,0%,0.15)',
          }}
        >
          <h2 className="text-lg font-black flex items-center gap-3">
            {icon}
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
            aria-label="إغلاق"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body - Scrollable with glass background */}
        <div
          className="flex-1 overflow-y-auto mx-2"
          style={{
            background: 'var(--card-glass-bg)',
          }}
        >
          <div className="p-5 space-y-5">
            {children}
          </div>
        </div>

        {/* Footer - Fixed at bottom */}
        {footer && (
          <div
            className="shrink-0 p-5 pt-4 mx-2 mb-2 rounded-b-[2rem] fixed-bottom-safe border-t border-border"
            style={{
              background: 'var(--card-glass-bg)',
              backdropFilter: 'blur(var(--glass-blur))',
              WebkitBackdropFilter: 'blur(var(--glass-blur))',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  // Use portal to render modal at document.body level
  return ReactDOM.createPortal(modalContent, document.body);
};

export default FullScreenModal;