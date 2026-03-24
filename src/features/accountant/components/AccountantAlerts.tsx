import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Clock, TrendingDown, Users, ShieldAlert } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { CURRENCY } from '@/constants';

interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  icon: React.ReactNode;
  title: string;
  description: string;
}

const AccountantAlerts: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
  const { sales, customers } = useApp();

  const alerts = useMemo(() => {
    const result: Alert[] = [];
    const now = Date.now();
    const DAY = 86400000;

    // Overdue invoices (>30 days with remaining > 0)
    const overdue = sales.filter(s => {
      if (s.isVoided || Number(s.remaining) <= 0) return false;
      const age = (now - s.timestamp) / DAY;
      return age > 30;
    });
    if (overdue.length > 0) {
      const totalOverdue = overdue.reduce((s, o) => s + Number(o.remaining), 0);
      result.push({
        id: 'overdue',
        severity: 'critical',
        icon: <Clock className="w-4 h-4" />,
        title: t('alerts.overdueInvoices', { count: overdue.length }),
        description: t('alerts.overdueAmount', { amount: totalOverdue.toLocaleString(locale), currency: CURRENCY }),
      });
    }

    // High-risk customers (balance > average * 3)
    const debtors = customers.filter(c => Number(c.balance) > 0);
    if (debtors.length > 0) {
      const avgDebt = debtors.reduce((s, c) => s + Number(c.balance), 0) / debtors.length;
      const highRisk = debtors.filter(c => Number(c.balance) > avgDebt * 3);
      if (highRisk.length > 0) {
        result.push({
          id: 'high-risk',
          severity: 'warning',
          icon: <Users className="w-4 h-4" />,
          title: t('alerts.highRiskCustomers', { count: highRisk.length }),
          description: highRisk.map(c => c.name).slice(0, 3).join(', '),
        });
      }
    }

    // Low collection rate in recent sales (last 7 days)
    const recentSales = sales.filter(s => !s.isVoided && (now - s.timestamp) / DAY <= 7);
    if (recentSales.length > 5) {
      const recentTotal = recentSales.reduce((s, r) => s + Number(r.grandTotal), 0);
      const recentCollected = recentSales.reduce((s, r) => s + Number(r.paidAmount), 0);
      const rate = recentTotal > 0 ? (recentCollected / recentTotal) * 100 : 100;
      if (rate < 40) {
        result.push({
          id: 'low-collection',
          severity: 'warning',
          icon: <TrendingDown className="w-4 h-4" />,
          title: t('alerts.lowRecentCollections'),
          description: t('alerts.collectionRateWeek', { rate: rate.toFixed(0) }),
        });
      }
    }

    // No recent sales (possible drop)
    const last3DaysSales = sales.filter(s => !s.isVoided && (now - s.timestamp) / DAY <= 3);
    const prev3DaysSales = sales.filter(s => !s.isVoided && (now - s.timestamp) / DAY > 3 && (now - s.timestamp) / DAY <= 6);
    if (prev3DaysSales.length > 0 && last3DaysSales.length < prev3DaysSales.length * 0.5) {
      result.push({
        id: 'sales-drop',
        severity: 'info',
        icon: <TrendingDown className="w-4 h-4" />,
        title: t('alerts.salesDrop'),
        description: t('alerts.salesDropDetail', {
          recent: last3DaysSales.length,
          previous: prev3DaysSales.length,
        }),
      });
    }

    if (result.length === 0) {
      result.push({
        id: 'all-good',
        severity: 'info',
        icon: <ShieldAlert className="w-4 h-4" />,
        title: t('alerts.allGood'),
        description: t('alerts.noIssues'),
      });
    }

    return result;
  }, [sales, customers, t, locale]);

  const severityStyles = {
    critical: 'bg-destructive/10 border-destructive/20 text-destructive',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400',
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400',
  };

  return (
    <div className="space-y-2">
      {alerts.map(alert => (
        <div
          key={alert.id}
          className={`p-3 rounded-xl border ${severityStyles[alert.severity]} flex items-start gap-3`}
        >
          <div className="mt-0.5">{alert.icon}</div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-xs">{alert.title}</p>
            <p className="text-[10px] opacity-80 mt-0.5">{alert.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AccountantAlerts;
