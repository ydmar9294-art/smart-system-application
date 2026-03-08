import React from 'react';

/* ─── GlassCard ─── */
interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  accentColor?: string;
  onClick?: () => void;
  glow?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children, className = '', accentColor, onClick, glow = false,
}) => (
  <div
    onClick={onClick}
    className={`native-glass-card ${glow ? 'native-glass-card-glow' : ''} ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''} ${className}`}
    style={accentColor ? { borderInlineEndColor: accentColor, borderInlineEndWidth: '2px' } : undefined}
  >
    {children}
  </div>
);

/* ─── GlassKPI ─── */
interface GlassKPIProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  iconBgClass?: string;
}

export const GlassKPI: React.FC<GlassKPIProps> = ({ icon, label, value, subValue, iconBgClass = 'bg-primary/10' }) => (
  <div className="native-glass-kpi">
    <div className={`w-10 h-10 ${iconBgClass} rounded-2xl flex items-center justify-center mb-2 relative z-[2]`}>
      {icon}
    </div>
    <p className="text-[9px] text-muted-foreground font-black uppercase tracking-wider relative z-[2]">{label}</p>
    <p className="text-xl font-black text-foreground leading-tight relative z-[2]">{typeof value === 'number' ? value.toLocaleString() : value}</p>
    {subValue && <p className="text-[10px] text-muted-foreground font-bold relative z-[2]">{subValue}</p>}
  </div>
);

/* ─── FloatingActionButton ─── */
interface FloatingActionButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  label?: string;
  colorClass?: string;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  icon, onClick, label, colorClass = 'bg-primary text-primary-foreground',
}) => (
  <button onClick={onClick} className={`native-fab ${colorClass}`} title={label}>
    {icon}
  </button>
);
