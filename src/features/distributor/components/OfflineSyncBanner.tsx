import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wifi, WifiOff, Cloud, CloudOff, Loader2, Check,
  AlertTriangle, ChevronDown, ChevronUp, RefreshCw,
  Clock, CheckCircle2, XCircle,
} from 'lucide-react';
import type { OfflineAction } from '../services/distributorOfflineService';

interface OfflineSyncBannerProps {
  isOnline: boolean;
  pendingCount: number;
  failedCount: number;
  isSyncing: boolean;
  lastSyncMessage: string | null;
  actions: OfflineAction[];
  onTriggerSync: () => void;
  onRetryAction?: (actionId: string) => void;
  onRetryAllFailed?: () => void;
}

const OfflineSyncBanner: React.FC<OfflineSyncBannerProps> = ({
  isOnline, pendingCount, failedCount, isSyncing,
  lastSyncMessage, actions, onTriggerSync, onRetryAction, onRetryAllFailed,
}) => {
  const { t } = useTranslation();
  const [showLog, setShowLog] = useState(false);
  const hasIssues = pendingCount > 0 || failedCount > 0;

  if (isOnline && !hasIssues && !isSyncing && !lastSyncMessage) return null;

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'CREATE_SALE': return t('offlineSync.saleInvoice');
      case 'ADD_COLLECTION': return t('offlineSync.collection');
      case 'CREATE_RETURN': return t('offlineSync.returnOp');
      case 'TRANSFER_TO_WAREHOUSE': return t('offlineSync.warehouseTransfer');
      case 'ADD_CUSTOMER': return t('offlineSync.addCustomerOp');
      default: return type;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-3.5 h-3.5 text-amber-500" />;
      case 'syncing': return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />;
      case 'synced': return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
      case 'failed': return <XCircle className="w-3.5 h-3.5 text-destructive" />;
      default: return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'synced': return t('offlineSync.statusDone');
      case 'failed': return t('offlineSync.statusFailed');
      case 'syncing': return t('offlineSync.statusSyncing');
      default: return t('offlineSync.statusPending');
    }
  };

  return (
    <div className="space-y-2">
      <div className={`rounded-2xl p-3 flex items-center justify-between transition-colors ${
        !isOnline ? 'bg-amber-500/10 border border-amber-500/20'
          : isSyncing ? 'bg-blue-500/10 border border-blue-500/20'
          : failedCount > 0 ? 'bg-destructive/10 border border-destructive/20'
          : lastSyncMessage ? 'bg-emerald-500/10 border border-emerald-500/20'
          : 'bg-muted'
      }`}>
        <div className="flex items-center gap-2.5">
          {!isOnline ? <WifiOff className="w-4 h-4 text-amber-500 shrink-0" />
            : isSyncing ? <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
            : failedCount > 0 ? <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            : lastSyncMessage ? <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            : <Cloud className="w-4 h-4 text-muted-foreground shrink-0" />}

          <div>
            <p className="text-xs font-bold text-foreground">
              {!isOnline ? t('offlineSync.offlineMode')
                : isSyncing ? t('offlineSync.syncing')
                : failedCount > 0 ? t('offlineSync.failedOps', { count: failedCount })
                : lastSyncMessage ? lastSyncMessage
                : t('offlineSync.pendingOps', { count: pendingCount })}
            </p>
            {pendingCount > 0 && !isSyncing && (
              <p className="text-[10px] text-muted-foreground">
                {isOnline ? t('offlineSync.autoSync') : t('offlineSync.syncOnReconnect')}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isOnline && failedCount > 0 && !isSyncing && onRetryAllFailed && (
            <button onClick={onRetryAllFailed}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-destructive/10 hover:bg-destructive/20 transition-colors text-destructive text-[10px] font-bold"
              title={t('offlineSync.retryAll')}>
              <RefreshCw className="w-3 h-3" />
              <span>{t('offlineSync.retryAll')}</span>
            </button>
          )}
          {isOnline && pendingCount > 0 && !isSyncing && (
            <button onClick={onTriggerSync}
              className="p-1.5 rounded-lg bg-card hover:bg-accent transition-colors"
              title={t('offlineSync.syncNow')}>
              <RefreshCw className="w-3.5 h-3.5 text-primary" />
            </button>
          )}
          {actions.length > 0 && (
            <button onClick={() => setShowLog(!showLog)}
              className="p-1.5 rounded-lg bg-card hover:bg-accent transition-colors">
              {showLog ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
          )}
        </div>
      </div>

      {showLog && actions.length > 0 && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-3 py-2 bg-muted/50 border-b border-border">
            <p className="text-xs font-bold text-muted-foreground">{t('offlineSync.operationsLog')}</p>
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-border">
            {actions.slice(0, 20).map((action) => (
              <div key={action.id} className="px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(action.status)}
                  <div>
                    <p className="text-xs font-bold text-foreground">{getActionLabel(action.type)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(action.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  action.status === 'synced' ? 'bg-emerald-500/10 text-emerald-600' :
                  action.status === 'failed' ? 'bg-destructive/10 text-destructive' :
                  action.status === 'syncing' ? 'bg-blue-500/10 text-blue-600' :
                  'bg-amber-500/10 text-amber-600'
                }`}>
                  {getStatusLabel(action.status)}
                </span>
                {action.status === 'failed' && onRetryAction && (
                  <button onClick={() => onRetryAction(action.id)}
                    className="p-1 rounded-md bg-destructive/10 hover:bg-destructive/20 transition-colors mr-1"
                    title={t('offlineSync.retry')}>
                    <RefreshCw className="w-3 h-3 text-destructive" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OfflineSyncBanner;
