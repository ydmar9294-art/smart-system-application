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
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Main blue gradient */}
        <linearGradient id="logo-blue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(200, 100%, 70%)" />
          <stop offset="100%" stopColor="hsl(210, 100%, 40%)" />
        </linearGradient>
        {/* Light blue glow */}
        <linearGradient id="logo-glow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(195, 100%, 75%)" />
          <stop offset="100%" stopColor="hsl(210, 90%, 55%)" />
        </linearGradient>
        {/* Arrow gradient */}
        <linearGradient id="logo-arrow" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="hsl(200, 100%, 50%)" />
          <stop offset="100%" stopColor="hsl(195, 100%, 70%)" />
        </linearGradient>
        {/* Arc gradient */}
        <linearGradient id="logo-arc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="hsl(210, 100%, 45%)" stopOpacity="0.2" />
          <stop offset="50%" stopColor="hsl(200, 100%, 55%)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="hsl(195, 100%, 65%)" stopOpacity="0.3" />
        </linearGradient>
        {/* Building face dark */}
        <linearGradient id="logo-face-dark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(210, 80%, 25%)" />
          <stop offset="100%" stopColor="hsl(220, 70%, 15%)" />
        </linearGradient>
        {/* Building face light */}
        <linearGradient id="logo-face-light" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(200, 90%, 45%)" />
          <stop offset="100%" stopColor="hsl(210, 80%, 30%)" />
        </linearGradient>
        {/* Center glow filter */}
        <filter id="logo-center-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="logo-soft-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Radial glow behind buildings */}
        <radialGradient id="logo-radial" cx="50%" cy="65%" r="35%">
          <stop offset="0%" stopColor="hsl(200, 100%, 60%)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="hsl(200, 100%, 60%)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Radial glow behind buildings */}
      <circle cx="100" cy="130" r="70" fill="url(#logo-radial)" />

      {/* Curved arc at the bottom */}
      <path
        d="M 25 155 Q 100 125 175 145"
        stroke="url(#logo-arc)"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* Bar charts - left side (rising) */}
      <rect x="30" y="132" width="7" height="18" rx="1" fill="url(#logo-blue)" opacity="0.5" />
      <rect x="40" y="125" width="7" height="25" rx="1" fill="url(#logo-blue)" opacity="0.6" />
      <rect x="50" y="118" width="7" height="32" rx="1" fill="url(#logo-blue)" opacity="0.7" />

      {/* Building 1 - Left (short, 3D perspective) */}
      <g>
        {/* Front face */}
        <rect x="60" y="85" width="20" height="65" rx="1.5" fill="url(#logo-face-dark)" />
        {/* Right face (3D) */}
        <path d="M 80 85 L 86 80 L 86 145 L 80 150" fill="hsl(210, 70%, 20%)" opacity="0.7" />
        {/* Top face */}
        <path d="M 60 85 L 66 80 L 86 80 L 80 85 Z" fill="hsl(200, 80%, 35%)" opacity="0.6" />
        {/* Windows */}
        <rect x="63" y="90" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.7" />
        <rect x="70" y="90" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.5" />
        <rect x="63" y="97" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.5" />
        <rect x="70" y="97" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.8" />
        <rect x="63" y="104" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.6" />
        <rect x="70" y="104" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.4" />
        <rect x="63" y="111" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.4" />
        <rect x="70" y="111" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.7" />
        <rect x="63" y="118" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.3" />
        <rect x="70" y="118" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.5" />
        <rect x="63" y="125" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.6" />
        <rect x="70" y="125" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.3" />
        <rect x="63" y="132" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.4" />
        <rect x="70" y="132" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.6" />
        <rect x="63" y="139" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.2" />
        <rect x="70" y="139" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.4" />
      </g>

      {/* Building 2 - Center (tallest, 3D) */}
      <g filter="url(#logo-soft-glow)">
        {/* Front face */}
        <rect x="84" y="55" width="24" height="95" rx="1.5" fill="url(#logo-face-dark)" />
        {/* Right face */}
        <path d="M 108 55 L 115 49 L 115 144 L 108 150" fill="hsl(210, 70%, 20%)" opacity="0.7" />
        {/* Top face */}
        <path d="M 84 55 L 91 49 L 115 49 L 108 55 Z" fill="hsl(200, 80%, 40%)" opacity="0.7" />
        {/* Windows */}
        <rect x="88" y="61" width="5" height="4" rx="0.5" fill="hsl(195, 100%, 75%)" opacity="0.8" />
        <rect x="97" y="61" width="5" height="4" rx="0.5" fill="hsl(195, 100%, 75%)" opacity="0.6" />
        <rect x="88" y="70" width="5" height="4" rx="0.5" fill="hsl(195, 100%, 75%)" opacity="0.6" />
        <rect x="97" y="70" width="5" height="4" rx="0.5" fill="hsl(195, 100%, 75%)" opacity="0.9" />
        <rect x="88" y="79" width="5" height="4" rx="0.5" fill="hsl(195, 100%, 75%)" opacity="0.7" />
        <rect x="97" y="79" width="5" height="4" rx="0.5" fill="hsl(195, 100%, 75%)" opacity="0.5" />
        <rect x="88" y="88" width="5" height="4" rx="0.5" fill="hsl(195, 100%, 75%)" opacity="0.5" />
        <rect x="97" y="88" width="5" height="4" rx="0.5" fill="hsl(195, 100%, 75%)" opacity="0.8" />
        <rect x="88" y="97" width="5" height="4" rx="0.5" fill="hsl(195, 100%, 75%)" opacity="0.4" />
        <rect x="97" y="97" width="5" height="4" rx="0.5" fill="hsl(195, 100%, 75%)" opacity="0.6" />
        <rect x="88" y="106" width="5" height="4" rx="0.5" fill="hsl(195, 100%, 75%)" opacity="0.6" />
        <rect x="97" y="106" width="5" height="4" rx="0.5" fill="hsl(195, 100%, 75%)" opacity="0.3" />
        <rect x="88" y="115" width="5" height="4" rx="0.5" fill="hsl(195, 100%, 75%)" opacity="0.3" />
        <rect x="97" y="115" width="5" height="4" rx="0.5" fill="hsl(195, 100%, 75%)" opacity="0.7" />
        <rect x="88" y="124" width="5" height="4" rx="0.5" fill="hsl(195, 100%, 75%)" opacity="0.5" />
        <rect x="97" y="124" width="5" height="4" rx="0.5" fill="hsl(195, 100%, 75%)" opacity="0.4" />
        <rect x="88" y="133" width="5" height="4" rx="0.5" fill="hsl(195, 100%, 75%)" opacity="0.2" />
        <rect x="97" y="133" width="5" height="4" rx="0.5" fill="hsl(195, 100%, 75%)" opacity="0.5" />
      </g>

      {/* Light burst at building base center */}
      <ellipse cx="96" cy="150" rx="20" ry="4" fill="hsl(200, 100%, 60%)" opacity="0.3" filter="url(#logo-center-glow)" />

      {/* Building 3 - Right (medium, 3D) */}
      <g>
        {/* Front face */}
        <rect x="118" y="75" width="20" height="73" rx="1.5" fill="url(#logo-face-dark)" />
        {/* Right face */}
        <path d="M 138 75 L 144 70 L 144 143 L 138 148" fill="hsl(210, 70%, 20%)" opacity="0.6" />
        {/* Top face */}
        <path d="M 118 75 L 124 70 L 144 70 L 138 75 Z" fill="hsl(200, 80%, 35%)" opacity="0.6" />
        {/* Windows */}
        <rect x="121" y="80" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.6" />
        <rect x="129" y="80" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.7" />
        <rect x="121" y="87" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.7" />
        <rect x="129" y="87" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.5" />
        <rect x="121" y="94" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.5" />
        <rect x="129" y="94" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.8" />
        <rect x="121" y="101" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.4" />
        <rect x="129" y="101" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.6" />
        <rect x="121" y="108" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.6" />
        <rect x="129" y="108" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.3" />
        <rect x="121" y="115" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.3" />
        <rect x="129" y="115" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.7" />
        <rect x="121" y="122" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.5" />
        <rect x="129" y="122" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.4" />
        <rect x="121" y="129" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.2" />
        <rect x="129" y="129" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.5" />
        <rect x="121" y="136" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.4" />
        <rect x="129" y="136" width="4" height="3.5" rx="0.5" fill="hsl(195, 100%, 70%)" opacity="0.2" />
      </g>

      {/* Bar charts - right side (rising higher) */}
      <rect x="143" y="118" width="7" height="28" rx="1" fill="url(#logo-blue)" opacity="0.6" />
      <rect x="153" y="108" width="7" height="36" rx="1" fill="url(#logo-blue)" opacity="0.7" />
      <rect x="163" y="96" width="7" height="46" rx="1" fill="url(#logo-glow)" opacity="0.8" />

      {/* Arrow 1 - left rising */}
      <g filter="url(#logo-soft-glow)">
        <path
          d="M 38 120 L 55 95"
          stroke="url(#logo-arrow)"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 50 93 L 57 90 L 55 98"
          fill="hsl(195, 100%, 65%)"
          opacity="0.9"
        />
      </g>

      {/* Arrow 2 - center rising */}
      <g filter="url(#logo-soft-glow)">
        <path
          d="M 95 75 L 120 48"
          stroke="url(#logo-arrow)"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 115 46 L 123 43 L 120 51"
          fill="hsl(195, 100%, 65%)"
          opacity="0.9"
        />
      </g>

      {/* Arrow 3 - right rising (biggest) */}
      <g filter="url(#logo-soft-glow)">
        <path
          d="M 148 90 L 168 55"
          stroke="url(#logo-arrow)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 163 52 L 172 48 L 168 58"
          fill="hsl(195, 100%, 70%)"
          opacity="0.95"
        />
      </g>
    </svg>
  );
};

export default AppLogo;
