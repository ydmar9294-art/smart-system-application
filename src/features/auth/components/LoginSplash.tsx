/**
 * LoginSplash — Cinematic dual liquid collision intro animation.
 *
 * Flow:
 *  1. White screen hold (400ms)
 *  2. Two organic drops rise from bottom-left & bottom-right
 *  3. Drops collide & merge at centre → ripple + splash
 *  4. Colour wave reveals login UI underneath
 */
import React, { useState, useEffect, useCallback } from 'react';

interface LoginSplashProps {
  onComplete: () => void;
  /** Total animation duration in ms (default 3200) */
  duration?: number;
}

const LoginSplash: React.FC<LoginSplashProps> = ({ onComplete, duration = 3200 }) => {
  const [phase, setPhase] = useState<
    'hold' | 'drops' | 'collision' | 'reveal' | 'done'
  >('hold');

  const advance = useCallback(() => {
    setPhase((p) => {
      switch (p) {
        case 'hold': return 'drops';
        case 'drops': return 'collision';
        case 'collision': return 'reveal';
        case 'reveal': return 'done';
        default: return p;
      }
    });
  }, []);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Phase durations
    timers.push(setTimeout(advance, 400));         // hold → drops
    timers.push(setTimeout(advance, 1500));         // drops → collision
    timers.push(setTimeout(advance, 2100));         // collision → reveal
    timers.push(setTimeout(advance, duration));     // reveal → done
    return () => timers.forEach(clearTimeout);
  }, [advance, duration]);

  useEffect(() => {
    if (phase === 'done') onComplete();
  }, [phase, onComplete]);

  if (phase === 'done') return null;

  return (
    <div
      className="fixed inset-0 z-[10000] overflow-hidden"
      style={{ background: '#ffffff' }}
    >
      {/* SVG filter for gooey merge effect */}
      <svg className="absolute w-0 h-0" aria-hidden>
        <defs>
          <filter id="splash-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      {/* Drops container — gooey filter for organic merge */}
      <div
        className="absolute inset-0"
        style={{ filter: 'url(#splash-goo)' }}
      >
        {/* Dark blue drop — bottom-right → centre */}
        <div
          className={`splash-drop splash-drop--blue ${
            phase === 'hold' ? 'splash-drop--hidden' : ''
          } ${phase === 'collision' || phase === 'reveal' ? 'splash-drop--merged' : ''}`}
        />
        {/* White drop — bottom-left → centre */}
        <div
          className={`splash-drop splash-drop--white ${
            phase === 'hold' ? 'splash-drop--hidden' : ''
          } ${phase === 'collision' || phase === 'reveal' ? 'splash-drop--merged' : ''}`}
        />
      </div>

      {/* Collision effects */}
      {(phase === 'collision' || phase === 'reveal') && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {/* Ripple rings */}
          <div className="splash-ripple splash-ripple--1" />
          <div className="splash-ripple splash-ripple--2" />
          <div className="splash-ripple splash-ripple--3" />
          {/* Radial splash particles */}
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="splash-particle"
              style={{
                '--angle': `${i * 45}deg`,
                '--dist': `${60 + Math.random() * 40}px`,
                '--delay': `${i * 40}ms`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}

      {/* Colour wave reveal overlay */}
      <div
        className={`splash-wave ${
          phase === 'reveal' ? 'splash-wave--active' : ''
        }`}
      />

      {/* Fade-out veil */}
      <div
        className={`absolute inset-0 bg-background transition-opacity duration-500 pointer-events-none ${
          phase === 'reveal' ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};

export default LoginSplash;
