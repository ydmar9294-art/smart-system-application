import React from 'react';
import { motion } from 'motion/react';

/* ─── GlassCard ─── */
interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  accentColor?: string;
  onClick?: () => void;
  glow?: boolean;
  shimmer?: boolean;
  delay?: number;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children, className = '', accentColor, onClick, glow = false, shimmer = false, delay = 0,
}) => (
  <motion.div
    onClick={onClick}
    className={`native-glass-card ${glow ? 'native-glass-card-glow' : ''} ${shimmer ? 'native-glass-card-shimmer' : ''} ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform duration-150' : ''} ${className}`}
    style={accentColor ? { borderInlineEndColor: accentColor, borderInlineEndWidth: '2px' } : undefined}
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay: delay * 0.08, ease: [0.34, 1.56, 0.64, 1] }}
  >
    {children}
  </motion.div>
);

/* ─── GlassKPI ─── */
interface GlassKPIProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  iconBgClass?: string;
  delay?: number;
}

export const GlassKPI: React.FC<GlassKPIProps> = ({ icon, label, value, subValue, iconBgClass = 'bg-primary/10', delay = 0 }) => (
  <motion.div
    className="native-glass-kpi"
    initial={{ opacity: 0, scale: 0.92 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.3, delay: delay * 0.06, ease: [0.34, 1.56, 0.64, 1] }}
  >
    <div className={`w-9 h-9 ${iconBgClass} rounded-[1rem] flex items-center justify-center mb-1.5 relative z-[2]`}>
      {icon}
    </div>
    <p className="text-[8px] text-muted-foreground font-black uppercase tracking-wider relative z-[2]">{label}</p>
    <p className="text-lg font-black text-foreground leading-tight relative z-[2]">{typeof value === 'number' ? value.toLocaleString() : value}</p>
    {subValue && <p className="text-[9px] text-muted-foreground font-bold relative z-[2]">{subValue}</p>}
  </motion.div>
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
  <motion.button
    onClick={onClick}
    className={`native-fab ${colorClass}`}
    title={label}
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.3 }}
    whileTap={{ scale: 0.85 }}
  >
    {icon}
  </motion.button>
);
