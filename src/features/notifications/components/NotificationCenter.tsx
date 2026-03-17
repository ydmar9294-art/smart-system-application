/**
 * NotificationCenter - DB-backed user-specific notification system
 * Fully isolated: each user sees only their own notifications.
 * System alerts (stock/invoices) are filtered by role — only relevant roles receive them.
 */
import React, { useState } from 'react';
import { Bell, Package, Receipt, AlertTriangle, X, Check, Loader2 } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/store/AuthContext';
import { UserRole, EmployeeType } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface DBNotification {
  id: string;
  title: string;
  description: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export const NotificationCenter: React.FC = () => {
  const { products, sales, role } = useApp();
  const { user } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch DB notifications
  const { data: dbNotifications = [], isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async (): Promise<DBNotification[]> => {
      const { data, error } = await supabase
        .from('user_notifications')
        .select('id,title,description,type,is_read,created_at')
        .order('created_at', { ascending: false })
        .range(0, 49);
      if (error) throw error;
      return (data || []) as DBNotification[];
    },
    enabled: !!user?.id,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  // Realtime subscription for instant notifications
  React.useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  // Mark as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (notifId: string) => {
      const { error } = await supabase
        .from('user_notifications')
        .update({ is_read: true })
        .eq('id', notifId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] }),
  });

  // Mark all as read — scoped to current user
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await supabase
        .from('user_notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] }),
  });

  // Delete notification
  const deleteMutation = useMutation({
    mutationFn: async (notifId: string) => {
      const { error } = await supabase
        .from('user_notifications')
        .delete()
        .eq('id', notifId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] }),
  });

  // Role-based system alerts isolation:
  // - Stock alerts: Owner + Warehouse Keeper only
  // - Invoice due alerts: Owner + Accountant + Sales Manager only
  // - Distributors (FIELD_AGENT): no system alerts
  const canSeeStockAlerts = role === UserRole.OWNER ||
    (role === UserRole.EMPLOYEE && user?.employeeType === EmployeeType.WAREHOUSE_KEEPER);

  const canSeeInvoiceAlerts = role === UserRole.OWNER ||
    (role === UserRole.EMPLOYEE && (
      user?.employeeType === EmployeeType.ACCOUNTANT ||
      user?.employeeType === EmployeeType.SALES_MANAGER
    ));

  // System alerts (memoized to reduce recalculation)
  const lowStockProducts = React.useMemo(
    () => canSeeStockAlerts ? products.filter(p => !p.isDeleted && p.stock <= p.minStock && p.stock > 0) : [],
    [products, canSeeStockAlerts]
  );
  const outOfStockProducts = React.useMemo(
    () => canSeeStockAlerts ? products.filter(p => !p.isDeleted && p.stock === 0) : [],
    [products, canSeeStockAlerts]
  );
  const sevenDaysAgo = React.useMemo(() => Date.now() - (7 * 24 * 60 * 60 * 1000), []);
  const dueInvoices = React.useMemo(
    () => canSeeInvoiceAlerts ? sales.filter(sale => !sale.isVoided && sale.remaining > 0 && sale.timestamp < sevenDaysAgo) : [],
    [sales, sevenDaysAgo, canSeeInvoiceAlerts]
  );

  const systemAlerts = React.useMemo(() => [
    ...outOfStockProducts.map(p => ({
      id: `sys_out_${p.id}`, type: 'out_of_stock', title: 'نفاد المخزون',
      description: `${p.name} - نفد من المخزون`, created_at: new Date().toISOString(), is_read: false, isSystem: true,
    })),
    ...lowStockProducts.map(p => ({
      id: `sys_low_${p.id}`, type: 'low_stock', title: 'مخزون منخفض',
      description: `${p.name} - متبقي ${p.stock} ${p.unit}`, created_at: new Date().toISOString(), is_read: false, isSystem: true,
    })),
    ...dueInvoices.map(s => ({
      id: `sys_due_${s.id}`, type: 'due_invoice', title: 'فاتورة مستحقة',
      description: `${s.customerName} - ${s.remaining.toLocaleString()} ل.س`, created_at: new Date(s.timestamp).toISOString(), is_read: false, isSystem: true,
    })),
  ], [outOfStockProducts, lowStockProducts, dueInvoices]);

  const allNotifications = React.useMemo(() => [
    ...systemAlerts,
    ...dbNotifications.map(n => ({ ...n, isSystem: false })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [systemAlerts, dbNotifications]
  );



  const unreadCount = dbNotifications.filter(n => !n.is_read).length + systemAlerts.length;
  const criticalAlerts = outOfStockProducts.length;

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'out_of_stock': case 'error': return <Package className="h-4 w-4 text-red-500" />;
      case 'low_stock': case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'due_invoice': return <Receipt className="h-4 w-4 text-blue-500" />;
      case 'success': return <Check className="h-4 w-4 text-emerald-500" />;
      case 'missed_visit': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getAlertBg = (type: string) => {
    switch (type) {
      case 'out_of_stock': case 'error': return 'bg-red-500/5 border-red-500/10';
      case 'low_stock': case 'warning': return 'bg-amber-500/5 border-amber-500/10';
      case 'due_invoice': return 'bg-blue-500/5 border-blue-500/10';
      case 'success': return 'bg-emerald-500/5 border-emerald-500/10';
      default: return 'bg-muted border-border';
    }
  };

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'الآن';
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    if (hours < 24) return `منذ ${hours} ساعة`;
    return `منذ ${days} يوم`;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className={`absolute -top-1 -right-1 h-5 w-5 rounded-full text-xs font-bold flex items-center justify-center text-white ${
              criticalAlerts > 0 ? 'bg-red-500 animate-pulse' : 'bg-amber-500'
            }`}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" dir="rtl">
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <h3 className="font-bold text-sm">مركز التنبيهات</h3>
          <div className="flex gap-2 items-center">
            {dbNotifications.some(n => !n.is_read) && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary"
                onClick={() => markAllReadMutation.mutate()}>
                <Check className="h-3 w-3 ml-1" /> قراءة الكل
              </Button>
            )}
            <Badge variant="secondary" className="text-xs">{unreadCount}</Badge>
          </div>
        </div>
        
        <ScrollArea className="h-[350px]">
          {allNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mb-3 opacity-20" />
              <p className="text-sm">لا توجد تنبيهات</p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {allNotifications.map(alert => (
                <div key={alert.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${getAlertBg(alert.type)} group relative ${
                    !alert.isSystem && !alert.is_read ? 'border-r-2 border-r-primary' : ''
                  }`}
                  onClick={() => {
                    if (!alert.isSystem && !alert.is_read) markReadMutation.mutate(alert.id);
                  }}
                >
                  <div className="mt-0.5">{getAlertIcon(alert.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-foreground">{alert.title}</p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatTime(alert.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
                  </div>
                  {!alert.isSystem && (
                    <button onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(alert.id); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500/10 rounded-full">
                      <X className="h-3 w-3 text-red-500" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        {systemAlerts.length > 0 && (
          <div className="p-3 border-t bg-muted/20">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-red-500/10 rounded-lg p-2">
                <p className="font-bold text-red-600 dark:text-red-400">{outOfStockProducts.length}</p>
                <p className="text-red-600/70 dark:text-red-400/70">نفاد</p>
              </div>
              <div className="bg-amber-500/10 rounded-lg p-2">
                <p className="font-bold text-amber-600 dark:text-amber-400">{lowStockProducts.length}</p>
                <p className="text-amber-600/70 dark:text-amber-400/70">منخفض</p>
              </div>
              <div className="bg-blue-500/10 rounded-lg p-2">
                <p className="font-bold text-blue-600 dark:text-blue-400">{dueInvoices.length}</p>
                <p className="text-blue-600/70 dark:text-blue-400/70">مستحق</p>
              </div>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
