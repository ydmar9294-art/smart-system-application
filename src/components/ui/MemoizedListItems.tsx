/**
 * Memoized List Item Components
 * 
 * Extracted and wrapped with React.memo to prevent unnecessary re-renders
 * in heavy list views (sales, collections, customers, invoices).
 */
import React, { useCallback } from 'react';
import {
  FileText, Eye, Printer, Ban, User, Wallet,
  Phone, MapPin, CircleDollarSign, RotateCcw,
  Tag, WifiOff
} from 'lucide-react';
import { CURRENCY } from '@/constants';

// ─── Sale List Item ───
interface SaleListItemProps {
  sale: {
    id: string;
    customerName: string;
    grandTotal: number;
    paidAmount: number;
    remaining: number;
    isVoided: boolean;
    timestamp: number;
    discountType?: string | null;
    discountValue?: number;
    discountPercentage?: number;
  };
  locale: string;
  onViewDetails: (id: string) => void;
  onPrint: (sale: any) => void;
  getStatusBadge: (sale: any) => React.ReactNode;
  t: (key: string) => string;
}

export const SaleListItem = React.memo<SaleListItemProps>(({
  sale, locale, onViewDetails, onPrint, getStatusBadge, t
}) => (
  <div className={`bg-card p-4 rounded-2xl shadow-sm ${sale.isVoided ? 'opacity-50' : ''}`}>
    <div className="flex items-start justify-between mb-2">
      <div>
        <p className="font-bold text-foreground">{sale.customerName}</p>
        <p className="text-xs text-muted-foreground">{new Date(sale.timestamp).toLocaleDateString(locale)}</p>
      </div>
      <div className="flex items-center gap-2">
        {getStatusBadge(sale)}
      </div>
    </div>
    <div className="grid grid-cols-3 gap-2 text-center mb-3">
      <div>
        <p className="text-[9px] text-muted-foreground">{t('accountant.totalLabel')}</p>
        <p className="text-sm font-black text-foreground">{Number(sale.grandTotal).toLocaleString(locale)}</p>
      </div>
      <div>
        <p className="text-[9px] text-muted-foreground">{t('accountant.paidLabel')}</p>
        <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{Number(sale.paidAmount).toLocaleString(locale)}</p>
      </div>
      <div>
        <p className="text-[9px] text-muted-foreground">{t('accountant.remainingLabel')}</p>
        <p className="text-sm font-black text-warning">{Number(sale.remaining).toLocaleString(locale)}</p>
      </div>
    </div>
    {Number(sale.discountValue || 0) > 0 && (
      <div className="flex items-center gap-1.5 mb-3 px-2 py-1.5 bg-purple-500/10 rounded-lg">
        <Tag className="w-3 h-3 text-purple-600 dark:text-purple-400" />
        <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400">
          {t('accountant.discountLabel')}: {Number(sale.discountValue).toLocaleString(locale)} {CURRENCY}
          {sale.discountType === 'percentage' ? ` (${Number(sale.discountPercentage || 0).toFixed(1)}%)` : ''}
        </span>
      </div>
    )}
    <div className="flex gap-2">
      <button onClick={() => onViewDetails(sale.id)}
        className="flex-1 flex items-center justify-center gap-1.5 bg-muted py-2 rounded-xl text-xs font-bold text-foreground hover:bg-accent transition-colors">
        <Eye className="w-3.5 h-3.5" /> {t('common.details')}
      </button>
      <button onClick={() => onPrint(sale)}
        className="flex items-center justify-center gap-1.5 bg-primary/10 text-primary px-4 py-2 rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors">
        <Printer className="w-3.5 h-3.5" /> {t('common.print')}
      </button>
    </div>
  </div>
), (prev, next) => prev.sale.id === next.sale.id
  && prev.sale.paidAmount === next.sale.paidAmount
  && prev.sale.remaining === next.sale.remaining
  && prev.sale.isVoided === next.sale.isVoided
  && prev.locale === next.locale
);
SaleListItem.displayName = 'SaleListItem';

// ─── Collection List Item ───
interface CollectionListItemProps {
  coll: {
    id: string;
    saleId?: string;
    amount: number;
    notes?: string;
    isReversed: boolean;
    reverseReason?: string;
    timestamp: number;
    customerName?: string;
  };
  locale: string;
  t: (key: string) => string;
}

export const CollectionListItem = React.memo<CollectionListItemProps>(({ coll, locale, t }) => (
  <div className={`bg-card p-4 rounded-2xl shadow-sm ${coll.isReversed ? 'opacity-50' : ''}`}>
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
          <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <p className="font-bold text-foreground text-sm">{coll.customerName || coll.saleId?.slice(0, 8) || '—'}</p>
      </div>
      {coll.isReversed ? (
        <span className="bg-destructive/10 text-destructive px-2 py-0.5 rounded-lg text-[10px] font-bold">{t('accountant.cancelled')}</span>
      ) : (
        <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-lg text-[10px] font-bold">{t('accountant.done')}</span>
      )}
    </div>
    <div className="flex items-center justify-between">
      <p className="font-black text-lg text-emerald-600 dark:text-emerald-400">{Number(coll.amount).toLocaleString(locale)} {CURRENCY}</p>
      <p className="text-xs text-muted-foreground">{new Date(coll.timestamp).toLocaleDateString(locale)}</p>
    </div>
    {coll.notes && <p className="text-xs text-muted-foreground mt-1">{coll.notes}</p>}
    {coll.isReversed && coll.reverseReason && (
      <p className="text-xs text-destructive mt-1">{t('common.cancelledReason')}: {coll.reverseReason}</p>
    )}
  </div>
), (prev, next) => prev.coll.id === next.coll.id
  && prev.coll.isReversed === next.coll.isReversed
  && prev.coll.amount === next.coll.amount
  && prev.locale === next.locale
);
CollectionListItem.displayName = 'CollectionListItem';

