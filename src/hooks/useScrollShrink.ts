import { useEffect, useState } from 'react';

/**
 * Returns true once the window has been scrolled past `threshold` pixels.
 * Used by sticky headers to trigger a "shrink + intensify glass" transition.
 *
 * Listener is passive and rAF-throttled to keep scrolling buttery-smooth
 * on low-end Android devices.
 */
export function useScrollShrink(threshold = 12): boolean {
  const [shrunk, setShrunk] = useState(false);

  useEffect(() => {
    let ticking = false;
    const evaluate = () => {
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      setShrunk((prev) => {
        const next = y > threshold;
        return prev === next ? prev : next;
      });
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(evaluate);
    };

    evaluate();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return shrunk;
}

export default useScrollShrink;
