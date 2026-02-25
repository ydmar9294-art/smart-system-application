/**
 * DashboardSkeleton - Instant loading skeleton for the app
 * Shows immediately while auth/data loads in background.
 * Matches the real dashboard layout for perceived speed.
 */
import React from 'react';

const Pulse: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-muted animate-pulse rounded-lg ${className}`} />
);

export const AppLoadingSkeleton: React.FC = () => (
  <div className="h-screen flex flex-col bg-background animate-in fade-in duration-200">
    {/* Top bar skeleton */}
    <div className="h-14 border-b border-border flex items-center px-4 gap-3">
      <Pulse className="h-8 w-8 rounded-full" />
      <Pulse className="h-4 w-32" />
      <div className="flex-1" />
      <Pulse className="h-8 w-8 rounded-full" />
    </div>

    {/* Content skeleton */}
    <div className="flex-1 p-4 space-y-4 overflow-hidden">
      {/* Welcome banner */}
      <Pulse className="h-16 w-full" />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Pulse key={i} className="h-20" />
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-2">
        {[...Array(3)].map((_, i) => (
          <Pulse key={i} className="h-9 w-20 rounded-full" />
        ))}
      </div>

      {/* Content area */}
      <Pulse className="h-48" />
      <Pulse className="h-32" />
    </div>
  </div>
);

export const DashboardContentSkeleton: React.FC = () => (
  <div className="p-4 space-y-4 animate-in fade-in duration-200">
    <Pulse className="h-8 w-48" />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Pulse key={i} className="h-24" />
      ))}
    </div>
    <Pulse className="h-64" />
  </div>
);

export default AppLoadingSkeleton;
