import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Phone,
  ChevronDown,
  FileText,
  Calendar
} from 'lucide-react';
import { useApp } from '@/store/AppContext';

interface CustomerDebtsTabProps {
  selectedCustomer: import('@/types').Customer | null;
  myCustomers: import('@/types').Customer[];
}

const CustomerDebtsTab: React.FC<CustomerDebtsTabProps> = ({ selectedCustomer, myCustomers }) => {
  const { sales } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'balance' | 'name'>('balance');

  // Filter and sort customers with debt
  const debtCustomers = myCustomers
    .filter(c => Number(c.balance) > 0)
    .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'balance') {
        return Number(b.balance) - Number(a.balance);
      }
      return a.name.localeCompare(b.name, 'ar');
    });

  const totalDebt = debtCustomers.reduce((sum, c) => sum + Number(c.balance), 0);
  const customerSales = sales.filter(s => s.customer_id === selectedCustomerId && !s.isVoided);

  return (
    <div className="p-5 space-y-5">
      {/* Summary Card */}
      <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white">
        <p className="text-emerald-100 text-sm mb-1">إجمالي الذمم الميدانية:</p>
        <p className="text-3xl font-black">
          {totalDebt.toLocaleString('ar-SA')} ل.س
        </p>
        <p className="text-emerald-200 text-xs mt-2">
          {debtCustomers.length} زبون لديهم ذمم
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="بحث عن زبون..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-gray-50 border-none rounded-2xl px-12 py-4 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      {/* Customer List */}
      {debtCustomers.length === 0 ? (
        <div className="bg-gray-50 rounded-3xl p-8 text-center">
          <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-400 font-bold">لا يوجد زبائن بذمم مستحقة</p>
        </div>
      ) : (
        <div className="space-y-3">
          {debtCustomers.map((customer) => (
            <div 
              key={customer.id}
              className="bg-gray-50 rounded-2xl p-4 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => setSelectedCustomerId(
                selectedCustomerId === customer.id ? null : customer.id
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <span className="text-lg font-black text-red-500">
                      {customer.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">{customer.name}</p>
                    {customer.phone && (
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        {customer.phone}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-end">
                  <p className="text-xl font-black text-emerald-600">
                    {Number(customer.balance).toLocaleString('ar-SA')}
                  </p>
                  <p className="text-xs text-gray-400">ل.س</p>
                  <p className="text-[10px] text-gray-400">انقر للتحديث</p>
                </div>
              </div>

              {/* Expanded Details */}
              {selectedCustomerId === customer.id && customerSales.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                  <p className="text-sm font-bold text-gray-500 mb-2">الفواتير المستحقة</p>
                  {customerSales
                    .filter(s => Number(s.remaining) > 0)
                    .slice(0, 5)
                    .map((sale) => (
                      <div 
                        key={sale.id}
                        className="flex items-center justify-between bg-white rounded-xl p-3"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(sale.timestamp).toLocaleDateString('ar-SA')}
                          </p>
                        </div>
                        <div className="text-end">
                          <p className="font-bold text-orange-500">
                            {Number(sale.remaining).toLocaleString('ar-SA')} ل.س
                          </p>
                          <p className="text-xs text-gray-400">
                            من {Number(sale.grandTotal).toLocaleString('ar-SA')}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerDebtsTab;
