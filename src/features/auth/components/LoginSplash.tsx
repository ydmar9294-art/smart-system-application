/**
 * LoginSplash — Premium cinematic dual-liquid intro (Apple-level motion).
 *
 * 7 stages:
 *  1. Silence          (0 – 0.4s)   White hold, anticipation
 *  2. Drop creation    (0.4 – 0.7s) Drops appear with fade-in
 *  3. Ascent           (0.7 – 2.0s) Smooth bezier rise toward centre
 *  4. Tension          (2.0 – 2.2s) Pre-merge pause
 *  5. Merge            (2.2 – 2.8s) Calm liquid fusion
 *  6. Materialisation  (2.8 – 3.6s) Reveal wave
 *  7. Done             (3.6s+)      Hand off to login UI
 */
import React, { useState, useEffect, useCallback } from 'react';

type Phase =
  | 'silence'
  | 'ascent'
  | 'tension'
  | 'merge'
  | 'reveal'
  | 'done';

interface LoginSplashProps {
  onComplete: () => void;
}

const TIMINGS = {
  silence: 400,    // silence → ascent
  ascent: 1700,    // ascent → tension
  tension: 2000,   // tension → merge
  merge: 2600,     // merge → reveal
  reveal: 3400,    // reveal → done
} as const;

const LoginSplash: React.FC<LoginSplashProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<Phase>('silence');

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('ascent'), TIMINGS.silence),
      setTimeout(() => setPhase('tension'), TIMINGS.ascent),
      setTimeout(() => setPhase('merge'), TIMINGS.tension),
      setTimeout(() => setPhase('reveal'), TIMINGS.merge),
      setTimeout(() => setPhase('done'), TIMINGS.reveal),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (phase === 'done') onComplete();
  }, [phase, onComplete]);

  if (phase === 'done') return null;

  const dropBlueClass = [
    'splash-drop splash-drop--blue',
    phase === 'ascent' && 'splash-drop--ascending',
    phase === 'tension' && 'splash-drop--tension',
    (phase === 'merge' || phase === 'reveal') && 'splash-drop--merging',
  ].filter(Boolean).join(' ');

  const dropWhiteClass = [
    'splash-drop splash-drop--white',
    phase === 'ascent' && 'splash-drop--ascending',
    phase === 'tension' && 'splash-drop--tension',
    (phase === 'merge' || phase === 'reveal') && 'splash-drop--merging',
  ].filter(Boolean).join(' ');

  const showRipple = phase === 'merge' || phase === 'reveal';
  const showReveal = phase === 'reveal';

  return (
    <div
      className="fixed inset-0 z-[10000] overflow-hidden"
      style={{ background: '#ffffff' }}
    >
      {/* SVG gooey filter for organic merge */}
      <svg className="absolute w-0 h-0" aria-hidden="true">
        <defs>
          <filter id="splash-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      {/* Drops with gooey filter */}
      <div className="absolute inset-0" style={{ filter: 'url(#splash-goo)' }}>
        <div className={dropBlueClass} />
        <div className={dropWhiteClass} />
      </div>

      {/* Subtle ripple at merge point */}
      {showRipple && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="splash-ripple splash-ripple--active" />
          <div className="splash-ripple splash-ripple--2 splash-ripple--active" />
        </div>
      )}

      {/* Reveal wave */}
      <div className={`splash-reveal ${showReveal ? 'splash-reveal--active' : ''}`} />

      {/* Fade to background */}
      <div
        className={`splash-veil bg-background ${showReveal ? 'splash-veil--active' : ''}`}
      />
    </div>
  );
};

export default LoginSplash;
