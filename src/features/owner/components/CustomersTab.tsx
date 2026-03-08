import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Users, Phone, MapPin, CircleDollarSign, Wallet, 
  Search, ArrowUpDown, Info
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { CURRENCY } from '@/constants';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { VirtualList } from '@/components/ui/VirtualList';

const CustomersTab: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
  const { customers = [], payments = [], sales = [] } = useApp();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'balance'>('balance');

  const safeCustomers = useMemo(() => {
    return customers.map(c => ({ ...c, balance: Math.max(0, c.balance) }));
  }, [customers]);

  const filtered = useMemo(() => {
    let list = [...safeCustomers];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.location?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (sortBy === 'balance') return b.balance - a.balance;
      return a.name.localeCompare(b.name, i18n.language);
    });
    return list;
  }, [safeCustomers, search, sortBy, i18n.language]);

  const totalBalances = safeCustomers.reduce((s, c) => s + c.balance, 0);
  const totalCollections = payments.filter(p => !p.isReversed).reduce((s, p) => s + p.amount, 0);
  const netDebt = Math.max(0, totalBalances);
  const debtorCount = safeCustomers.filter(c => c.balance > 0).length;

  const getStatusLabel = (balance: number) => {
    if (balance > 0) return { text: t('ownerCustomers.hasDebt'), color: 'bg-destructive/10 text-destructive' };
    return { text: t('ownerCustomers.noDebt'), color: 'bg-success/10 text-success' };
  };

  const renderCustomerCard = (c: typeof safeCustomers[0]) => {
    const status = getStatusLabel(c.balance);
    return (
      <div className={`bg-card p-4 rounded-2xl shadow-sm ${c.balance > 0 ? 'border-r-4 border-destructive' : ''}`}>
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.balance > 0 ? 'bg-destructive/10' : 'bg-success/10'}`}>
              <CircleDollarSign className={`w-5 h-5 ${c.balance > 0 ? 'text-destructive' : 'text-success'}`} />
            </div>
            <div>
              <p className={`font-bold ${c.balance > 0 ? 'text-destructive' : 'text-foreground'}`}>{c.name}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status.color}`}>
                {status.text}
              </span>
            </div>
          </div>
          <div className="text-end">
            <p className={`font-black text-lg ${c.balance > 0 ? 'text-destructive' : 'text-success'}`}>{c.balance.toLocaleString(locale)}</p>
            <p className="text-[10px] text-muted-foreground">{CURRENCY}</p>
          </div>
        </div>
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
  };

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Summary Card */}
      <div className="bg-gradient-to-br from-destructive to-destructive/80 p-6 rounded-3xl text-destructive-foreground shadow-lg">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <p className="text-xs opacity-80">{t('ownerCustomers.totalDebts')}</p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3.5 h-3.5 opacity-60 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs">{t('ownerCustomers.totalDebtsTooltip')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-3xl font-black">{netDebt.toLocaleString(locale)} {CURRENCY}</p>
          </div>
          <div className="text-end">
            <p className="text-xs opacity-80 mb-1">{t('ownerCustomers.customersWithDebts')}</p>
            <p className="text-2xl font-black">{debtorCount}</p>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-destructive-foreground/20 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="opacity-80">{t('ownerCustomers.totalCollections')}</span>
            <span className="font-bold">{totalCollections.toLocaleString(locale)} {CURRENCY}</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-80">{t('ownerCustomers.totalCustomers')}</span>
            <span className="font-bold">{safeCustomers.length}</span>
          </div>
        </div>
      </div>

      {/* Search & Sort */}
      {safeCustomers.length > 0 && (
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('ownerCustomers.searchPlaceholder')}
              className="w-full ps-9 pe-3 py-2.5 bg-card text-foreground rounded-xl border border-border text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <button onClick={() => setSortBy(prev => prev === 'balance' ? 'name' : 'balance')}
            className="px-3 py-2.5 bg-card rounded-xl border border-border text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
            <ArrowUpDown className="w-4 h-4" />
            <span className="text-[10px] font-bold">{sortBy === 'balance' ? t('ownerCustomers.debt') : t('ownerCustomers.nameSort')}</span>
          </button>
        </div>
      )}

      {/* Customer List */}
      {safeCustomers.length === 0 ? (
        <div className="bg-card p-8 rounded-3xl text-center">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground font-medium">{t('ownerCustomers.noCustomers')}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card p-8 rounded-3xl text-center">
          <Search className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium text-sm">{t('ownerCustomers.noSearchResults')}</p>
        </div>
      ) : filtered.length > 50 ? (
        <VirtualList
          items={filtered}
          itemHeight={120}
          containerHeight={400}
          className="rounded-2xl"
          renderItem={(c) => <div className="mx-1">{renderCustomerCard(c)}</div>}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(c => <div key={c.id}>{renderCustomerCard(c)}</div>)}
        </div>
      )}

      {/* Collections History */}
      {payments.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2 px-2 mt-4">
            <Wallet className="w-4 h-4 text-success" /> {t('ownerCustomers.collectionsHistory')}
          </h3>
          {payments.filter(p => !p.isReversed).slice(0, 10).map(p => {
            const sale = sales.find(s => s.id === p.saleId);
            return (
              <div key={p.id} className="bg-card p-3 rounded-2xl shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-success" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm">{sale?.customerName || t('common.unspecified')}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(p.timestamp).toLocaleDateString(locale)}</p>
                  </div>
                </div>
                <p className="font-black text-success">{p.amount.toLocaleString(locale)} {CURRENCY}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CustomersTab;