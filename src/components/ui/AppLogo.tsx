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
        {/* Building face gradients */}
        <linearGradient id="al-face-dark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b3868" />
          <stop offset="100%" stopColor="#041428" />
        </linearGradient>
        <linearGradient id="al-face-side" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#164f8a" />
          <stop offset="100%" stopColor="#082a50" />
        </linearGradient>
        <linearGradient id="al-face-top" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1a6cb0" />
          <stop offset="100%" stopColor="#30a0e8" />
        </linearGradient>

        {/* Bar chart gradient */}
        <linearGradient id="al-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#50d0ff" />
          <stop offset="50%" stopColor="#1a80cc" />
          <stop offset="100%" stopColor="#0a4070" />
        </linearGradient>
        <linearGradient id="al-bar-glow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#70e0ff" />
          <stop offset="100%" stopColor="#2090dd" />
        </linearGradient>

        {/* Arrow gradient */}
        <linearGradient id="al-arrow" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#1888d0" />
          <stop offset="100%" stopColor="#60ddff" />
        </linearGradient>

        {/* Arc gradient */}
        <linearGradient id="al-arc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0660a0" stopOpacity="0.05" />
          <stop offset="20%" stopColor="#1090e0" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#38c8ff" stopOpacity="1" />
          <stop offset="80%" stopColor="#1090e0" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#0660a0" stopOpacity="0.05" />
        </linearGradient>

        {/* Center glow */}
        <radialGradient id="al-center-glow" cx="50%" cy="65%" r="30%">
          <stop offset="0%" stopColor="#40d0ff" stopOpacity="0.5" />
          <stop offset="50%" stopColor="#1080cc" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#0050aa" stopOpacity="0" />
        </radialGradient>

        {/* Base glow */}
        <radialGradient id="al-base-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#30c0ff" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#0060aa" stopOpacity="0" />
        </radialGradient>

        {/* Window glow */}
        <filter id="al-win-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>

        {/* Glow filters */}
        <filter id="al-glow-sm" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="al-glow-md" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="al-glow-lg" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="10" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* ═══ Background glow ═══ */}
      <ellipse cx="150" cy="210" rx="110" ry="35" fill="url(#al-center-glow)" />

      {/* ═══ Sweeping arc ═══ */}
      <path
        d="M 22 232 Q 75 198 150 194 Q 225 190 278 218"
        stroke="url(#al-arc)"
        strokeWidth="2.8"
        fill="none"
        strokeLinecap="round"
        filter="url(#al-glow-sm)"
      />

      {/* ═══ LEFT BAR CHARTS ═══ */}
      <g opacity="0.9">
        <rect x="32" y="202" width="10" height="18" rx="2" fill="url(#al-bar)" opacity="0.3" />
        <rect x="45" y="192" width="10" height="28" rx="2" fill="url(#al-bar)" opacity="0.4" />
        <rect x="58" y="180" width="10" height="40" rx="2" fill="url(#al-bar)" opacity="0.55" />
        <rect x="71" y="166" width="10" height="54" rx="2" fill="url(#al-bar)" opacity="0.7" />
        {/* Bar top highlights */}
        <rect x="32" y="202" width="10" height="2" rx="1" fill="#70e8ff" opacity="0.4" />
        <rect x="45" y="192" width="10" height="2" rx="1" fill="#70e8ff" opacity="0.5" />
        <rect x="58" y="180" width="10" height="2" rx="1" fill="#70e8ff" opacity="0.6" />
        <rect x="71" y="166" width="10" height="2" rx="1" fill="#70e8ff" opacity="0.7" />
      </g>

      {/* ═══ BUILDING 1 — Left ═══ */}
      <g>
        {/* Front face */}
        <rect x="84" y="130" width="30" height="90" rx="1.5" fill="url(#al-face-dark)" />
        {/* Right face (3D) */}
        <path d="M 114 130 L 123 122 L 123 212 L 114 220" fill="url(#al-face-side)" opacity="0.85" />
        {/* Top face */}
        <path d="M 84 130 L 93 122 L 123 122 L 114 130 Z" fill="url(#al-face-top)" opacity="0.55" />
        {/* Windows — 3 columns × 10 rows */}
        <g filter="url(#al-win-glow)">
          {[...Array(10)].map((_, r) => (
            <React.Fragment key={`b1-${r}`}>
              <rect x="88" y={136 + r * 8.2} width="4.5" height="3.5" rx="0.6" fill="#4cc8ff" opacity={0.25 + (r % 3) * 0.2} />
              <rect x="95" y={136 + r * 8.2} width="4.5" height="3.5" rx="0.6" fill="#4cc8ff" opacity={0.4 + (r % 2) * 0.15} />
              <rect x="102" y={136 + r * 8.2} width="4.5" height="3.5" rx="0.6" fill="#4cc8ff" opacity={0.3 + (r % 3) * 0.15} />
            </React.Fragment>
          ))}
        </g>
      </g>

      {/* ═══ BUILDING 2 — Center-left ═══ */}
      <g>
        <rect x="118" y="98" width="32" height="122" rx="1.5" fill="url(#al-face-dark)" />
        <path d="M 150 98 L 160 89 L 160 212 L 150 220" fill="url(#al-face-side)" opacity="0.8" />
        <path d="M 118 98 L 128 89 L 160 89 L 150 98 Z" fill="url(#al-face-top)" opacity="0.6" />
        <g filter="url(#al-win-glow)">
          {[...Array(13)].map((_, r) => (
            <React.Fragment key={`b2-${r}`}>
              <rect x="122" y={104 + r * 8.5} width="5" height="4" rx="0.6" fill="#50d4ff" opacity={0.35 + (r % 4) * 0.12} />
              <rect x="130" y={104 + r * 8.5} width="5" height="4" rx="0.6" fill="#50d4ff" opacity={0.5 + (r % 3) * 0.1} />
              <rect x="138" y={104 + r * 8.5} width="5" height="4" rx="0.6" fill="#50d4ff" opacity={0.3 + (r % 2) * 0.2} />
            </React.Fragment>
          ))}
        </g>
      </g>

      {/* ═══ BUILDING 3 — Center TALLEST ═══ */}
      <g>
        <rect x="154" y="62" width="36" height="158" rx="1.5" fill="url(#al-face-dark)" />
        <path d="M 190 62 L 201 52 L 201 212 L 190 220" fill="url(#al-face-side)" opacity="0.85" />
        <path d="M 154 62 L 165 52 L 201 52 L 190 62 Z" fill="url(#al-face-top)" opacity="0.65" />
        {/* Bright center glow at base */}
        <ellipse cx="172" cy="220" rx="30" ry="8" fill="#40d0ff" opacity="0.3" filter="url(#al-glow-lg)" />
        {/* Windows — 3 columns × 17 rows */}
        <g filter="url(#al-win-glow)">
          {[...Array(17)].map((_, r) => (
            <React.Fragment key={`b3-${r}`}>
              <rect x="159" y={69 + r * 8.8} width="5.5" height="4" rx="0.7" fill="#60e0ff" opacity={0.4 + (r % 3) * 0.18} />
              <rect x="168" y={69 + r * 8.8} width="5.5" height="4" rx="0.7" fill="#60e0ff" opacity={0.65 + (r % 4) * 0.08} />
              <rect x="177" y={69 + r * 8.8} width="5.5" height="4" rx="0.7" fill="#60e0ff" opacity={0.35 + (r % 2) * 0.2} />
            </React.Fragment>
          ))}
        </g>
      </g>

      {/* ═══ BUILDING 4 — Right ═══ */}
      <g>
        <rect x="196" y="112" width="28" height="108" rx="1.5" fill="url(#al-face-dark)" />
        <path d="M 224 112 L 232 105 L 232 213 L 224 220" fill="url(#al-face-side)" opacity="0.8" />
        <path d="M 196 112 L 204 105 L 232 105 L 224 112 Z" fill="url(#al-face-top)" opacity="0.55" />
        <g filter="url(#al-win-glow)">
          {[...Array(12)].map((_, r) => (
            <React.Fragment key={`b4-${r}`}>
              <rect x="200" y={118 + r * 8.3} width="4.5" height="3.5" rx="0.6" fill="#48c6ff" opacity={0.3 + (r % 3) * 0.15} />
              <rect x="207" y={118 + r * 8.3} width="4.5" height="3.5" rx="0.6" fill="#48c6ff" opacity={0.5 + (r % 2) * 0.1} />
              <rect x="214" y={118 + r * 8.3} width="4.5" height="3.5" rx="0.6" fill="#48c6ff" opacity={0.35 + (r % 4) * 0.12} />
            </React.Fragment>
          ))}
        </g>
      </g>

      {/* ═══ RIGHT BAR CHARTS ═══ */}
      <g opacity="0.9">
        <rect x="230" y="170" width="10" height="42" rx="2" fill="url(#al-bar)" opacity="0.5" />
        <rect x="243" y="152" width="10" height="58" rx="2" fill="url(#al-bar)" opacity="0.6" />
        <rect x="256" y="132" width="10" height="76" rx="2" fill="url(#al-bar)" opacity="0.75" />
        <rect x="269" y="110" width="10" height="96" rx="2" fill="url(#al-bar)" opacity="0.9" />
        {/* Bar top highlights */}
        <rect x="230" y="170" width="10" height="2" rx="1" fill="#70e8ff" opacity="0.5" />
        <rect x="243" y="152" width="10" height="2" rx="1" fill="#70e8ff" opacity="0.6" />
        <rect x="256" y="132" width="10" height="2" rx="1" fill="#70e8ff" opacity="0.7" />
        <rect x="269" y="110" width="10" height="2" rx="1" fill="#70e8ff" opacity="0.8" />
      </g>

      {/* ═══ ARROW 1 — Left ═══ */}
      <g filter="url(#al-glow-sm)">
        <line x1="48" y1="178" x2="68" y2="142" stroke="url(#al-arrow)" strokeWidth="2.5" strokeLinecap="round" />
        <polygon points="63,138 73,134 68,146" fill="#50d0ff" />
      </g>

      {/* ═══ ARROW 2 — Center ═══ */}
      <g filter="url(#al-glow-md)">
        <line x1="140" y1="100" x2="168" y2="48" stroke="url(#al-arrow)" strokeWidth="3.2" strokeLinecap="round" />
        <polygon points="162,42 174,38 168,52" fill="#58ddff" />
      </g>

      {/* ═══ ARROW 3 — Right ═══ */}
      <g filter="url(#al-glow-sm)">
        <line x1="242" y1="128" x2="268" y2="80" stroke="url(#al-arrow)" strokeWidth="3" strokeLinecap="round" />
        <polygon points="262,75 274,70 268,84" fill="#60e0ff" />
      </g>
    </svg>
  );
};

export default AppLogo;
