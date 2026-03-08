import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  accentColor?: string;
  onClick?: () => void;
  glow?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  accentColor,
  onClick,
  glow = false,
}) => {
  return (
    <div
      onClick={onClick}
      className={`glass-card-elevated ${glow ? 'glass-card-glow' : ''} ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''} ${className}`}
      style={accentColor ? { borderRightColor: accentColor, borderRightWidth: '2px' } : undefined}
    >
      {children}
    </div>
  );
};

interface GlassKPIProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  iconBgClass?: string;
}

export const GlassKPI: React.FC<GlassKPIProps> = ({ icon, label, value, subValue, iconBgClass = 'bg-primary/10' }) => {
  return (
    <div className="glass-kpi-card">
      <div className={`w-10 h-10 ${iconBgClass} rounded-2xl flex items-center justify-center mb-2`}>
        {icon}
      </div>
      <p className="text-[9px] text-muted-foreground font-black uppercase tracking-wider">{label}</p>
      <p className="text-xl font-black text-foreground leading-tight">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {subValue && <p className="text-[10px] text-muted-foreground font-bold">{subValue}</p>}
    </div>
  );
};

interface FloatingActionButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  label?: string;
  colorClass?: string;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  icon,
  onClick,
  label,
  colorClass = 'bg-primary text-primary-foreground',
}) => {
  return (
    <button
      onClick={onClick}
      className={`fab-button ${colorClass}`}
      title={label}
    >
      {icon}
    </button>
  );
};
