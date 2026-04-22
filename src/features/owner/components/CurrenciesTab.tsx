/**
 * CurrenciesTab — Owner-only USD↔SYP exchange rate manager
 *
 * Single-purpose screen: the owner enters today's USD price in Syrian Pounds
 * (i.e. "1 USD = X ل.س"). The rate is appended to an immutable history.
 *
 * The system is permanently locked to two currencies (SYP base + USD), so this
 * tab no longer manages currency lists or pair selection.
 *
 * Arabic-only, RTL. Android API 26+ compatible.
 */
import React, { useMemo, useState } from 'react';
import { Coins, History, Loader2, Check, TrendingUp, TrendingDown } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { useCurrency } from '@/store/CurrencyContext';
import { currencyService } from '@/services/currencyService';
import { useApp } from '@/store/AppContext';

const formatRate = (n: number) =>
  Math.round(n).toLocaleString('en-US');

const formatDateTime = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ar-SY', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

export const CurrenciesTab: React.FC = () => {
  const { organization, user } = useAuth();
  const { addNotification } = useApp();
  const { rates, usdRate, refresh, isLoading } = useCurrency();
  const orgId = organization?.id;

  const [newRate, setNewRate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filter to USD→SYP entries only (the only direction the system records)
  const usdRates = useMemo(
    () => rates.filter(r => r.from_currency === 'USD' && r.to_currency === 'SYP'),
    [rates]
  );

  const previousRate = useMemo(() => {
    return usdRates.length > 1 ? Number(usdRates[1].rate) : null;
  }, [usdRates]);

  const trend = useMemo(() => {
    if (usdRate === null || previousRate === null) return null;
    if (usdRate > previousRate) return 'up' as const;
    if (usdRate < previousRate) return 'down' as const;
    return 'flat' as const;
  }, [usdRate, previousRate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    const value = parseFloat(newRate);
    if (!Number.isFinite(value) || value <= 0) {
      addNotification('أدخل سعراً صحيحاً أكبر من صفر', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await currencyService.addRate(orgId, {
        from_currency: 'USD',
        to_currency: 'SYP',
        rate: value,
        notes: undefined,
        created_by: user?.id ?? null,
        created_by_name: user?.name ?? null,
      });
      await refresh();
      addNotification('تم تحديث سعر صرف الدولار', 'success');
      setNewRate('');
    } catch (err: any) {
      addNotification(err?.message || 'فشل تحديث السعر', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Current rate hero card */}
      <div className="bg-card rounded-2xl p-5 shadow-sm border border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-amber-500/10 rounded-xl flex items-center justify-center">
              <Coins className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">سعر صرف الدولار</h3>
              <p className="text-xs text-muted-foreground">يُحدَّث جميع أسعار المنتجات والفواتير فوراً</p>
            </div>
          </div>
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 rounded-xl p-5 text-center">
          <p className="text-xs text-muted-foreground mb-2">السعر الحالي</p>
          {usdRate === null ? (
            <p className="text-base font-bold text-muted-foreground py-3">
              لم يتم إدخال سعر بعد
            </p>
          ) : (
            <div className="space-y-1">
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-sm font-bold text-foreground">1 دولار =</span>
                <span className="text-3xl font-black text-amber-600">{formatRate(usdRate)}</span>
                <span className="text-sm font-bold text-foreground">ل.س</span>
              </div>
              {trend && trend !== 'flat' && previousRate !== null && (
                <div className={`inline-flex items-center gap-1 text-xs font-bold ${
                  trend === 'up' ? 'text-rose-600' : 'text-emerald-600'
                }`}>
                  {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  <span>السابق: {formatRate(previousRate)} ل.س</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Update rate form */}
      <div className="bg-card rounded-2xl p-5 shadow-sm border border-border">
        <h4 className="font-bold text-foreground text-sm mb-3">تحديث سعر اليوم</h4>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="bg-muted/30 rounded-xl p-3">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-bold text-foreground whitespace-nowrap shrink-0">1$ =</span>
              <input
                type="number"
                inputMode="decimal"
                step="1"
                min="1"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                placeholder={usdRate ? formatRate(usdRate) : '14000'}
                required
                className="flex-1 min-w-0 px-2 py-3 bg-background text-foreground rounded-lg border border-border outline-none focus:ring-2 focus:ring-primary text-center text-base font-black"
                dir="ltr"
              />
              <span className="text-xs font-bold text-foreground whitespace-nowrap shrink-0">ل.س</span>
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting || !newRate.trim()}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            حفظ السعر الجديد
          </button>
          <p className="text-[11px] text-muted-foreground text-center">
            يُسجَّل كل تحديث في السجل أدناه ولا يمكن تعديله لاحقاً.
          </p>
        </form>
      </div>

      {/* Rate history */}
      <div className="bg-card rounded-2xl p-5 shadow-sm border border-border">
        <h4 className="font-bold text-foreground text-sm mb-3 flex items-center gap-2">
          <History className="w-4 h-4" /> سجل أسعار الصرف
        </h4>

        {usdRates.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            لا يوجد سجل أسعار صرف بعد
          </p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {usdRates.map((r, idx) => (
              <div
                key={r.id}
                className={`rounded-xl p-3 ${
                  idx === 0 ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-muted/30'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-baseline gap-1.5 text-sm font-bold text-foreground" dir="ltr">
                    <span>1 USD =</span>
                    <span className="text-base text-amber-600">{formatRate(Number(r.rate))}</span>
                    <span>ل.س</span>
                  </div>
                  {idx === 0 && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-700 px-1.5 py-0.5 rounded font-bold">
                      الأحدث
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{formatDateTime(r.effective_at)}</span>
                  {r.created_by_name && <span>بواسطة: {r.created_by_name}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CurrenciesTab;
