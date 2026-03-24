import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText, Wallet, RotateCcw, ArrowRight, Loader2, X, ChevronDown
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { useCustomerStatement } from '../hooks/useAccountantData';
import { CURRENCY } from '@/constants';
import FullScreenModal from '@/components/ui/FullScreenModal';

interface CustomerStatementProps {
  customerId: string;
  customerName: string;
  onClose: () => void;
}

interface TimelineEntry {
  id: string;
  date: string;
  timestamp: number;
  type: 'sale' | 'collection' | 'return';
  amount: number;
  runningBalance: number;
  details?: string;
}

const CustomerStatement: React.FC<CustomerStatementProps> = ({ customerId, customerName, onClose }) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
  const { data, isLoading } = useCustomerStatement(customerId);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const timeline = useMemo(() => {
    if (!data) return [];

    const entries: TimelineEntry[] = [];

    // Sales add to balance
    data.sales.forEach(s => {
      if (s.is_voided) return;
      entries.push({
        id: `sale-${s.id}`,
        date: s.created_at,
        timestamp: new Date(s.created_at).getTime(),
        type: 'sale',
        amount: Number(s.grand_total),
        runningBalance: 0,
        details: s.payment_type,
      });
    });

    // Collections reduce balance
    data.collections.forEach(c => {
      if (c.is_reversed) return;
      entries.push({
        id: `coll-${c.id}`,
        date: c.created_at,
        timestamp: new Date(c.created_at).getTime(),
        type: 'collection',
        amount: -Number(c.amount),
        runningBalance: 0,
      });
    });

    // Returns reduce balance
    data.returns.forEach(r => {
      entries.push({
        id: `ret-${r.id}`,
        date: r.created_at,
        timestamp: new Date(r.created_at).getTime(),
        type: 'return',
        amount: -Number(r.total_amount),
        runningBalance: 0,
        details: r.reason || undefined,
      });
    });

    // Sort chronologically
    entries.sort((a, b) => a.timestamp - b.timestamp);

    // Calculate running balance
    let balance = 0;
    entries.forEach(e => {
      balance += e.amount;
      e.runningBalance = balance;
    });

    return entries;
  }, [data]);

  const filteredTimeline = useMemo(() => {
    return timeline.filter(e => {
      if (dateFrom && e.timestamp < new Date(dateFrom).getTime()) return false;
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59);
        if (e.timestamp > to.getTime()) return false;
      }
      return true;
    });
  }, [timeline, dateFrom, dateTo]);

  const totalSales = filteredTimeline.filter(e => e.type === 'sale').reduce((s, e) => s + e.amount, 0);
  const totalCollections = filteredTimeline.filter(e => e.type === 'collection').reduce((s, e) => s + Math.abs(e.amount), 0);
  const totalReturns = filteredTimeline.filter(e => e.type === 'return').reduce((s, e) => s + Math.abs(e.amount), 0);

  const typeConfig = {
    sale: { icon: <FileText className="w-3.5 h-3.5" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', label: t('statement.sale') },
    collection: { icon: <Wallet className="w-3.5 h-3.5" />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10', label: t('statement.collection') },
    return: { icon: <RotateCcw className="w-3.5 h-3.5" />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', label: t('statement.return') },
  };

  return (
    <FullScreenModal
      isOpen={true}
      onClose={onClose}
      title={`${t('statement.title')} - ${customerName}`}
      icon={<FileText className="w-5 h-5" />}
      headerColor="primary"
    >
      <div className="space-y-3">
        {/* Date Filters */}
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="bg-muted rounded-xl px-3 py-2 text-xs font-medium text-foreground border-none" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="bg-muted rounded-xl px-3 py-2 text-xs font-medium text-foreground border-none" />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-emerald-500/10 p-3 rounded-xl text-center">
            <p className="text-[8px] text-muted-foreground font-bold">{t('statement.totalSales')}</p>
            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{totalSales.toLocaleString(locale)}</p>
          </div>
          <div className="bg-blue-500/10 p-3 rounded-xl text-center">
            <p className="text-[8px] text-muted-foreground font-bold">{t('statement.totalCollections')}</p>
            <p className="text-sm font-black text-blue-600 dark:text-blue-400">{totalCollections.toLocaleString(locale)}</p>
          </div>
          <div className="bg-amber-500/10 p-3 rounded-xl text-center">
            <p className="text-[8px] text-muted-foreground font-bold">{t('statement.totalReturns')}</p>
            <p className="text-sm font-black text-amber-600 dark:text-amber-400">{totalReturns.toLocaleString(locale)}</p>
          </div>
        </div>

        {/* Current Balance */}
        {filteredTimeline.length > 0 && (
          <div className={`p-3 rounded-xl text-center ${
            filteredTimeline[filteredTimeline.length - 1].runningBalance > 0
              ? 'bg-destructive/10'
              : 'bg-emerald-500/10'
          }`}>
            <p className="text-[9px] text-muted-foreground font-bold">{t('statement.runningBalance')}</p>
            <p className={`text-xl font-black ${
              filteredTimeline[filteredTimeline.length - 1].runningBalance > 0
                ? 'text-destructive'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {filteredTimeline[filteredTimeline.length - 1].runningBalance.toLocaleString(locale)} {CURRENCY}
            </p>
          </div>
        )}

        {/* Timeline */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredTimeline.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-bold text-sm">{t('statement.noTransactions')}</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredTimeline.map(entry => {
              const cfg = typeConfig[entry.type];
              return (
                <div key={entry.id} className="bg-card p-3 rounded-xl shadow-sm flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cfg.bg} ${cfg.color}`}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">{cfg.label}</span>
                      <span className={`text-xs font-black ${
                        entry.amount > 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {entry.amount > 0 ? '+' : ''}{entry.amount.toLocaleString(locale)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(entry.date).toLocaleDateString(locale)}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {t('statement.balance')}: {entry.runningBalance.toLocaleString(locale)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </FullScreenModal>
  );
};

export default CustomerStatement;
