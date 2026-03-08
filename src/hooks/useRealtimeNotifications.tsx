import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/store/AppContext';
import { UserRole, EmployeeType } from '@/types';
import { pushNotificationService } from '@/services/pushNotifications';

/**
 * Fix #6: Role-based notification system
 * Each role receives only relevant notifications
 */
export const useRealtimeNotifications = () => {
  const { user, products, sales, addNotification, role, organization } = useApp();
  const processedAlerts = useRef<Set<string>>(new Set());
  const lastUserId = useRef<string | null>(null);

  const sendNotification = async (
    message: string, 
    type: 'success' | 'error' | 'warning',
    pushTitle?: string,
    pushData?: Record<string, unknown>
  ) => {
    // Show transient toast
    addNotification(message, type);

    // Persist to DB so it appears in the bell icon permanently
    if (user?.id) {
      try {
        await supabase.from('user_notifications').insert({
          user_id: user.id,
          title: pushTitle || (type === 'error' ? 'تنبيه' : type === 'warning' ? 'تحذير' : 'إشعار'),
          description: message,
          type,
        });
      } catch {
        // silent – notification persistence is best-effort
      }
    }

    if (pushTitle) {
      try {
        await pushNotificationService.showLocalNotification({
          title: pushTitle,
          body: message,
          data: pushData
        });
      } catch (err) {
        console.log('Push notification not available:', err);
      }
    }
  };

  // Clear processed alerts when user changes
  useEffect(() => {
    if (user?.id !== lastUserId.current) {
      processedAlerts.current.clear();
      lastUserId.current = user?.id || null;
    }
  }, [user?.id]);

  // Role-specific initial checks
  useEffect(() => {
    if (!user || !role) return;

    const timer = setTimeout(() => {
      // Owner & Warehouse Keeper: stock alerts
      if (role === UserRole.OWNER || (role === UserRole.EMPLOYEE && user.employeeType === EmployeeType.WAREHOUSE_KEEPER)) {
        checkLowStock();
      }
      // Owner & Accountant & Sales Manager: due invoice alerts
      if (role === UserRole.OWNER || (role === UserRole.EMPLOYEE && (user.employeeType === EmployeeType.ACCOUNTANT || user.employeeType === EmployeeType.SALES_MANAGER))) {
        checkDueInvoices();
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [user, role, products.length, sales.length]);

  const checkLowStock = () => {
    if (!products || products.length === 0) return;
    
    products.filter(p => !p.isDeleted && p.stock <= p.minStock && p.stock > 0).forEach(product => {
      const alertKey = `low_stock_${product.id}`;
      if (!processedAlerts.current.has(alertKey)) {
        processedAlerts.current.add(alertKey);
        sendNotification(`⚠️ مخزون منخفض: ${product.name} (${product.stock} ${product.unit})`, 'warning', 'مخزون منخفض', { type: 'low_stock', productId: product.id });
      }
    });

    products.filter(p => !p.isDeleted && p.stock === 0).forEach(product => {
      const alertKey = `out_of_stock_${product.id}`;
      if (!processedAlerts.current.has(alertKey)) {
        processedAlerts.current.add(alertKey);
        sendNotification(`🚨 نفاد المخزون: ${product.name}`, 'error', 'نفاد المخزون!', { type: 'out_of_stock', productId: product.id });
      }
    });
  };

  const checkDueInvoices = () => {
    if (!sales || sales.length === 0) return;
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    sales.filter(sale => !sale.isVoided && sale.remaining > 0 && sale.timestamp < sevenDaysAgo).forEach(sale => {
      const alertKey = `due_invoice_${sale.id}`;
      if (!processedAlerts.current.has(alertKey)) {
        processedAlerts.current.add(alertKey);
        sendNotification(`📋 فاتورة مستحقة: ${sale.customerName} - ${sale.remaining.toLocaleString()} ل.س`, 'warning', 'فاتورة مستحقة', { type: 'overdue_invoice', saleId: sale.id });
      }
    });
  };

  // Fix #6: Role-based realtime subscriptions
  useEffect(() => {
    if (!user) return;

    const channels: ReturnType<typeof supabase.channel>[] = [];

    // Owner & Warehouse Keeper: product stock changes
    if (role === UserRole.OWNER || (role === UserRole.EMPLOYEE && user.employeeType === EmployeeType.WAREHOUSE_KEEPER)) {
      const productChannel = supabase
        .channel(`stock-notifications-${user.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' }, (payload) => {
          const product = payload.new as any;
          const alertKey = `${user.id}_stock_${product.id}_${product.stock}`;
          if (processedAlerts.current.has(alertKey)) return;
          processedAlerts.current.add(alertKey);
          
          if (product.stock <= product.min_stock && product.stock > 0) {
            sendNotification(`⚠️ تحديث المخزون: ${product.name} أصبح ${product.stock} فقط`, 'warning', 'تحديث المخزون');
          } else if (product.stock === 0) {
            sendNotification(`🚨 نفاد المخزون: ${product.name}`, 'error', 'نفاد المخزون!');
          }
        })
        .subscribe();
      channels.push(productChannel);
    }

    // Owner & Sales Manager: new sales notifications
    if (role === UserRole.OWNER || (role === UserRole.EMPLOYEE && user.employeeType === EmployeeType.SALES_MANAGER)) {
      const salesChannel = supabase
        .channel(`sales-notifications-${user.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sales' }, (payload) => {
          const sale = payload.new as any;
          if (sale.created_by === user.id) return;
          
          const alertKey = `${user.id}_sale_${sale.id}`;
          if (processedAlerts.current.has(alertKey)) return;
          processedAlerts.current.add(alertKey);
          
          if (sale.remaining > 0) {
            sendNotification(`📝 فاتورة جديدة آجلة: ${sale.customer_name} - ${sale.remaining.toLocaleString()} ل.س`, 'warning', 'فاتورة جديدة');
          }
        })
        .subscribe();
      channels.push(salesChannel);
    }

    // Accountant: collection notifications
    if (role === UserRole.EMPLOYEE && user.employeeType === EmployeeType.ACCOUNTANT) {
      const collectionChannel = supabase
        .channel(`collection-notifications-${user.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'collections' }, (payload) => {
          const collection = payload.new as any;
          if (collection.collected_by === user.id) return;
          
          const alertKey = `${user.id}_collection_${collection.id}`;
          if (processedAlerts.current.has(alertKey)) return;
          processedAlerts.current.add(alertKey);
          
          sendNotification(`💰 تحصيل جديد: ${Number(collection.amount).toLocaleString()} ل.س`, 'success', 'تحصيل جديد');
        })
        .subscribe();
      channels.push(collectionChannel);
    }

    // Field Agent: delivery notifications
    if (role === UserRole.EMPLOYEE && user.employeeType === EmployeeType.FIELD_AGENT) {
      const deliveryChannel = supabase
        .channel(`delivery-notifications-${user.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'deliveries' }, (payload) => {
          const delivery = payload.new as any;
          if (delivery.distributor_id !== user.id) return;
          
          const alertKey = `${user.id}_delivery_${delivery.id}`;
          if (processedAlerts.current.has(alertKey)) return;
          processedAlerts.current.add(alertKey);
          
          sendNotification(`📦 تم تسليم بضاعة جديدة لك`, 'success', 'تسليم جديد');
        })
        .subscribe();
      channels.push(deliveryChannel);
    }

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [user?.id, role, user?.employeeType, addNotification]);

  return { checkLowStock, checkDueInvoices };
};
