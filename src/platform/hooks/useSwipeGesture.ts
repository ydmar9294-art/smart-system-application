import { useRef, useEffect } from 'react';
import { useHaptics } from './useHaptics';
import { ImpactStyle } from '@capacitor/haptics';

interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  enableHaptics?: boolean;
}

export function useSwipeGesture(options: SwipeOptions) {
  const elementRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const haptics = useHaptics();

  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold = 50,
    enableHaptics = true
  } = options;

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = async (e: TouchEvent) => {
      if (!startX.current || !startY.current) return;

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;

      const diffX = startX.current - endX;
      const diffY = startY.current - endY;

      const absX = Math.abs(diffX);
      const absY = Math.abs(diffY);

      if (absX > absY && absX > threshold) {
        if (enableHaptics) await haptics.impact(ImpactStyle.Light);
        if (diffX > 0 && onSwipeLeft) onSwipeLeft();
        else if (diffX < 0 && onSwipeRight) onSwipeRight();
      } else if (absY > absX && absY > threshold) {
        if (enableHaptics) await haptics.impact(ImpactStyle.Light);
        if (diffY > 0 && onSwipeUp) onSwipeUp();
        else if (diffY < 0 && onSwipeDown) onSwipeDown();
      }

      startX.current = 0;
      startY.current = 0;
    };

    element.addEventListener('touchstart', handleTouchStart);
    element.addEventListener('touchend', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold, enableHaptics, haptics]);

  return elementRef;
}
