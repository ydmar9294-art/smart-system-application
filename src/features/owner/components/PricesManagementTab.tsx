import React, { useMemo, useState, useCallback } from 'react';
import { useApp } from '@/store/AppContext';
import { useAuth } from '@/store/AuthContext';
import { useCurrency } from '@/store/CurrencyContext';
import { VirtualList } from '@/components/ui/VirtualList';
import { Search, DollarSign, Save, AlertCircle, TrendingUp, CheckCircle2, Loader2 } from 'lucide-react';
import { CURRENCY } from '@/constants';
import { UserRole } from '@/types';
import type { Product, PricingCurrency } from '@/types';
import { logger } from '@/lib/logger';

/**
 * PricesManagementTab — Owner-only centralized price control.
 * Allows editing basePrice, consumerPrice, and pricingCurrency for all products.
 * Changes propagate to all warehouses automatically (DB triggers notify distributors).
 * New invoices use the new price; old invoices are unaffected.
 */

interface RowProps {
  product: Product;
  draft: { basePrice: string; consumerPrice: string; pricingCurrency: PricingCurrency } | undefined;
  onChange: (id: string, patch: Partial<{ basePrice: string; consumerPrice: string; pricingCurrency: PricingCurrency }>) => void;
  onSave: (id: string) => void;
  saving: boolean;
  saved: boolean;
}

