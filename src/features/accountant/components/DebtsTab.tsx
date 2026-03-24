import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Search, Phone, TrendingDown, FileText } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { CURRENCY } from '@/constants';
import CustomerStatement from './CustomerStatement';

const DebtsTab: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
  const { customers } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'balance' | 'name'>('balance');
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(null);

  const debtCustomers = customers
    .filter(c => Number(c.balance) > 0)
    .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => sortBy === 'balance' ? Number(b.balance) - Number(a.balance) : a.name.localeCompare(b.name, i18n.language));

  const totalDebt = debtCustomers.reduce((sum, c) => sum + Number(c.balance), 0);

  return (
    <div className="space-y-3">
      <div className="bg-gradient-to-br from-red-500 to-red-600 p-5 rounded-2xl text-white shadow-lg text-center">
        <TrendingDown className="w-8 h-8 mx-auto mb-2 opacity-80" />
        <p className="text-xs opacity-80 mb-1">{t('accountant.totalCustomerDebts')}</p>
        <p className="text-3xl font-black">{totalDebt.toLocaleString(locale)} {CURRENCY}</p>
        <p className="text-xs opacity-70 mt-2">{debtCustomers.length} {t('accountant.customersWithDebts')}</p>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder={t('accountant.searchCustomer')} value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-muted border-none rounded-xl px-10 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground" />
        </div>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
          className="bg-muted rounded-xl px-3 py-2.5 text-sm font-bold text-foreground border-none">
          <option value="balance">{t('accountant.sortByDebt')}</option>
          <option value="name">{t('accountant.sortByName')}</option>
        </select>
      </div>

      {debtCustomers.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-bold">{t('accountant.noDebts')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {debtCustomers.map((customer) => (
            <div key={customer.id} className="bg-card p-4 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
                    <span className="font-black text-red-500">{customer.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{customer.name}</p>
                    {customer.phone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {customer.phone}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-left">
                  <p className="font-black text-lg text-red-500">{Number(customer.balance).toLocaleString(locale)}</p>
                  <p className="text-[10px] text-muted-foreground">{CURRENCY}</p>
                </div>
              </div>
              {/* View Statement Button */}
              <button
                onClick={() => setSelectedCustomer({ id: customer.id, name: customer.name })}
                className="w-full mt-2 flex items-center justify-center gap-2 py-2 bg-muted rounded-xl text-xs font-bold text-primary hover:bg-primary/10 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                {t('accountant.viewStatement')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Customer Statement Modal */}
      {selectedCustomer && (
        <CustomerStatement
          customerId={selectedCustomer.id}
          customerName={selectedCustomer.name}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  );
};

export default DebtsTab;
