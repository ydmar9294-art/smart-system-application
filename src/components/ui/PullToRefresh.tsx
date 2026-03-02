import React, { useRef, useState, useEffect, useCallback } from 'react';
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
  const [showSuccess, setShowSuccess] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);
  const isPulling = useRef(false);
  const hapticTriggered = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const haptics = useHaptics();

  const PULL_THRESHOLD = 80;
  const MAX_PULL = 130;

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing) return;
    const el = containerRef.current;
    if (!el || el.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    isPulling.current = true;
    hapticTriggered.current = false;
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback(async (e: TouchEvent) => {
    if (!isPulling.current || disabled || isRefreshing) return;
    const el = containerRef.current;
    if (el && el.scrollTop > 0) {
      isPulling.current = false;
      setPullDistance(0);
      return;
    }

    currentY.current = e.touches[0].clientY;
    const distance = Math.max(0, currentY.current - startY.current);
    // Rubber-band damping
    const damped = distance > PULL_THRESHOLD
      ? PULL_THRESHOLD + (distance - PULL_THRESHOLD) * 0.3
      : distance;

    if (damped > 0 && damped <= MAX_PULL) {
      setPullDistance(damped);
      e.preventDefault();

      if (distance >= PULL_THRESHOLD && !hapticTriggered.current) {
        hapticTriggered.current = true;
        await haptics.impact(ImpactStyle.Light);
      }
    }
  }, [disabled, isRefreshing, haptics]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current || disabled) return;
    isPulling.current = false;

    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      await haptics.impact(ImpactStyle.Medium);
      try {
        await onRefresh();
      } catch {
        // silently handle
      }
      setIsRefreshing(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 800);
    }

    setPullDistance(0);
  }, [pullDistance, isRefreshing, disabled, onRefresh, haptics]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || disabled) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, disabled]);

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const rotation = progress * 360;
  const translateY = Math.min(pullDistance, MAX_PULL);
  const ready = pullDistance >= PULL_THRESHOLD;

  return (
    <div ref={containerRef} className="relative pull-refresh-root">
      {/* Liquid-Glass pull indicator */}
      <div
        className="fixed left-0 right-0 flex justify-center z-[9999] pointer-events-none"
        style={{
          top: 'env(safe-area-inset-top, 0px)',
          opacity: pullDistance > 0 || isRefreshing || showSuccess ? 1 : 0,
          transition: pullDistance === 0 ? 'opacity 0.4s ease' : 'none',
        }}
      >
        <div
          className="relative mt-3"
          style={{
            transform: `translateY(${isRefreshing ? 20 : translateY * 0.6}px) scale(${isRefreshing ? 1 : 0.5 + progress * 0.5})`,
            transition: pullDistance === 0 || isRefreshing
              ? 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
              : 'none',
          }}
        >
          {/* Outer glass glow ring */}
          <div
            className="absolute inset-[-6px] rounded-full"
            style={{
              background: ready || isRefreshing
                ? 'radial-gradient(circle, hsl(var(--primary) / 0.25) 0%, transparent 70%)'
                : 'transparent',
              transform: ready || isRefreshing ? 'scale(2.2)' : 'scale(1)',
              opacity: ready || isRefreshing ? 1 : 0,
              transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          />

          {/* Ripple rings */}
          {(ready || isRefreshing) && (
            <>
              <div className="ptr-ripple ptr-ripple-1" />
              <div className="ptr-ripple ptr-ripple-2" />
            </>
          )}

          {/* Main glass orb */}
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
              showSuccess
                ? 'ptr-orb-success'
                : ready || isRefreshing
                  ? 'ptr-orb-active'
                  : 'ptr-orb-idle'
            }`}
          >
            {showSuccess ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-primary">
                <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="ptr-checkmark" />
              </svg>
            ) : (
              <RefreshCw
                size={20}
                className={`transition-colors duration-200 ${
                  ready || isRefreshing ? 'text-primary' : 'text-muted-foreground'
                } ${isRefreshing ? 'animate-spin' : ''}`}
                style={{
                  transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Content with parallax shift */}
      <div
        style={{
          transform: `translateY(${pullDistance > 0 ? translateY / 4 : 0}px)`,
          transition: pullDistance === 0
            ? 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
            : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
};
