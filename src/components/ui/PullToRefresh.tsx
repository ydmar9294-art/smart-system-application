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

  const rotation = Math.min(pullDistance / PULL_THRESHOLD, 1) * 360;
  const opacity = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const translateY = Math.min(pullDistance, MAX_PULL);

  return (
    <div id="pull-to-refresh-container" className="relative">
      {/* Pull indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex justify-center z-10 pointer-events-none"
        style={{ opacity: pullDistance > 0 ? opacity : 0 }}
      >
        <div
          className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mt-2"
          style={{ transform: `translateY(${translateY}px)` }}
        >
          <RefreshCw
            size={20}
            className={`text-primary ${isRefreshing ? 'animate-spin' : ''}`}
            style={{ transform: `rotate(${rotation}deg)` }}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ transform: `translateY(${pullDistance > 0 ? translateY / 3 : 0}px)`, transition: pullDistance === 0 ? 'transform 0.3s ease' : 'none' }}>
        {children}
      </div>
    </div>
  );
};
