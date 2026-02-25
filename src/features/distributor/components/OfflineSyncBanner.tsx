/**
 * OfflineSyncBanner
 * Shows sync status, pending operations count, and offline indicator
 * for the distributor dashboard.
 */

import React, { useState } from 'react';
import {
  Wifi,
  WifiOff,
  Cloud,
  CloudOff,
  Loader2,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
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
}

const OfflineSyncBanner: React.FC<OfflineSyncBannerProps> = ({
  isOnline,
  pendingCount,
  failedCount,
  isSyncing,
  lastSyncMessage,
  actions,
  onTriggerSync,
}) => {
  const [showLog, setShowLog] = useState(false);
  const hasIssues = pendingCount > 0 || failedCount > 0;

  // Nothing to show if online with no pending
  if (isOnline && !hasIssues && !isSyncing && !lastSyncMessage) {
    return null;
  }

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'CREATE_SALE': return 'فاتورة بيع';
      case 'ADD_COLLECTION': return 'تحصيل';
      case 'CREATE_RETURN': return 'مرتجع';
      case 'TRANSFER_TO_WAREHOUSE': return 'نقل مستودع';
      case 'ADD_CUSTOMER': return 'إضافة زبون';
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

  return (
    <div className="space-y-2">
      {/* Main Banner */}
      <div className={`rounded-2xl p-3 flex items-center justify-between transition-colors ${
        !isOnline
          ? 'bg-amber-500/10 border border-amber-500/20'
          : isSyncing
            ? 'bg-blue-500/10 border border-blue-500/20'
            : failedCount > 0
              ? 'bg-destructive/10 border border-destructive/20'
              : lastSyncMessage
                ? 'bg-emerald-500/10 border border-emerald-500/20'
                : 'bg-muted'
      }`}>
        <div className="flex items-center gap-2.5">
          {!isOnline ? (
            <WifiOff className="w-4 h-4 text-amber-500 shrink-0" />
          ) : isSyncing ? (
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
          ) : failedCount > 0 ? (
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          ) : lastSyncMessage ? (
            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : (
            <Cloud className="w-4 h-4 text-muted-foreground shrink-0" />
          )}

          <div>
            <p className="text-xs font-bold text-foreground">
              {!isOnline
                ? 'وضع عدم الاتصال — العمليات محفوظة محلياً'
                : isSyncing
                  ? 'جارٍ المزامنة...'
                  : failedCount > 0
                    ? `${failedCount} عملية فشلت في المزامنة`
                    : lastSyncMessage
                      ? lastSyncMessage
                      : `${pendingCount} عملية بانتظار المزامنة`}
            </p>
            {pendingCount > 0 && !isSyncing && (
              <p className="text-[10px] text-muted-foreground">
                {isOnline ? 'ستتم المزامنة تلقائياً' : 'ستتم المزامنة عند عودة الإنترنت'}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isOnline && pendingCount > 0 && !isSyncing && (
            <button
              onClick={onTriggerSync}
              className="p-1.5 rounded-lg bg-card hover:bg-accent transition-colors"
              title="مزامنة الآن"
            >
              <RefreshCw className="w-3.5 h-3.5 text-primary" />
            </button>
          )}
          {actions.length > 0 && (
            <button
              onClick={() => setShowLog(!showLog)}
              className="p-1.5 rounded-lg bg-card hover:bg-accent transition-colors"
            >
              {showLog ? (
                <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Operations Log */}
      {showLog && actions.length > 0 && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-3 py-2 bg-muted/50 border-b border-border">
            <p className="text-xs font-bold text-muted-foreground">سجل العمليات</p>
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-border">
            {actions.slice(0, 20).map((action) => (
              <div key={action.id} className="px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(action.status)}
                  <div>
                    <p className="text-xs font-bold text-foreground">{getActionLabel(action.type)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(action.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  action.status === 'synced' ? 'bg-emerald-500/10 text-emerald-600' :
                  action.status === 'failed' ? 'bg-destructive/10 text-destructive' :
                  action.status === 'syncing' ? 'bg-blue-500/10 text-blue-600' :
                  'bg-amber-500/10 text-amber-600'
                }`}>
                  {action.status === 'synced' ? 'تمت' :
                   action.status === 'failed' ? 'فشلت' :
                   action.status === 'syncing' ? 'مزامنة' : 'بانتظار'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OfflineSyncBanner;
