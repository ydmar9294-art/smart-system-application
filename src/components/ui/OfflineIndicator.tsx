import React from 'react';
import { useTranslation } from 'react-i18next';
import { WifiOff, RefreshCw } from 'lucide-react';

interface OfflineIndicatorProps {
  isOnline: boolean;
  pendingCount: number;
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ isOnline, pendingCount }) => {
  const { t } = useTranslation();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-1 fixed-bottom-safe" dir="auto">
      {!isOnline && (
        <div className="flex items-center gap-2 bg-destructive text-destructive-foreground px-3 py-2 rounded-lg shadow-lg text-sm font-medium">
          <WifiOff size={16} />
          <span>{t('offline.noConnection')}</span>
        </div>
      )}
      {pendingCount > 0 && (
        <div className="flex items-center gap-2 bg-amber-500 text-white px-3 py-2 rounded-lg shadow-lg text-sm font-medium">
          <RefreshCw size={14} className={isOnline ? 'animate-spin' : ''} />
          <span>{t('offline.pendingSync', { count: pendingCount })}</span>
        </div>
      )}
    </div>
  );
};

export default OfflineIndicator;
