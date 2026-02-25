import React from 'react';

interface AppLogoProps {
  size?: number;
  className?: string;
}

const AppLogo: React.FC<AppLogoProps> = ({ size = 80, className = '' }) => {
  const s = size;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="bg-grad" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="hsl(224, 50%, 14%)" />
          <stop offset="100%" stopColor="hsl(230, 45%, 10%)" />
        </linearGradient>
        <linearGradient id="b1-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(217, 91%, 60%)" />
          <stop offset="100%" stopColor="hsl(239, 84%, 67%)" />
        </linearGradient>
        <linearGradient id="b2-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(199, 89%, 48%)" />
          <stop offset="100%" stopColor="hsl(217, 91%, 60%)" />
        </linearGradient>
        <linearGradient id="b3-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(239, 84%, 67%)" />
          <stop offset="100%" stopColor="hsl(250, 70%, 50%)" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background rounded rect */}
      <rect width="120" height="120" rx="28" fill="url(#bg-grad)" />

      {/* Subtle base line */}
      <rect x="18" y="92" width="84" height="2" rx="1" fill="hsl(217, 91%, 60%)" opacity="0.25" />

      {/* Building 1 - Left (short) */}
      <rect x="22" y="48" width="22" height="44" rx="3" fill="url(#b2-grad)" opacity="0.9" />
      {/* Windows B1 */}
      <rect x="26" y="54" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.7" />
      <rect x="35" y="54" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.5" />
      <rect x="26" y="63" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.5" />
      <rect x="35" y="63" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.7" />
      <rect x="26" y="72" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.4" />
      <rect x="35" y="72" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.6" />
      <rect x="26" y="81" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.3" />
      <rect x="35" y="81" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.4" />

      {/* Building 2 - Center (tall) */}
      <rect x="48" y="26" width="24" height="66" rx="3" fill="url(#b1-grad)" filter="url(#glow)" />
      {/* Antenna */}
      <rect x="58.5" y="18" width="3" height="10" rx="1.5" fill="hsl(217, 91%, 60%)" opacity="0.8" />
      <circle cx="60" cy="16" r="2.5" fill="hsl(199, 89%, 48%)" opacity="0.9" />
      {/* Windows B2 */}
      <rect x="53" y="33" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.8" />
      <rect x="62" y="33" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.6" />
      <rect x="53" y="42" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.6" />
      <rect x="62" y="42" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.8" />
      <rect x="53" y="51" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.7" />
      <rect x="62" y="51" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.5" />
      <rect x="53" y="60" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.5" />
      <rect x="62" y="60" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.7" />
      <rect x="53" y="69" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.4" />
      <rect x="62" y="69" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.6" />
      <rect x="53" y="78" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.3" />
      <rect x="62" y="78" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.4" />

      {/* Building 3 - Right (medium) */}
      <rect x="76" y="38" width="22" height="54" rx="3" fill="url(#b3-grad)" opacity="0.9" />
      {/* Windows B3 */}
      <rect x="80" y="44" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.6" />
      <rect x="89" y="44" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.7" />
      <rect x="80" y="53" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.7" />
      <rect x="89" y="53" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.5" />
      <rect x="80" y="62" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.5" />
      <rect x="89" y="62" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.6" />
      <rect x="80" y="71" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.4" />
      <rect x="89" y="71" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.7" />
      <rect x="80" y="80" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.3" />
      <rect x="89" y="80" width="5" height="4" rx="1" fill="hsl(210, 40%, 96%)" opacity="0.5" />
    </svg>
  );
};

export default AppLogo;