const PriceRow: React.FC<RowProps> = React.memo(({ product, draft, onChange, onSave, saving, saved }) => {
  const cur = draft?.pricingCurrency ?? (product.pricingCurrency as PricingCurrency) ?? 'SYP';
  const baseVal = draft?.basePrice ?? String(product.basePrice ?? 0);
  const consumerVal = draft?.consumerPrice ?? String(product.consumerPrice ?? 0);
  const curSymbol = cur === 'USD' ? '$' : CURRENCY;
  const isDirty = !!draft;

  return (
    <div className={`bg-card p-3 rounded-2xl border shadow-sm transition-colors ${isDirty ? 'border-primary/40 bg-primary/5' : 'border-border'}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <p className="font-black text-foreground text-sm truncate">{product.name}</p>
          <p className="text-[10px] text-muted-foreground font-bold truncate">{product.category} · {product.unit}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {(['SYP', 'USD'] as const).map(c => (
            <button
              key={c}
              type="button"
              onClick={() => onChange(product.id, { pricingCurrency: c })}
              className={`px-2 py-1 text-[10px] font-black rounded-lg transition-all ${
                cur === c ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {c === 'SYP' ? 'ل.س' : '$'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-black text-muted-foreground block mb-1">سعر البيع ({curSymbol})</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={baseVal}
            onChange={(e) => onChange(product.id, { basePrice: e.target.value })}
            className="w-full px-3 py-2 bg-muted rounded-xl text-foreground font-black text-sm text-center outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="text-[10px] font-black text-muted-foreground block mb-1">سعر المستهلك ({curSymbol})</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={consumerVal}
            onChange={(e) => onChange(product.id, { consumerPrice: e.target.value })}
            className="w-full px-3 py-2 bg-muted rounded-xl text-foreground font-black text-sm text-center outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {isDirty && (
        <button
          type="button"
          onClick={() => onSave(product.id)}
          disabled={saving}
          className="mt-2 w-full py-2 bg-primary text-primary-foreground rounded-xl font-black text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'جارٍ الحفظ...' : 'حفظ'}
        </button>
      )}
      {saved && !isDirty && (
        <p className="mt-2 text-[10px] font-black text-success flex items-center gap-1">
          <CheckCircle2 size={12} /> تم الحفظ
        </p>
      )}
    </div>
  );
});
PriceRow.displayName = 'PriceRow';

const PricesManagementTab: React.FC = () => {
  const { products = [], updateProduct } = useApp();
  const { role } = useAuth();
  const { usdRate } = useCurrency();

  const isOwner = role === UserRole.OWNER || role === UserRole.DEVELOPER;

  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState<Record<string, { basePrice: string; consumerPrice: string; pricingCurrency: PricingCurrency }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim();
    const list = products.filter(p => !p.isDeleted);
    if (!q) return list;
    return list.filter(p => p.name.includes(q) || p.category?.includes(q));
  }, [products, search]);

  const handleChange = useCallback((id: string, patch: Partial<{ basePrice: string; consumerPrice: string; pricingCurrency: PricingCurrency }>) => {
    setDrafts(prev => {
      const product = products.find(p => p.id === id);
      if (!product) return prev;
      const existing = prev[id] ?? {
        basePrice: String(product.basePrice ?? 0),
        consumerPrice: String(product.consumerPrice ?? 0),
        pricingCurrency: (product.pricingCurrency as PricingCurrency) ?? 'SYP',
      };
      return { ...prev, [id]: { ...existing, ...patch } };
    });
  }, [products]);

  const handleSave = useCallback(async (id: string) => {
    const product = products.find(p => p.id === id);
    const draft = drafts[id];
    if (!product || !draft) return;
    setSavingId(id);
    try {
      await updateProduct({
        ...product,
        basePrice: Number(draft.basePrice) || 0,
        consumerPrice: Number(draft.consumerPrice) || 0,
        pricingCurrency: draft.pricingCurrency,
      });
      setDrafts(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setSavedIds(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      setTimeout(() => {
        setSavedIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 2500);
    } catch (err) {
      logger.error('Price update failed', 'PricesManagementTab', { error: String(err) });
    } finally {
      setSavingId(null);
    }
  }, [products, drafts, updateProduct]);

  if (!isOwner) {
    return (
      <div className="bg-warning/10 p-6 rounded-2xl border border-warning/20 text-center">
        <AlertCircle size={32} className="mx-auto text-warning mb-2" />
        <p className="font-black text-foreground">تعديل الأسعار متاح للإدارة فقط</p>
      </div>
    );
  }

  const dirtyCount = Object.keys(drafts).length;
  const useVirtual = filtered.length > 30;

  return (
    <div className="space-y-3">
      {/* Header banner */}
      <div className="bg-primary/10 p-4 rounded-2xl border border-primary/20">
        <div className="flex items-start gap-3">
          <DollarSign size={22} className="text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-black text-foreground text-sm">التحكم بأسعار المواد</p>
            <p className="text-[11px] text-muted-foreground font-bold mt-1 leading-relaxed">
              تنطبق التغييرات على المخزن الرئيسي ومخازن الموزعين فوراً. الفواتير الجديدة فقط تستخدم السعر الجديد، ويتم إشعار الموزعين تلقائياً.
            </p>
            {usdRate > 0 && (
              <p className="text-[10px] text-primary font-black mt-2 flex items-center gap-1">
                <TrendingUp size={11} /> سعر صرف الدولار الحالي: {usdRate.toLocaleString()} {CURRENCY}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث عن منتج..."
          className="input-field pr-10"
        />
      </div>

      {/* Dirty badge */}
      {dirtyCount > 0 && (
        <div className="bg-warning/10 px-4 py-2 rounded-xl border border-warning/20 flex items-center justify-between">
          <span className="text-xs font-black text-warning">{dirtyCount} منتج قيد التعديل</span>
          <button
            type="button"
            onClick={() => setDrafts({})}
            className="text-[10px] font-black text-muted-foreground hover:text-destructive"
          >
            تجاهل التغييرات
          </button>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-card p-8 rounded-3xl border text-center">
          <DollarSign size={40} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-bold text-sm">لا توجد منتجات</p>
        </div>
      ) : useVirtual ? (
        <div style={{ height: 'calc(100vh - 360px)', minHeight: 400 }}>
          <VirtualList<Product>
            items={filtered}
            itemHeight={150}
            overscan={4}
            containerHeight="100%"
            renderItem={(p) => (
              <div className="pb-2">
                <PriceRow
                  product={p}
                  draft={drafts[p.id]}
                  onChange={handleChange}
                  onSave={handleSave}
                  saving={savingId === p.id}
                  saved={savedIds.has(p.id)}
                />
              </div>
            )}
          />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <PriceRow
              key={p.id}
              product={p}
              draft={drafts[p.id]}
              onChange={handleChange}
              onSave={handleSave}
              saving={savingId === p.id}
              saved={savedIds.has(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PricesManagementTab;
