import React from 'react';

interface AppLogoProps {
  size?: number;
  className?: string;
}

const AppLogo: React.FC<AppLogoProps> = ({ size = 80, className = '' }) => {
  const id = React.useId().replace(/:/g, '');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 300 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Core gradients */}
        <linearGradient id={`${id}-sky`} x1="150" y1="0" x2="150" y2="300" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0a1628" />
          <stop offset="60%" stopColor="#0d2847" />
          <stop offset="100%" stopColor="#132e52" />
        </linearGradient>

        <linearGradient id={`${id}-bldg-front`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a4a7a" />
          <stop offset="100%" stopColor="#0a2040" />
        </linearGradient>
        <linearGradient id={`${id}-bldg-side`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0e3460" />
          <stop offset="100%" stopColor="#061a30" />
        </linearGradient>
        <linearGradient id={`${id}-bldg-top`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2890d8" />
          <stop offset="100%" stopColor="#50c0f0" />
        </linearGradient>

        <linearGradient id={`${id}-arrow`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#20a0e0" />
          <stop offset="100%" stopColor="#70e8ff" />
        </linearGradient>

        <linearGradient id={`${id}-bar`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60d8ff" />
          <stop offset="100%" stopColor="#1870b0" />
        </linearGradient>

        <linearGradient id={`${id}-arc`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1090e0" stopOpacity="0" />
          <stop offset="30%" stopColor="#30b0f0" stopOpacity="0.7" />
          <stop offset="70%" stopColor="#50d0ff" stopOpacity="1" />
          <stop offset="100%" stopColor="#70e0ff" stopOpacity="0.2" />
        </linearGradient>

        <linearGradient id={`${id}-ground`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0a2040" stopOpacity="0" />
          <stop offset="50%" stopColor="#1a5090" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#0a2040" stopOpacity="0" />
        </linearGradient>

        {/* Glow effects */}
        <radialGradient id={`${id}-center-glow`} cx="50%" cy="72%" r="30%">
          <stop offset="0%" stopColor="#40d0ff" stopOpacity="0.5" />
          <stop offset="50%" stopColor="#2090d0" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#0060a0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-hero-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#30b8ff" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#0a1628" stopOpacity="0" />
        </radialGradient>

        <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id={`${id}-glow-lg`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="7" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id={`${id}-glow-sm`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>

        {/* Glass reflection */}
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* Window glow */}
        <filter id={`${id}-win-glow`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Background circle - subtle depth */}
      <circle cx="150" cy="150" r="148" fill={`url(#${id}-sky)`} />
      <circle cx="150" cy="150" r="148" fill={`url(#${id}-hero-glow)`} />

      {/* Subtle ring border */}
      <circle cx="150" cy="150" r="146" stroke="#2080c0" strokeWidth="0.5" fill="none" opacity="0.3" />

      {/* Ground reflection */}
      <ellipse cx="150" cy="222" rx="120" ry="8" fill={`url(#${id}-ground)`} />

      {/* Center glow pool */}
      <ellipse cx="155" cy="218" rx="80" ry="30" fill={`url(#${id}-center-glow)`} />

      {/* Curved data arc */}
      <path
        d="M 40 228 Q 90 198 150 194 Q 210 190 260 215"
        stroke={`url(#${id}-arc)`}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        filter={`url(#${id}-glow-sm)`}
      />
      {/* Arc dots */}
      {[40, 90, 150, 210, 260].map((x, i) => {
        const y = [228, 206, 194, 196, 215][i];
        return (
          <circle key={`dot-${i}`} cx={x} cy={y} r="2" fill="#50d0ff" opacity={0.4 + i * 0.12} filter={`url(#${id}-glow-sm)`} />
        );
      })}

      {/* === LEFT BAR CHARTS === */}
      {[
        { x: 42, h: 20, o: 0.3 },
        { x: 53, h: 30, o: 0.4 },
        { x: 64, h: 40, o: 0.55 },
        { x: 75, h: 52, o: 0.7 },
      ].map((b, i) => (
        <rect key={`lb-${i}`} x={b.x} y={218 - b.h} width="8" height={b.h} rx="2" fill={`url(#${id}-bar)`} opacity={b.o} filter={`url(#${id}-glow-sm)`} />
      ))}

      {/* === BUILDING 1 — Left short === */}
      <g>
        <rect x="88" y="130" width="26" height="88" rx="1.5" fill={`url(#${id}-bldg-front)`} />
        <path d="M114 130 L121 124 L121 212 L114 218" fill={`url(#${id}-bldg-side)`} />
        <path d="M88 130 L95 124 L121 124 L114 130Z" fill={`url(#${id}-bldg-top)`} opacity="0.5" />
        <rect x="88" y="130" width="26" height="88" rx="1.5" fill={`url(#${id}-glass)`} />
        {Array.from({ length: 9 }, (_, r) => (
          <React.Fragment key={`w1-${r}`}>
            <rect x="92" y={136 + r * 9} width="5" height="4" rx="1" fill="#4ad0ff" opacity={0.25 + (r % 3) * 0.2} filter={`url(#${id}-win-glow)`} />
            <rect x="102" y={136 + r * 9} width="5" height="4" rx="1" fill="#4ad0ff" opacity={0.4 - (r % 3) * 0.08} filter={`url(#${id}-win-glow)`} />
          </React.Fragment>
        ))}
      </g>

      {/* === BUILDING 2 — Center-left medium === */}
      <g>
        <rect x="120" y="102" width="28" height="116" rx="1.5" fill={`url(#${id}-bldg-front)`} />
        <path d="M148 102 L156 95 L156 212 L148 218" fill={`url(#${id}-bldg-side)`} />
        <path d="M120 102 L128 95 L156 95 L148 102Z" fill={`url(#${id}-bldg-top)`} opacity="0.55" />
        <rect x="120" y="102" width="28" height="116" rx="1.5" fill={`url(#${id}-glass)`} />
        {Array.from({ length: 12 }, (_, r) => (
          <React.Fragment key={`w2-${r}`}>
            <rect x="124" y={108 + r * 8.5} width="5.5" height="4.5" rx="1" fill="#55d8ff" opacity={0.35 + (r % 4) * 0.14} filter={`url(#${id}-win-glow)`} />
            <rect x="134" y={108 + r * 8.5} width="5.5" height="4.5" rx="1" fill="#55d8ff" opacity={0.55 - (r % 3) * 0.1} filter={`url(#${id}-win-glow)`} />
          </React.Fragment>
        ))}
      </g>

      {/* === BUILDING 3 — Center tallest (hero) === */}
      <g filter={`url(#${id}-glow-sm)`}>
        <rect x="154" y="68" width="32" height="150" rx="1.5" fill={`url(#${id}-bldg-front)`} />
        <path d="M186 68 L195 60 L195 212 L186 218" fill={`url(#${id}-bldg-side)`} />
        <path d="M154 68 L163 60 L195 60 L186 68Z" fill={`url(#${id}-bldg-top)`} opacity="0.6" />
        <rect x="154" y="68" width="32" height="150" rx="1.5" fill={`url(#${id}-glass)`} />
        {/* Antenna */}
        <line x1="170" y1="60" x2="170" y2="46" stroke="#40c0f0" strokeWidth="1.5" opacity="0.7" />
        <circle cx="170" cy="44" r="2.5" fill="#60e0ff" opacity="0.8" filter={`url(#${id}-glow)`} />
        {Array.from({ length: 15 }, (_, r) => (
          <React.Fragment key={`w3-${r}`}>
            <rect x="159" y={75 + r * 9} width="6" height="4.5" rx="1" fill="#65e0ff" opacity={0.4 + (r % 3) * 0.18} filter={`url(#${id}-win-glow)`} />
            <rect x="170" y={75 + r * 9} width="6" height="4.5" rx="1" fill="#65e0ff" opacity={0.65 - (r % 4) * 0.1} filter={`url(#${id}-win-glow)`} />
          </React.Fragment>
        ))}
      </g>

      {/* Hero building base glow */}
      <ellipse cx="170" cy="218" rx="30" ry="7" fill="#40d0ff" opacity="0.3" filter={`url(#${id}-glow-lg)`} />

      {/* === BUILDING 4 — Right medium === */}
      <g>
        <rect x="192" y="112" width="24" height="106" rx="1.5" fill={`url(#${id}-bldg-front)`} />
        <path d="M216 112 L223 106 L223 212 L216 218" fill={`url(#${id}-bldg-side)`} />
        <path d="M192 112 L199 106 L223 106 L216 112Z" fill={`url(#${id}-bldg-top)`} opacity="0.5" />
        <rect x="192" y="112" width="24" height="106" rx="1.5" fill={`url(#${id}-glass)`} />
        {Array.from({ length: 11 }, (_, r) => (
          <React.Fragment key={`w4-${r}`}>
            <rect x="196" y={118 + r * 8.5} width="5" height="4" rx="1" fill="#4ad0ff" opacity={0.3 + (r % 3) * 0.18} filter={`url(#${id}-win-glow)`} />
            <rect x="206" y={118 + r * 8.5} width="5" height="4" rx="1" fill="#4ad0ff" opacity={0.5 - (r % 3) * 0.1} filter={`url(#${id}-win-glow)`} />
          </React.Fragment>
        ))}
      </g>

      {/* === RIGHT BAR CHARTS === */}
      {[
        { x: 222, h: 42, o: 0.5 },
        { x: 233, h: 54, o: 0.6 },
        { x: 244, h: 68, o: 0.75 },
        { x: 255, h: 84, o: 0.9 },
      ].map((b, i) => (
        <rect key={`rb-${i}`} x={b.x} y={218 - b.h} width="8" height={b.h} rx="2" fill={`url(#${id}-bar)`} opacity={b.o} filter={`url(#${id}-glow-sm)`} />
      ))}

      {/* === GROWTH ARROWS === */}
      {/* Arrow 1 — Left */}
      <g filter={`url(#${id}-glow)`}>
        <line x1="55" y1="172" x2="76" y2="140" stroke={`url(#${id}-arrow)`} strokeWidth="2.5" strokeLinecap="round" />
        <polygon points="71,136 80,133 75,144" fill="#55ddff" />
      </g>

      {/* Arrow 2 — Center (biggest) */}
      <g filter={`url(#${id}-glow)`}>
        <line x1="135" y1="108" x2="164" y2="56" stroke={`url(#${id}-arrow)`} strokeWidth="3" strokeLinecap="round" />
        <polygon points="158,51 169,48 164,60" fill="#60e8ff" />
      </g>

      {/* Arrow 3 — Right */}
      <g filter={`url(#${id}-glow)`}>
        <line x1="232" y1="128" x2="258" y2="78" stroke={`url(#${id}-arrow)`} strokeWidth="3.2" strokeLinecap="round" />
        <polygon points="252,73 263,69 258,82" fill="#65e8ff" />
      </g>

      {/* Floating particles for depth */}
      {[
        { cx: 60, cy: 80, r: 1.2, o: 0.3 },
        { cx: 240, cy: 60, r: 1, o: 0.25 },
        { cx: 120, cy: 50, r: 0.8, o: 0.2 },
        { cx: 200, cy: 45, r: 1.1, o: 0.3 },
        { cx: 80, cy: 110, r: 0.7, o: 0.15 },
        { cx: 250, cy: 100, r: 0.9, o: 0.2 },
      ].map((p, i) => (
        <circle key={`p-${i}`} cx={p.cx} cy={p.cy} r={p.r} fill="#60d8ff" opacity={p.o} />
      ))}
    </svg>
  );
};

export default AppLogo;
