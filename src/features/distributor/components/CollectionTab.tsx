import React, { useState, useMemo } from 'react';
import { generateUUID } from '@/lib/uuid';
import {
  Wallet, Search, FileText, Check, Loader2, X, AlertCircle,
  DollarSign, WifiOff, ArrowDownCircle, ArrowUpCircle, User
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { useCurrency } from '@/store/CurrencyContext';
import InvoicePrint from './InvoicePrint';
import type { CachedSale, CachedCustomer } from '../services/distributorOfflineService';

type Direction = 'IN' | 'OUT';
type Currency = 'SYP' | 'USD';

interface CollectionTabProps {
  selectedCustomer: import('@/types').Customer | null;
  onQueueAction: (type: any, payload: any, inventoryUpdates?: any, saleUpdate?: { saleId: string; paidDelta: number }) => Promise<any>;
  isOnline: boolean;
  localSales: CachedSale[];
  localCustomers: CachedCustomer[];
}

const CollectionTab: React.FC<CollectionTabProps> = ({ selectedCustomer, onQueueAction, isOnline, localSales, localCustomers }) => {
  const { addNotification } = useApp();
  const { usdRate } = useCurrency();

  const [direction, setDirection] = useState<Direction>('IN');
  const [currency, setCurrency] = useState<Currency>('SYP');
  const [selectedSaleId, setSelectedSaleId] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [searchSale, setSearchSale] = useState('');
  const [searchCust, setSearchCust] = useState('');

  const [showPrintModal, setShowPrintModal] = useState(false);
  const [lastVoucher, setLastVoucher] = useState<{
    id: string; customerName: string; amount: number; notes?: string;
    direction: Direction; currency: Currency; originalAmount: number; exchangeRate: number;
  } | null>(null);

  // For IN — unpaid sales
  const unpaidSales = useMemo(() => localSales.filter(s => {
    if (s.isVoided || Number(s.remaining) <= 0) return false;
    if (selectedCustomer) return s.customer_id === selectedCustomer.id;
    return true;
  }), [localSales, selectedCustomer]);

  const filteredSales = useMemo(() =>
    unpaidSales.filter(s => s.customerName.toLowerCase().includes(searchSale.toLowerCase())),
    [unpaidSales, searchSale]);

  const selectedSale = localSales.find(s => s.id === selectedSaleId);

  // For OUT — only customers with credit balance (balance < 0)
  const creditCustomers = useMemo(() =>
    localCustomers.filter(c => Number(c.balance) < 0), [localCustomers]);

  const filteredCreditCustomers = useMemo(() =>
    creditCustomers.filter(c => c.name.toLowerCase().includes(searchCust.toLowerCase())),
    [creditCustomers, searchCust]);

  const selectedCust = localCustomers.find(c => c.id === selectedCustomerId);

  // Currency conversion preview
  const numAmount = parseFloat(amount) || 0;
  const sypAmount = currency === 'USD' && usdRate ? numAmount * usdRate : numAmount;

  const canSubmit = direction === 'IN'
    ? !!selectedSaleId && numAmount > 0
    : !!selectedCustomerId && numAmount > 0 && (currency === 'SYP' || !!usdRate);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (numAmount <= 0) { setError('يرجى إدخال مبلغ صحيح'); return; }
    if (currency === 'USD' && !usdRate) { setError('سعر صرف الدولار غير متوفر — يرجى إعداده من قبل الإدارة'); return; }

    if (direction === 'IN' && selectedSale && sypAmount > Number(selectedSale.remaining)) {
      setError('المبلغ أكبر من المتبقي'); return;
    }
    if (direction === 'OUT' && selectedCust) {
      const credit = Math.abs(Number(selectedCust.balance));
      if (sypAmount > credit) { setError('المبلغ أكبر من رصيد الزبون الدائن'); return; }
    }

    setLoading(true);
    setError('');
    try {
      const exchangeRate = currency === 'USD' ? (usdRate || 1) : 1;
      const originalAmount = numAmount;

      if (direction === 'IN') {
        await onQueueAction('ADD_COLLECTION', {
          saleId: selectedSaleId,
          amount: sypAmount,
          notes: notes || null,
          currency,
          originalAmount,
          exchangeRate,
        }, undefined, { saleId: selectedSaleId, paidDelta: sypAmount });
      } else {
        await onQueueAction('ADD_PAYMENT_OUT', {
          customerId: selectedCustomerId,
          amount: sypAmount,
          notes: notes || null,
          currency,
          originalAmount,
          exchangeRate,
        });
      }

      setLastVoucher({
        id: generateUUID(),
        customerName: direction === 'IN' ? (selectedSale?.customerName || '') : (selectedCust?.name || ''),
        amount: sypAmount,
        notes: notes || undefined,
        direction, currency, originalAmount, exchangeRate,
      });

      setSelectedSaleId('');
      setSelectedCustomerId('');
      setAmount('');
      setNotes('');
      setSuccess(true);
      setShowPrintModal(true);

      addNotification(
        direction === 'IN'
          ? (isOnline ? 'تم التحصيل بنجاح' : 'تم حفظ التحصيل — ستتم المزامنة')
          : (isOnline ? 'تم تسجيل سند الدفع بنجاح' : 'تم حفظ سند الدفع — ستتم المزامنة'),
        'success'
      );
    } catch (err: any) {
      setError(err.message || 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  const closePrintModal = () => {
    setShowPrintModal(false);
    setSuccess(false);
    setLastVoucher(null);
  };

  const handleQuickAmount = (value: number) => {
    const current = parseFloat(amount) || 0;
    setAmount((current + value).toString());
  };

  const quickAmounts = currency === 'USD' ? [10, 50, 100, 500, 1000, 5000] : [1000, 5000, 10000, 25000, 50000, 100000];

  // Reset selection when toggling direction
  const switchDirection = (d: Direction) => {
    setDirection(d);
    setSelectedSaleId('');
    setSelectedCustomerId('');
    setAmount('');
    setError('');
  };

  return (
    <div className="p-5 space-y-5">
      {showPrintModal && lastVoucher && (
        <InvoicePrint
          invoiceType={lastVoucher.direction === 'OUT' ? 'payment_out' : 'collection'}
          invoiceId={lastVoucher.id}
          customerName={lastVoucher.customerName}
          date={new Date()}
          grandTotal={lastVoucher.amount}
          notes={lastVoucher.notes}
          currency={lastVoucher.currency}
          originalAmount={lastVoucher.originalAmount}
          exchangeRate={lastVoucher.exchangeRate}
          onClose={closePrintModal}
        />
      )}

      {/* Direction toggle */}
      <div className="grid grid-cols-2 gap-2 bg-muted p-1 rounded-2xl">
        <button onClick={() => switchDirection('IN')}
          className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
            direction === 'IN' ? 'bg-emerald-500 text-white shadow' : 'text-muted-foreground'
          }`}>
          <ArrowDownCircle className="w-5 h-5" /> سند قبض
        </button>
        <button onClick={() => switchDirection('OUT')}
          className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
            direction === 'OUT' ? 'bg-orange-500 text-white shadow' : 'text-muted-foreground'
          }`}>
          <ArrowUpCircle className="w-5 h-5" /> سند دفع
        </button>
      </div>

      {/* Currency toggle */}
      <div className="grid grid-cols-2 gap-2 bg-muted p-1 rounded-2xl">
        <button onClick={() => setCurrency('SYP')}
          className={`py-2.5 rounded-xl font-bold text-sm transition-all ${
            currency === 'SYP' ? 'bg-card text-foreground shadow' : 'text-muted-foreground'
          }`}>
          ل.س
        </button>
        <button onClick={() => setCurrency('USD')}
          className={`py-2.5 rounded-xl font-bold text-sm transition-all ${
            currency === 'USD' ? 'bg-card text-foreground shadow' : 'text-muted-foreground'
          }`}>
          USD {usdRate ? `(1$ = ${usdRate.toLocaleString('ar-SA')} ل.س)` : '(لا يوجد سعر صرف)'}
        </button>
      </div>

      {success && !showPrintModal && (
        <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 p-4 rounded-2xl flex items-center gap-2 border border-emerald-500/20">
          <Check className="w-5 h-5" />
          <span className="font-bold">{direction === 'IN' ? 'تم التحصيل بنجاح!' : 'تم تسجيل سند الدفع!'}</span>
          {!isOnline && <span className="text-xs text-muted-foreground mr-auto flex items-center gap-1"><WifiOff className="w-3 h-3" /> محفوظة محلياً</span>}
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-2xl flex items-center gap-2 border border-destructive/20">
          <AlertCircle className="w-5 h-5" />
          <span className="font-bold">{error}</span>
        </div>
      )}

      {/* Amount input */}
      <div className="bg-muted rounded-3xl p-5 md:p-6">
        <p className="text-muted-foreground text-center font-bold mb-4">
          {direction === 'IN' ? 'مبلغ التحصيل' : 'مبلغ الدفع'} ({currency === 'USD' ? 'بالدولار' : 'بالليرة'})
        </p>
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full text-center text-4xl md:text-5xl font-black text-foreground bg-transparent border-none outline-none py-6" dir="ltr" />
        {currency === 'USD' && usdRate && numAmount > 0 && (
          <p className="text-center text-sm font-bold text-blue-600 dark:text-blue-400 mb-2">
            ≈ {sypAmount.toLocaleString('ar-SA')} ل.س
          </p>
        )}
        <div className="grid grid-cols-3 gap-3 mt-3">
          {quickAmounts.map((value) => (
            <button key={value} onClick={() => handleQuickAmount(value)}
              className="py-4 bg-card rounded-xl font-bold text-foreground hover:bg-card/80 transition-colors border border-border active:scale-[0.97] text-base">
              +{value.toLocaleString('ar-SA')}
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      <button onClick={handleSubmit} disabled={loading || !canSubmit}
        className={`w-full font-black py-5 md:py-6 rounded-2xl flex items-center justify-center gap-3 disabled:opacity-50 transition-all active:scale-[0.98] text-lg ${
          direction === 'IN' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
        }`}>
        {loading ? (
          <><Loader2 className="w-6 h-6 animate-spin" /> جارٍ الحفظ...</>
        ) : (
          <>
            <DollarSign className="w-6 h-6" />
            {direction === 'IN' ? 'توثيق سند القبض' : 'توثيق سند الدفع'}
            {!isOnline && <WifiOff className="w-4 h-4 opacity-60" />}
          </>
        )}
      </button>

      {/* IN: Sale selection */}
      {direction === 'IN' && !selectedSale && (
        <div className="space-y-4">
          <p className="text-muted-foreground font-bold">اختر الفاتورة:</p>
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input type="text" placeholder="بحث بالعميل..." value={searchSale}
              onChange={(e) => setSearchSale(e.target.value)}
              className="w-full bg-muted border-none rounded-2xl px-12 py-4 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-base" />
          </div>
          {unpaidSales.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wallet className="w-16 h-16 mx-auto mb-3 opacity-30" />
              <p className="font-bold text-lg">لا توجد فواتير مستحقة</p>
            </div>
          ) : (
            <div className="max-h-[35vh] overflow-y-auto space-y-2 rounded-2xl">
              {filteredSales.map((sale) => (
                <button key={sale.id} onClick={() => setSelectedSaleId(sale.id)}
                  className="w-full text-start p-4 bg-muted rounded-2xl hover:bg-muted/80 transition-colors active:scale-[0.98]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-foreground">{sale.customerName}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(sale.timestamp).toLocaleDateString('ar-SA')}
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="font-black text-orange-500 text-lg">
                        {Number(sale.remaining).toLocaleString('ar-SA')} ل.س
                      </p>
                      <p className="text-xs text-muted-foreground">متبقي</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* IN: Selected sale info */}
      {direction === 'IN' && selectedSale && (
        <div className="bg-muted rounded-2xl p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-primary" />
              <span className="font-bold text-lg">{selectedSale.customerName}</span>
            </div>
            <button onClick={() => { setSelectedSaleId(''); setAmount(''); }}
              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-card rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">الإجمالي</p>
              <p className="font-black text-foreground text-lg">{Number(selectedSale.grandTotal).toLocaleString('ar-SA')}</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">المدفوع</p>
              <p className="font-black text-emerald-600 text-lg">{Number(selectedSale.paidAmount).toLocaleString('ar-SA')}</p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-500/10 rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">المتبقي</p>
              <p className="font-black text-orange-500 text-lg">{Number(selectedSale.remaining).toLocaleString('ar-SA')}</p>
            </div>
          </div>
        </div>
      )}

      {/* OUT: Credit customer selection */}
      {direction === 'OUT' && !selectedCust && (
        <div className="space-y-4">
          <p className="text-muted-foreground font-bold">اختر الزبون (الدائنون فقط):</p>
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input type="text" placeholder="بحث بالاسم..." value={searchCust}
              onChange={(e) => setSearchCust(e.target.value)}
              className="w-full bg-muted border-none rounded-2xl px-12 py-4 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-base" />
          </div>
          {creditCustomers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <User className="w-16 h-16 mx-auto mb-3 opacity-30" />
              <p className="font-bold text-lg">لا يوجد زبائن دائنون</p>
              <p className="text-xs mt-1">يظهر هنا فقط الزبائن الذين لهم رصيد دائن لدى المنشأة</p>
            </div>
          ) : (
            <div className="max-h-[35vh] overflow-y-auto space-y-2 rounded-2xl">
              {filteredCreditCustomers.map((c) => (
                <button key={c.id} onClick={() => setSelectedCustomerId(c.id)}
                  className="w-full text-start p-4 bg-muted rounded-2xl hover:bg-muted/80 transition-colors active:scale-[0.98]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{c.name}</p>
                        {c.phone && <p className="text-xs text-muted-foreground" dir="ltr">{c.phone}</p>}
                      </div>
                    </div>
                    <div className="text-end">
                      <p className="font-black text-blue-600 text-lg">
                        {Math.abs(Number(c.balance)).toLocaleString('ar-SA')} ل.س
                      </p>
                      <p className="text-xs text-muted-foreground">رصيد دائن</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* OUT: Selected customer info */}
      {direction === 'OUT' && selectedCust && (
        <div className="bg-muted rounded-2xl p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <User className="w-6 h-6 text-blue-600" />
              <span className="font-bold text-lg">{selectedCust.name}</span>
            </div>
            <button onClick={() => { setSelectedCustomerId(''); setAmount(''); }}
              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="bg-blue-500/10 rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">الرصيد الدائن المستحق له</p>
            <p className="font-black text-blue-600 text-2xl">{Math.abs(Number(selectedCust.balance)).toLocaleString('ar-SA')} ل.س</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectionTab;