// ─── Customer List Item ───
interface CustomerListItemProps {
  customer: {
    id: string;
    name: string;
    phone?: string;
    location?: string;
    balance: number;
  };
  locale: string;
  t: (key: string) => string;
}

export const CustomerListItem = React.memo<CustomerListItemProps>(({ customer: c, locale, t }) => {
  const hasDebt = c.balance > 0;
  const hasCredit = c.balance < 0;
  const borderClass = hasDebt ? 'border-r-4 border-destructive' : hasCredit ? 'border-r-4 border-blue-500' : '';
  const iconBg = hasDebt ? 'bg-destructive/10' : hasCredit ? 'bg-blue-500/10' : 'bg-success/10';
  const iconColor = hasDebt ? 'text-destructive' : hasCredit ? 'text-blue-600' : 'text-success';
  const nameColor = hasDebt ? 'text-destructive' : hasCredit ? 'text-blue-600' : 'text-foreground';
  const balanceColor = hasDebt ? 'text-destructive' : hasCredit ? 'text-blue-600' : 'text-success';
  const badgeBg = hasDebt ? 'bg-destructive/10 text-destructive' : hasCredit ? 'bg-blue-500/10 text-blue-600' : 'bg-success/10 text-success';
  const badgeText = hasDebt ? t('ownerCustomers.hasDebt') : hasCredit ? t('ownerCustomers.creditBalance') : t('ownerCustomers.noDebt');

  return (
    <div className={`bg-card p-4 rounded-2xl shadow-sm ${borderClass}`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
            <CircleDollarSign className={`w-5 h-5 ${iconColor}`} />
          </div>
          <div>
            <p className={`font-bold ${nameColor}`}>{c.name}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeBg}`}>
              {badgeText}
            </span>
          </div>
        </div>
        <div className="text-end">
          <p className={`font-black text-lg ${balanceColor}`}>{Math.abs(c.balance).toLocaleString(locale)}</p>
          <p className="text-[10px] text-muted-foreground">{CURRENCY}</p>
        </div>
      </div>
      {hasCredit && (
        <div className="mb-3 px-3 py-2 bg-blue-500/10 rounded-xl flex items-center gap-2">
          <Wallet className="w-4 h-4 text-blue-600" />
          <p className="text-xs font-bold text-blue-600">{t('ownerCustomers.needsPayment')}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-3 pt-3 border-t border-border">
        {c.phone && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Phone className="w-3.5 h-3.5" />
            <span className="text-xs font-medium" dir="ltr">{c.phone}</span>
          </div>
        )}
        {c.location && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{c.location}</span>
          </div>
        )}
      </div>
    </div>
  );
}, (prev, next) => prev.customer.id === next.customer.id
  && prev.customer.balance === next.customer.balance
  && prev.customer.name === next.customer.name
  && prev.locale === next.locale
);
CustomerListItem.displayName = 'CustomerListItem';

// ─── Invoice History Item ───
interface InvoiceListItemProps {
  invoice: {
    id: string;
    invoice_type: string;
    invoice_number: string;
    customer_name: string;
    grand_total: number;
    payment_type?: string | null;
    invoice_date: string;
    isLocal?: boolean;
  };
  locale: string;
  onPrint: (invoice: any) => void;
  getTypeColor: (type: string) => string;
  getTypeIcon: (type: string) => React.ReactNode;
  getTypeName: (type: string) => string;
  isRtl: boolean;
  t: any;
}

export const InvoiceListItem = React.memo<InvoiceListItemProps>(({
  invoice, locale, onPrint, getTypeColor, getTypeIcon, getTypeName, isRtl, t
}) => (
  <div className="bg-muted rounded-2xl p-4 space-y-3">
    {/* Row 1: Customer name + date */}
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="font-bold text-foreground truncate">{invoice.customer_name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {new Date(invoice.invoice_date).toLocaleDateString(locale)}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${getTypeColor(invoice.invoice_type)}`}>
          {getTypeIcon(invoice.invoice_type)}
          {getTypeName(invoice.invoice_type)}
        </span>
        {invoice.isLocal && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 whitespace-nowrap">
            <WifiOff className="w-3 h-3" />
          </span>
        )}
      </div>
    </div>

    {/* Row 2: Amount + invoice number + payment type */}
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-baseline gap-1.5">
        <p className={`text-lg font-black ${invoice.invoice_type === 'return' ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
          {invoice.invoice_type === 'return' ? '-' : ''}{Number(invoice.grand_total).toLocaleString(locale)}
        </p>
        <p className="text-xs text-muted-foreground">{CURRENCY}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground font-mono">{invoice.invoice_number}</span>
        {invoice.invoice_type === 'sale' && invoice.payment_type && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${
            invoice.payment_type === 'CASH'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
          }`}>
            {invoice.payment_type === 'CASH' ? t('invoice.cashPayment', 'نقدي') : t('invoice.creditPayment', 'آجل')}
          </span>
        )}
        <button
          onClick={() => onPrint(invoice)}
          className="p-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
        >
          <Printer className="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
), (prev, next) => prev.invoice.id === next.invoice.id
  && prev.invoice.grand_total === next.invoice.grand_total
  && prev.locale === next.locale
);
InvoiceListItem.displayName = 'InvoiceListItem';
