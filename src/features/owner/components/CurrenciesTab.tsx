/**
 * CurrenciesTab - Owner-only currency management UI
 * 
 * Features:
 * - List & add organization currencies (max 5)
 * - Toggle currency active state (base cannot be deactivated)
 * - View exchange rate history (immutable)
 * - Add new exchange rate entries
 * 
 * Arabic-only, RTL layout. Uses semantic design tokens.
 * Android API 26+ compatible.
 */
import React, { useState, useMemo } from 'react';
import { Coins, Plus, ArrowRightLeft, History, Loader2, AlertCircle, Check } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { useCurrency } from '@/store/CurrencyContext';
import { currencyService, MAX_CURRENCIES_PER_ORG } from '@/services/currencyService';
import { useApp } from '@/store/AppContext';

const COMMON_CURRENCIES: { code: string; name_ar: string; symbol: string }[] = [
  { code: 'SYP', name_ar: 'ليرة سورية', symbol: 'ل.س' },
  { code: 'USD', name_ar: 'دولار أمريكي', symbol: '$' },
  { code: 'EUR', name_ar: 'يورو', symbol: '€' },
  { code: 'TRY', name_ar: 'ليرة تركية', symbol: '₺' },
  { code: 'SAR', name_ar: 'ريال سعودي', symbol: '﷼' },
  { code: 'AED', name_ar: 'درهم إماراتي', symbol: 'د.إ' },
  { code: 'JOD', name_ar: 'دينار أردني', symbol: 'د.أ' },
  { code: 'EGP', name_ar: 'جنيه مصري', symbol: 'ج.م' },
];

