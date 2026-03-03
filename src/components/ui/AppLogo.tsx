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
      style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.18))' }}
    >
      <defs>
        {/* Rounded square clip */}
        <clipPath id={`${id}-clip`}>
          <rect x="8" y="8" width="284" height="284" rx="56" ry="56" />
        </clipPath>

        {/* Sky gradient */}
        <linearGradient id={`${id}-sky`} x1="150" y1="0" x2="150" y2="300" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#020a18" />
          <stop offset="40%" stopColor="#071e3d" />
          <stop offset="75%" stopColor="#0f2e52" />
          <stop offset="100%" stopColor="#142840" />
        </linearGradient>

        {/* Building materials */}
        <linearGradient id={`${id}-steel`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a5a8a" />
          <stop offset="30%" stopColor="#1a3e66" />
          <stop offset="100%" stopColor="#0c2240" />
        </linearGradient>
        <linearGradient id={`${id}-steel-dark`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#163050" />
          <stop offset="100%" stopColor="#081828" />
        </linearGradient>
        <linearGradient id={`${id}-roof`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3098d0" />
          <stop offset="100%" stopColor="#58c0e8" />
        </linearGradient>

        {/* Bar chart gradient */}
        <linearGradient id={`${id}-bar`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4dc8f0" />
          <stop offset="100%" stopColor="#1468a0" />
        </linearGradient>

        {/* Arrow gradient */}
        <linearGradient id={`${id}-arrow`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#1898d8" />
          <stop offset="100%" stopColor="#68e0ff" />
        </linearGradient>

        {/* Horizon glow */}
        <radialGradient id={`${id}-horizon`} cx="50%" cy="85%" r="40%">
          <stop offset="0%" stopColor="#2098d0" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#1060a0" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>

        {/* Street reflection */}
        <linearGradient id={`${id}-street`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a4878" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#0a1e38" stopOpacity="0.8" />
        </linearGradient>

        {/* Glass overlay */}
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.06" />
          <stop offset="50%" stopColor="#fff" stopOpacity="0.01" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.04" />
        </linearGradient>

        {/* Window glow */}
        <filter id={`${id}-wg`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id={`${id}-glow-lg`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>

        {/* Stars twinkle */}
        <radialGradient id={`${id}-star`}>
          <stop offset="0%" stopColor="#c0e8ff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#c0e8ff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* === ROUNDED SQUARE CONTAINER === */}
      <rect x="8" y="8" width="284" height="284" rx="56" ry="56" fill={`url(#${id}-sky)`} />

      {/* Clip all content inside rounded rect */}
      <g clipPath={`url(#${id}-clip)`}>
        {/* Horizon ambient glow */}
        <rect x="0" y="0" width="300" height="300" fill={`url(#${id}-horizon)`} />

        {/* Stars */}
        {[
          [45, 35, 1.2], [88, 22, 0.8], [135, 18, 1], [198, 28, 0.7],
          [245, 20, 0.9], [260, 50, 0.6], [55, 65, 0.7], [170, 38, 0.5],
          [220, 42, 0.8], [110, 45, 0.6],
        ].map(([cx, cy, r], i) => (
          <circle key={`s${i}`} cx={cx} cy={cy} r={r} fill={`url(#${id}-star)`} opacity={0.4 + (i % 3) * 0.2} />
        ))}

        {/* === STREET / GROUND === */}
        <rect x="0" y="218" width="300" height="82" fill={`url(#${id}-street)`} />
        <line x1="20" y1="220" x2="280" y2="220" stroke="#2880b8" strokeWidth="0.8" opacity="0.4" />

        {/* === LEFT BAR CHARTS === */}
        {[
          { x: 36, h: 18, o: 0.35 },
          { x: 47, h: 28, o: 0.45 },
          { x: 58, h: 38, o: 0.6 },
          { x: 69, h: 50, o: 0.75 },
        ].map((b, i) => (
          <g key={`lb${i}`}>
            <rect x={b.x} y={218 - b.h} width="8" height={b.h} rx="1.5" fill={`url(#${id}-bar)`} opacity={b.o} />
            {/* Reflection */}
            <rect x={b.x} y={220} width="8" height={b.h * 0.3} rx="1" fill="#2090c0" opacity={b.o * 0.15} />
          </g>
        ))}

        {/* ========== BUILDINGS ========== */}

        {/* BUILDING 1 — Left short */}
        <g>
          <rect x="82" y="135" width="26" height="83" rx="1" fill={`url(#${id}-steel)`} />
          <path d="M108 135 L115 129 L115 212 L108 218" fill={`url(#${id}-steel-dark)`} />
          <path d="M82 135 L89 129 L115 129 L108 135Z" fill={`url(#${id}-roof)`} opacity="0.45" />
          <rect x="82" y="135" width="26" height="83" rx="1" fill={`url(#${id}-glass)`} />
          {/* Horizontal floor lines */}
          {Array.from({ length: 9 }, (_, i) => (
            <line key={`fl1-${i}`} x1="82" y1={144 + i * 9} x2="108" y2={144 + i * 9} stroke="#1a4060" strokeWidth="0.4" opacity="0.5" />
          ))}
          {/* Windows */}
          {Array.from({ length: 9 }, (_, r) => (
            <React.Fragment key={`w1-${r}`}>
              <rect x="86" y={137 + r * 9} width="5" height="4" rx="0.8" fill={r % 3 === 0 ? '#ffeebb' : '#4ad0ff'} opacity={r % 3 === 0 ? 0.7 : 0.3 + (r % 4) * 0.12} filter={`url(#${id}-wg)`} />
              <rect x="96" y={137 + r * 9} width="5" height="4" rx="0.8" fill={r % 4 === 1 ? '#ffeebb' : '#4ad0ff'} opacity={r % 4 === 1 ? 0.6 : 0.35 + (r % 3) * 0.1} filter={`url(#${id}-wg)`} />
            </React.Fragment>
          ))}
          {/* Building reflection */}
          <rect x="84" y="222" width="22" height="12" rx="1" fill="#1a4070" opacity="0.08" />
        </g>

        {/* BUILDING 2 — Center-left medium */}
        <g>
          <rect x="114" y="105" width="28" height="113" rx="1" fill={`url(#${id}-steel)`} />
          <path d="M142 105 L150 98 L150 212 L142 218" fill={`url(#${id}-steel-dark)`} />
          <path d="M114 105 L122 98 L150 98 L142 105Z" fill={`url(#${id}-roof)`} opacity="0.5" />
          <rect x="114" y="105" width="28" height="113" rx="1" fill={`url(#${id}-glass)`} />
          {Array.from({ length: 12 }, (_, i) => (
            <line key={`fl2-${i}`} x1="114" y1={113 + i * 9} x2="142" y2={113 + i * 9} stroke="#1a4060" strokeWidth="0.4" opacity="0.5" />
          ))}
          {Array.from({ length: 12 }, (_, r) => (
            <React.Fragment key={`w2-${r}`}>
              <rect x="118" y={107 + r * 9} width="5.5" height="4.5" rx="0.8" fill={r % 5 === 0 ? '#ffeebb' : '#50d0ff'} opacity={r % 5 === 0 ? 0.7 : 0.3 + (r % 4) * 0.13} filter={`url(#${id}-wg)`} />
              <rect x="129" y={107 + r * 9} width="5.5" height="4.5" rx="0.8" fill={r % 3 === 2 ? '#ffeebb' : '#50d0ff'} opacity={r % 3 === 2 ? 0.6 : 0.4 + (r % 3) * 0.1} filter={`url(#${id}-wg)`} />
            </React.Fragment>
          ))}
          <rect x="116" y="222" width="24" height="14" rx="1" fill="#1a4070" opacity="0.08" />
        </g>

        {/* BUILDING 3 — Center tallest (hero) */}
        <g>
          <rect x="148" y="68" width="34" height="150" rx="1" fill={`url(#${id}-steel)`} />
          <path d="M182 68 L191 60 L191 212 L182 218" fill={`url(#${id}-steel-dark)`} />
          <path d="M148 68 L157 60 L191 60 L182 68Z" fill={`url(#${id}-roof)`} opacity="0.55" />
          <rect x="148" y="68" width="34" height="150" rx="1" fill={`url(#${id}-glass)`} />
          {/* Antenna */}
          <line x1="165" y1="60" x2="165" y2="42" stroke="#5ab8e0" strokeWidth="1.2" opacity="0.6" />
          <circle cx="165" cy="40" r="2.5" fill="#60e0ff" opacity="0.85" filter={`url(#${id}-glow)`} />
          <circle cx="165" cy="40" r="1" fill="#fff" opacity="0.7" />
          {Array.from({ length: 16 }, (_, i) => (
            <line key={`fl3-${i}`} x1="148" y1={76 + i * 9} x2="182" y2={76 + i * 9} stroke="#1a4060" strokeWidth="0.4" opacity="0.45" />
          ))}
          {Array.from({ length: 16 }, (_, r) => (
            <React.Fragment key={`w3-${r}`}>
              <rect x="153" y={70 + r * 9} width="6" height="4.5" rx="0.8" fill={r % 4 === 0 ? '#ffeebb' : '#60dcff'} opacity={r % 4 === 0 ? 0.75 : 0.35 + (r % 3) * 0.16} filter={`url(#${id}-wg)`} />
              <rect x="164" y={70 + r * 9} width="6" height="4.5" rx="0.8" fill={r % 5 === 2 ? '#ffeebb' : '#60dcff'} opacity={r % 5 === 2 ? 0.65 : 0.5 + (r % 4) * 0.08} filter={`url(#${id}-wg)`} />
            </React.Fragment>
          ))}
          {/* Hero base glow */}
          <ellipse cx="165" cy="218" rx="28" ry="6" fill="#40c8ff" opacity="0.25" filter={`url(#${id}-glow-lg)`} />
          <rect x="150" y="222" width="30" height="16" rx="1" fill="#1a5080" opacity="0.1" />
        </g>

        {/* BUILDING 4 — Right medium */}
        <g>
          <rect x="188" y="115" width="24" height="103" rx="1" fill={`url(#${id}-steel)`} />
          <path d="M212 115 L219 109 L219 212 L212 218" fill={`url(#${id}-steel-dark)`} />
          <path d="M188 115 L195 109 L219 109 L212 115Z" fill={`url(#${id}-roof)`} opacity="0.45" />
          <rect x="188" y="115" width="24" height="103" rx="1" fill={`url(#${id}-glass)`} />
          {Array.from({ length: 11 }, (_, i) => (
            <line key={`fl4-${i}`} x1="188" y1={123 + i * 9} x2="212" y2={123 + i * 9} stroke="#1a4060" strokeWidth="0.4" opacity="0.5" />
          ))}
          {Array.from({ length: 11 }, (_, r) => (
            <React.Fragment key={`w4-${r}`}>
              <rect x="192" y={117 + r * 9} width="5" height="4" rx="0.8" fill={r % 4 === 3 ? '#ffeebb' : '#48c8ff'} opacity={r % 4 === 3 ? 0.65 : 0.3 + (r % 3) * 0.15} filter={`url(#${id}-wg)`} />
              <rect x="202" y={117 + r * 9} width="5" height="4" rx="0.8" fill={r % 3 === 0 ? '#ffeebb' : '#48c8ff'} opacity={r % 3 === 0 ? 0.55 : 0.4 + (r % 4) * 0.08} filter={`url(#${id}-wg)`} />
            </React.Fragment>
          ))}
          <rect x="190" y="222" width="20" height="12" rx="1" fill="#1a4070" opacity="0.08" />
        </g>

        {/* === RIGHT BAR CHARTS === */}
        {[
          { x: 220, h: 40, o: 0.45 },
          { x: 231, h: 52, o: 0.55 },
          { x: 242, h: 66, o: 0.7 },
          { x: 253, h: 82, o: 0.85 },
        ].map((b, i) => (
          <g key={`rb${i}`}>
            <rect x={b.x} y={218 - b.h} width="8" height={b.h} rx="1.5" fill={`url(#${id}-bar)`} opacity={b.o} />
            <rect x={b.x} y={220} width="8" height={b.h * 0.25} rx="1" fill="#2090c0" opacity={b.o * 0.12} />
          </g>
        ))}

        {/* === GROWTH ARROWS === */}
        <g filter={`url(#${id}-glow)`}>
          <line x1="50" y1="170" x2="70" y2="140" stroke={`url(#${id}-arrow)`} strokeWidth="2.2" strokeLinecap="round" />
          <polygon points="66,136 74,133 70,143" fill="#50d8ff" />
        </g>
        <g filter={`url(#${id}-glow)`}>
          <line x1="130" y1="108" x2="158" y2="55" stroke={`url(#${id}-arrow)`} strokeWidth="2.8" strokeLinecap="round" />
          <polygon points="153,51 163,47 158,59" fill="#58e0ff" />
        </g>
        <g filter={`url(#${id}-glow)`}>
          <line x1="230" y1="130" x2="255" y2="82" stroke={`url(#${id}-arrow)`} strokeWidth="2.8" strokeLinecap="round" />
          <polygon points="250,78 260,74 255,86" fill="#5ce0ff" />
        </g>

        {/* Subtle horizontal street lights */}
        {[60, 150, 240].map((x, i) => (
          <ellipse key={`sl${i}`} cx={x} cy="220" rx="12" ry="2" fill="#40b8e0" opacity="0.1" filter={`url(#${id}-glow)`} />
        ))}
      </g>

      {/* Rounded border */}
      <rect x="8" y="8" width="284" height="284" rx="56" ry="56" stroke="#2a6898" strokeWidth="1" fill="none" opacity="0.35" />
    </svg>
  );
};

export default AppLogo;
