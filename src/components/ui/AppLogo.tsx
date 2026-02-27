import React from 'react';

interface AppLogoProps {
  size?: number;
  className?: string;
}

const AppLogo: React.FC<AppLogoProps> = ({ size = 80, className = '' }) => {
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
        <linearGradient id="al-blue-v" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5ccfff" />
          <stop offset="100%" stopColor="#0a4a8a" />
        </linearGradient>
        <linearGradient id="al-blue-v2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3aafef" />
          <stop offset="100%" stopColor="#0b3d6e" />
        </linearGradient>
        <linearGradient id="al-face-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0d3a6a" />
          <stop offset="100%" stopColor="#061e3a" />
        </linearGradient>
        <linearGradient id="al-face-side" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a5c9e" />
          <stop offset="100%" stopColor="#0a3058" />
        </linearGradient>
        <linearGradient id="al-face-top" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2080cc" />
          <stop offset="100%" stopColor="#40b0ee" />
        </linearGradient>
        <linearGradient id="al-arrow" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#1a8ad4" />
          <stop offset="100%" stopColor="#60d0ff" />
        </linearGradient>
        <linearGradient id="al-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#50ccff" />
          <stop offset="100%" stopColor="#1060a0" />
        </linearGradient>
        <linearGradient id="al-arc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0a5090" stopOpacity="0.1" />
          <stop offset="30%" stopColor="#1890e0" stopOpacity="0.8" />
          <stop offset="60%" stopColor="#40c0ff" stopOpacity="1" />
          <stop offset="100%" stopColor="#60d0ff" stopOpacity="0.4" />
        </linearGradient>
        <radialGradient id="al-center-glow" cx="50%" cy="70%" r="25%">
          <stop offset="0%" stopColor="#40c8ff" stopOpacity="0.6" />
          <stop offset="60%" stopColor="#1080cc" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#0060aa" stopOpacity="0" />
        </radialGradient>
        <filter id="al-glow1" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="al-glow2" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="al-glow3" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="8" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Central radial glow */}
      <ellipse cx="150" cy="200" rx="90" ry="40" fill="url(#al-center-glow)" />

      {/* Curved arc */}
      <path
        d="M 30 225 Q 80 195 150 190 Q 220 186 270 210"
        stroke="url(#al-arc)"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        filter="url(#al-glow2)"
      />

      {/* === LEFT BAR CHARTS === */}
      <rect x="38" y="195" width="9" height="22" rx="1.5" fill="url(#al-bar)" opacity="0.35" />
      <rect x="50" y="186" width="9" height="31" rx="1.5" fill="url(#al-bar)" opacity="0.45" />
      <rect x="62" y="176" width="9" height="41" rx="1.5" fill="url(#al-bar)" opacity="0.55" />
      <rect x="74" y="166" width="9" height="51" rx="1.5" fill="url(#al-bar)" opacity="0.65" />

      {/* === BUILDING 1 — Left short === */}
      <g>
        <rect x="86" y="125" width="28" height="92" rx="2" fill="url(#al-face-front)" />
        <path d="M 114 125 L 122 118 L 122 210 L 114 217" fill="#0c3562" opacity="0.8" />
        <path d="M 86 125 L 94 118 L 122 118 L 114 125 Z" fill="#1a6ab0" opacity="0.5" />
        {/* Windows */}
        {[0,1,2,3,4,5,6,7,8,9].map(r => (
          <React.Fragment key={`b1-${r}`}>
            <rect x="90" y={131 + r * 8.5} width="5" height="4" rx="0.8" fill="#4ac8ff" opacity={0.3 + (r % 3) * 0.2} />
            <rect x="100" y={131 + r * 8.5} width="5" height="4" rx="0.8" fill="#4ac8ff" opacity={0.5 - (r % 3) * 0.1} />
          </React.Fragment>
        ))}
      </g>

      {/* === BUILDING 2 — Center-left medium === */}
      <g>
        <rect x="120" y="100" width="30" height="117" rx="2" fill="url(#al-face-front)" />
        <path d="M 150 100 L 158 93 L 158 210 L 150 217" fill="#0c3562" opacity="0.75" />
        <path d="M 120 100 L 128 93 L 158 93 L 150 100 Z" fill="#1870b8" opacity="0.55" />
        {[0,1,2,3,4,5,6,7,8,9,10,11].map(r => (
          <React.Fragment key={`b2-${r}`}>
            <rect x="124" y={106 + r * 8.5} width="5.5" height="4.5" rx="0.8" fill="#50d0ff" opacity={0.4 + (r % 4) * 0.15} />
            <rect x="134" y={106 + r * 8.5} width="5.5" height="4.5" rx="0.8" fill="#50d0ff" opacity={0.6 - (r % 3) * 0.15} />
          </React.Fragment>
        ))}
      </g>

      {/* === BUILDING 3 — Center tallest === */}
      <g filter="url(#al-glow2)">
        <rect x="155" y="70" width="32" height="147" rx="2" fill="url(#al-face-front)" />
        <path d="M 187 70 L 196 62 L 196 210 L 187 217" fill="#0e3d6e" opacity="0.8" />
        <path d="M 155 70 L 164 62 L 196 62 L 187 70 Z" fill="#2088cc" opacity="0.6" />
        {[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14].map(r => (
          <React.Fragment key={`b3-${r}`}>
            <rect x="160" y={77 + r * 9} width="6" height="4.5" rx="0.8" fill="#60dcff" opacity={0.5 + (r % 3) * 0.15} />
            <rect x="171" y={77 + r * 9} width="6" height="4.5" rx="0.8" fill="#60dcff" opacity={0.7 - (r % 4) * 0.12} />
          </React.Fragment>
        ))}
      </g>

      {/* Bright glow at base of center building */}
      <ellipse cx="170" cy="217" rx="28" ry="6" fill="#40c8ff" opacity="0.35" filter="url(#al-glow3)" />

      {/* === BUILDING 4 — Right medium === */}
      <g>
        <rect x="192" y="108" width="26" height="104" rx="2" fill="url(#al-face-front)" />
        <path d="M 218 108 L 225 102 L 225 206 L 218 212" fill="#0c3562" opacity="0.7" />
        <path d="M 192 108 L 199 102 L 225 102 L 218 108 Z" fill="#1a6ab0" opacity="0.5" />
        {[0,1,2,3,4,5,6,7,8,9,10].map(r => (
          <React.Fragment key={`b4-${r}`}>
            <rect x="196" y={114 + r * 8.5} width="5" height="4" rx="0.8" fill="#4ac8ff" opacity={0.35 + (r % 3) * 0.18} />
            <rect x="206" y={114 + r * 8.5} width="5" height="4" rx="0.8" fill="#4ac8ff" opacity={0.55 - (r % 3) * 0.12} />
          </React.Fragment>
        ))}
      </g>

      {/* === RIGHT BAR CHARTS === */}
      <rect x="222" y="162" width="9" height="44" rx="1.5" fill="url(#al-bar)" opacity="0.55" />
      <rect x="234" y="148" width="9" height="56" rx="1.5" fill="url(#al-bar)" opacity="0.65" />
      <rect x="246" y="132" width="9" height="70" rx="1.5" fill="url(#al-bar)" opacity="0.75" />
      <rect x="258" y="114" width="9" height="86" rx="1.5" fill="url(#al-bar)" opacity="0.85" />

      {/* === ARROW 1 — Left small === */}
      <g filter="url(#al-glow1)">
        <line x1="52" y1="175" x2="74" y2="142" stroke="url(#al-arrow)" strokeWidth="2.5" strokeLinecap="round" />
        <polygon points="69,138 78,136 73,146" fill="#50ccff" />
      </g>

      {/* === ARROW 2 — Center === */}
      <g filter="url(#al-glow1)">
        <line x1="135" y1="110" x2="165" y2="60" stroke="url(#al-arrow)" strokeWidth="3" strokeLinecap="round" />
        <polygon points="159,55 170,52 165,64" fill="#55ddff" />
      </g>

      {/* === ARROW 3 — Right big === */}
      <g filter="url(#al-glow1)">
        <line x1="230" y1="130" x2="258" y2="80" stroke="url(#al-arrow)" strokeWidth="3.5" strokeLinecap="round" />
        <polygon points="252,75 264,71 258,84" fill="#60e0ff" />
      </g>
    </svg>
  );
};

export default AppLogo;
