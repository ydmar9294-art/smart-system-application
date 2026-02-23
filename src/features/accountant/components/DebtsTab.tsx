import React, { useState } from 'react';
import { Users, Search, Phone, TrendingDown } from 'lucide-react';
import { useApp } from '@/store/AppContext';

const DebtsTab: React.FC = () => {
  const { customers } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'balance' | 'name'>('balance');

  const debtCustomers = customers
    .filter(c => Number(c.balance) > 0)
    .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => sortBy === 'balance' ? Number(b.balance) - Number(a.balance) : a.name.localeCompare(b.name, 'ar'));

  const totalDebt = debtCustomers.reduce((sum, c) => sum + Number(c.balance), 0);

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="bg-gradient-to-br from-red-500 to-red-600 p-5 rounded-2xl text-white shadow-lg text-center">
        <TrendingDown className="w-8 h-8 mx-auto mb-2 opacity-80" />
        <p className="text-xs opacity-80 mb-1">إجمالي ديون العملاء</p>
        <p className="text-3xl font-black">{totalDebt.toLocaleString('ar-SA')} ل.س</p>
        <p className="text-xs opacity-70 mt-2">{debtCustomers.length} عميل لديهم ديون مستحقة</p>
      </div>

      {/* Search & Sort */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="بحث عن عميل..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-muted border-none rounded-xl px-10 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground" />
        </div>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
          className="bg-muted rounded-xl px-3 py-2.5 text-sm font-bold text-foreground border-none">
          <option value="balance">الأعلى ديناً</option>
          <option value="name">الاسم</option>
        </select>
      </div>

      {/* Debt Cards */}
      {debtCustomers.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-bold">لا يوجد عملاء بديون مستحقة</p>
        </div>
      ) : (
        <div className="space-y-2">
          {debtCustomers.map((customer) => (
            <div key={customer.id} className="bg-card p-4 rounded-2xl shadow-sm flex items-center justify-between">
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
                <p className="font-black text-lg text-red-500">{Number(customer.balance).toLocaleString('ar-SA')}</p>
                <p className="text-[10px] text-muted-foreground">ل.س</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DebtsTab;