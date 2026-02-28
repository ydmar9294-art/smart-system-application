import React, { useRef, useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useHaptics } from '@/platform/hooks/useHaptics';
import { ImpactStyle } from '@capacitor/haptics';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  disabled?: boolean;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  disabled = false
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const currentY = useRef(0);
  const isPulling = useRef(false);
  const hapticTriggered = useRef(false);
  const haptics = useHaptics();

  const PULL_THRESHOLD = 80;
  const MAX_PULL = 120;

  useEffect(() => {
    const container = document.getElementById('pull-to-refresh-container');
    if (!container || disabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0) return;
      startY.current = e.touches[0].clientY;
      isPulling.current = true;
      hapticTriggered.current = false;
    };

    const handleTouchMove = async (e: TouchEvent) => {
      if (!isPulling.current || window.scrollY > 0) return;

      currentY.current = e.touches[0].clientY;
      const distance = Math.max(0, currentY.current - startY.current);

      if (distance > 0 && distance <= MAX_PULL) {
        setPullDistance(distance);
        e.preventDefault();

        if (distance >= PULL_THRESHOLD && !hapticTriggered.current) {
          hapticTriggered.current = true;
          await haptics.impact(ImpactStyle.Light);
        }
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling.current) return;

      if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
        setIsRefreshing(true);
        await haptics.impact(ImpactStyle.Medium);
        await onRefresh();
        setIsRefreshing(false);
      }

      setPullDistance(0);
      isPulling.current = false;
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, isRefreshing, disabled, onRefresh, haptics]);

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const rotation = progress * 360;
  const opacity = progress;
  const translateY = Math.min(pullDistance, MAX_PULL);
  const scale = 0.5 + progress * 0.5;
  const ready = pullDistance >= PULL_THRESHOLD;

  return (
    <div id="pull-to-refresh-container" className="relative">
      {/* Pull indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex justify-center z-10 pointer-events-none"
        style={{
          opacity: pullDistance > 0 ? opacity : 0,
          transition: pullDistance === 0 ? 'opacity 0.3s ease' : 'none',
        }}
      >
        <div
          className="relative mt-2"
          style={{
            transform: `translateY(${translateY}px) scale(${scale})`,
            transition: pullDistance === 0 ? 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
          }}
        >
          {/* Outer ripple ring when ready */}
          <div
            className="absolute inset-0 rounded-full bg-primary/20"
            style={{
              transform: ready ? 'scale(1.6)' : 'scale(1)',
              opacity: ready ? 0.6 : 0,
              transition: 'transform 0.3s ease, opacity 0.3s ease',
            }}
          />
          {/* Inner circle */}
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors duration-200 ${
              ready ? 'bg-primary/20 shadow-lg shadow-primary/20' : 'bg-primary/10'
            }`}
          >
            <RefreshCw
              size={20}
              className={`transition-colors duration-200 ${
                ready ? 'text-primary' : 'text-primary/70'
              } ${isRefreshing ? 'animate-spin' : ''}`}
              style={{
                transform: `rotate(${rotation}deg)`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          transform: `translateY(${pullDistance > 0 ? translateY / 3 : 0}px)`,
          transition: pullDistance === 0 ? 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
};
