import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useHaptics } from '@/platform/hooks/useHaptics';
import { ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

interface NativeHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  className?: string;
}

export const NativeHeader: React.FC<NativeHeaderProps> = ({
  title,
  showBack = false,
  onBack,
  rightAction,
  className = ''
}) => {
  const navigate = useNavigate();
  const haptics = useHaptics();
  const isNative = Capacitor.isNativePlatform();

  const handleBack = async () => {
    await haptics.impact(ImpactStyle.Light);
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  if (!isNative) {
    return (
      <div className={`px-4 py-3 bg-background border-b border-border ${className}`}>
        <div className="flex items-center justify-between" dir="rtl">
          {showBack && (
            <button onClick={handleBack} className="p-2 rounded-xl hover:bg-muted native-press">
              <ArrowRight size={20} className="text-foreground" />
            </button>
          )}
          <h1 className="text-lg font-black text-foreground flex-1 text-center">{title}</h1>
          {rightAction && <div>{rightAction}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className={`safe-area-top bg-background border-b border-border ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 min-h-[56px]" dir="rtl">
        {showBack ? (
          <button onClick={handleBack} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted native-press">
            <ArrowRight size={22} className="text-foreground" />
          </button>
        ) : (
          <div className="w-10" />
        )}

        <h1 className="text-lg font-black text-foreground absolute left-1/2 -translate-x-1/2">
          {title}
        </h1>

        {rightAction ? (
          <div>{rightAction}</div>
        ) : (
          <div className="w-10" />
        )}
      </div>
    </div>
  );
};
