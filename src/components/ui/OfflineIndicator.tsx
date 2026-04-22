/**
 * Offline Indicator
 * Shows a banner when the app is offline and pending sync count.
 */

import React from 'react';
import { WifiOff, CloudOff, RefreshCw } from 'lucide-react';

interface OfflineIndicatorProps {
  isOnline: boolean;
  pendingCount: number;
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ isOnline, pendingCount }) => {
  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className="fixed left-4 z-50 flex flex-col gap-1 pointer-events-none"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
      dir="rtl"
    >
      {!isOnline && (
        <div className="flex items-center gap-2 bg-destructive text-destructive-foreground px-3 py-2 rounded-lg shadow-lg text-sm font-medium pointer-events-auto">
          <WifiOff size={16} />
          <span>غير متصل بالإنترنت</span>
        </div>
      )}
      {pendingCount > 0 && (
        <div className="flex items-center gap-2 bg-amber-500 text-white px-3 py-2 rounded-lg shadow-lg text-sm font-medium pointer-events-auto">
          <RefreshCw size={14} className={isOnline ? 'animate-spin' : ''} />
          <span>{pendingCount} عملية بانتظار المزامنة</span>
        </div>
      )}
    </div>
  );
};

export default OfflineIndicator;