export const CurrenciesTab: React.FC = () => {
  const { organization, user } = useAuth();
  const { addNotification } = useApp();
  const { currencies, rates, refresh, isLoading } = useCurrency();
  const orgId = organization?.id;

  const [showAddCurrency, setShowAddCurrency] = useState(false);
  const [showAddRate, setShowAddRate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Add currency form
  const [selectedCode, setSelectedCode] = useState('USD');
  const [customCode, setCustomCode] = useState('');
  const [customName, setCustomName] = useState('');
  const [customSymbol, setCustomSymbol] = useState('');

  // Add rate form
  const [rateFrom, setRateFrom] = useState('');
  const [rateTo, setRateTo] = useState('');
  const [rateValue, setRateValue] = useState('');
  const [rateNotes, setRateNotes] = useState('');

  const activeCurrencies = useMemo(() => currencies.filter(c => c.is_active), [currencies]);
  const canAddMore = currencies.length < MAX_CURRENCIES_PER_ORG;

  const availablePresets = useMemo(
    () => COMMON_CURRENCIES.filter(p => !currencies.some(c => c.currency_code === p.code)),
    [currencies]
  );

  const handleAddCurrency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    setSubmitting(true);
    try {
      let code: string, name: string, symbol: string;
      if (selectedCode === 'CUSTOM') {
        code = customCode.trim().toUpperCase();
        name = customName.trim();
        symbol = customSymbol.trim();
        if (!code || !name) throw new Error('الرمز والاسم مطلوبان');
      } else {
        const preset = availablePresets.find(p => p.code === selectedCode);
        if (!preset) throw new Error('اختر عملة');
        code = preset.code;
        name = preset.name_ar;
        symbol = preset.symbol;
      }
      await currencyService.add(orgId, {
        currency_code: code,
        currency_name_ar: name,
        symbol,
      });
      await refresh();
      addNotification('تمت إضافة العملة', 'success');
      setShowAddCurrency(false);
      setCustomCode(''); setCustomName(''); setCustomSymbol('');
    } catch (err: any) {
      addNotification(err.message || 'فشلت إضافة العملة', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    setSubmitting(true);
    try {
      const rate = parseFloat(rateValue);
      if (isNaN(rate) || rate <= 0) throw new Error('سعر الصرف غير صحيح');
      await currencyService.addRate(orgId, {
        from_currency: rateFrom,
        to_currency: rateTo,
        rate,
        notes: rateNotes || undefined,
        created_by: user?.id ?? null,
        created_by_name: user?.name ?? null,
      });
      await refresh();
      addNotification('تم تسجيل سعر الصرف', 'success');
      setShowAddRate(false);
      setRateFrom(''); setRateTo(''); setRateValue(''); setRateNotes('');
    } catch (err: any) {
      addNotification(err.message || 'فشل تسجيل سعر الصرف', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    try {
      await currencyService.toggleActive(id, !current);
      await refresh();
    } catch (err: any) {
      addNotification(err.message || 'فشل التحديث', 'error');
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="bg-card rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
              <Coins className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">العملات والصرف</h3>
              <p className="text-xs text-muted-foreground">إدارة عملات المنشأة وأسعار الصرف</p>
            </div>
          </div>
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-muted/50 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground">العملات المسجلة</p>
            <p className="text-lg font-black text-foreground">
              {currencies.length} <span className="text-xs text-muted-foreground">/ {MAX_CURRENCIES_PER_ORG}</span>
            </p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground">أسعار صرف مسجّلة</p>
            <p className="text-lg font-black text-foreground">{rates.length}</p>
          </div>
        </div>
      </div>

      {/* Currencies list */}
      <div className="bg-card rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-foreground text-sm">العملات</h4>
          <button
            onClick={() => setShowAddCurrency(true)}
            disabled={!canAddMore}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" /> إضافة عملة
          </button>
        </div>

        {currencies.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">لا توجد عملات بعد</p>
        ) : (
          <div className="space-y-2">
            {currencies.map(c => (
              <div key={c.id} className="flex items-center justify-between bg-muted/30 rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm ${
                    c.is_base ? 'bg-amber-500 text-white' : 'bg-muted text-foreground'
                  }`}>
                    {c.symbol || c.currency_code.slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm">
                      {c.currency_name_ar}
                      {c.is_base && <span className="mr-2 text-[10px] bg-amber-500/20 text-amber-700 px-1.5 py-0.5 rounded">أساسية</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{c.currency_code}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle(c.id, c.is_active)}
                  disabled={c.is_base}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${
                    c.is_active
                      ? 'bg-success/20 text-success'
                      : 'bg-muted text-muted-foreground'
                  } disabled:opacity-50`}
                >
                  {c.is_active ? 'نشطة' : 'موقوفة'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Exchange rates */}
      <div className="bg-card rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
            <History className="w-4 h-4" /> سجل أسعار الصرف
          </h4>
          <button
            onClick={() => setShowAddRate(true)}
            disabled={activeCurrencies.length < 2}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold disabled:opacity-50"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" /> سعر صرف جديد
          </button>
        </div>

        {activeCurrencies.length < 2 && (
          <div className="flex items-center gap-2 bg-amber-500/10 text-amber-700 p-3 rounded-xl text-xs mb-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>أضف عملتين على الأقل لتسجيل أسعار الصرف</span>
          </div>
        )}

        {rates.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">لا يوجد سجل أسعار صرف</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {rates.map(r => (
              <div key={r.id} className="bg-muted/30 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 font-bold text-foreground text-sm">
                    <span>1 {r.from_currency}</span>
                    <ArrowRightLeft className="w-3 h-3 text-muted-foreground" />
                    <span>{Number(r.rate).toLocaleString()} {r.to_currency}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(r.effective_at).toLocaleDateString('ar-SY')}
                  </span>
                </div>
                {r.created_by_name && (
                  <p className="text-[10px] text-muted-foreground">بواسطة: {r.created_by_name}</p>
                )}
                {r.notes && <p className="text-xs text-muted-foreground mt-1">{r.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Currency Modal */}
      {showAddCurrency && (
        <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-md flex items-center justify-center p-6" dir="rtl">
          <div className="bg-card rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl border border-border max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-foreground">إضافة عملة</h3>
            <form onSubmit={handleAddCurrency} className="space-y-3">
              <select
                value={selectedCode}
                onChange={e => setSelectedCode(e.target.value)}
                className="w-full px-4 py-3 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-primary"
              >
                {availablePresets.map(p => (
                  <option key={p.code} value={p.code}>{p.name_ar} ({p.code})</option>
                ))}
                <option value="CUSTOM">عملة مخصصة...</option>
              </select>

              {selectedCode === 'CUSTOM' && (
                <>
                  <input
                    value={customCode}
                    onChange={e => setCustomCode(e.target.value)}
                    placeholder="الرمز (مثل: GBP)"
                    maxLength={5}
                    required
                    className="w-full px-4 py-3 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    placeholder="الاسم بالعربية"
                    required
                    className="w-full px-4 py-3 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    value={customSymbol}
                    onChange={e => setCustomSymbol(e.target.value)}
                    placeholder="الرمز المختصر (اختياري)"
                    className="w-full px-4 py-3 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-primary"
                  />
                </>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCurrency(false)}
                  className="flex-1 py-3 bg-muted text-muted-foreground rounded-xl font-bold"
                >إلغاء</button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  إضافة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Rate Modal */}
      {showAddRate && (
        <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-md flex items-center justify-center p-6" dir="rtl">
          <div className="bg-card rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl border border-border max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-foreground">سعر صرف جديد</h3>
            <form onSubmit={handleAddRate} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">من</label>
                  <select
                    value={rateFrom}
                    onChange={e => setRateFrom(e.target.value)}
                    required
                    className="w-full px-3 py-3 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">اختر</option>
                    {activeCurrencies.map(c => (
                      <option key={c.id} value={c.currency_code}>{c.currency_code}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">إلى</label>
                  <select
                    value={rateTo}
                    onChange={e => setRateTo(e.target.value)}
                    required
                    className="w-full px-3 py-3 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">اختر</option>
                    {activeCurrencies.filter(c => c.currency_code !== rateFrom).map(c => (
                      <option key={c.id} value={c.currency_code}>{c.currency_code}</option>
                    ))}
                  </select>
                </div>
              </div>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={rateValue}
                onChange={e => setRateValue(e.target.value)}
                placeholder={`السعر (1 ${rateFrom || '?'} = ? ${rateTo || '?'})`}
                required
                className="w-full px-4 py-3 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                value={rateNotes}
                onChange={e => setRateNotes(e.target.value)}
                placeholder="ملاحظات (اختياري)"
                className="w-full px-4 py-3 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddRate(false)}
                  className="flex-1 py-3 bg-muted text-muted-foreground rounded-xl font-bold"
                >إلغاء</button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CurrenciesTab;
