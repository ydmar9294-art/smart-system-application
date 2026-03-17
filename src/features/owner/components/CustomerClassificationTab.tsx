/**
 * CustomerClassificationTab — ABC classification management
 * For Owner and Sales Manager dashboards
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/store/AuthContext';
import { useApp } from '@/store/AppContext';
import { Users, RefreshCw, Loader2, BarChart3, Calendar, Crown, Star, Circle } from 'lucide-react';
import { CURRENCY } from '@/constants';

interface ClassifiedCustomer {
  id: string;
  name: string;
  phone: string | null;
  balance: number;
  classification: string;
}

const CustomerClassificationTab: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { user } = useAuth();
  const { addNotification } = useApp();
  const queryClient = useQueryClient();
  const [isClassifying, setIsClassifying] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['classified-customers'],
    queryFn: async (): Promise<ClassifiedCustomer[]> => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, phone, balance, classification')
        .order('classification', { ascending: true })
        .order('balance', { ascending: false });
      if (error) throw error;
      return (data || []) as ClassifiedCustomer[];
    },
    staleTime: 60_000,
  });

  const handleClassify = async () => {
    setIsClassifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('classify-customers', {
        body: { generate_visits: true },
      });
      if (error) throw error;
      addNotification(
        `${t('classification.classified')}: A=${data.a_count}, B=${data.b_count}, C=${data.c_count}. ${t('classification.visitsCreated')}: ${data.visits_created}`,
        'success'
      );
      queryClient.invalidateQueries({ queryKey: ['classified-customers'] });
      queryClient.invalidateQueries({ queryKey: ['visit-plans'] });
    } catch (err: any) {
      addNotification(err.message || t('common.error'), 'error');
    } finally {
      setIsClassifying(false);
    }
  };

  const filtered = filter === 'all' ? customers : customers.filter(c => c.classification === filter);

  const counts = {
    A: customers.filter(c => c.classification === 'A').length,
    B: customers.filter(c => c.classification === 'B').length,
    C: customers.filter(c => c.classification === 'C').length,
  };

  const getClassBadge = (cls: string) => {
    switch (cls) {
      case 'A': return (
        <span className="bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-lg text-[10px] font-black flex items-center gap-1">
          <Crown className="w-3 h-3" /> A
        </span>
      );
      case 'B': return (
        <span className="bg-blue-500/15 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-lg text-[10px] font-black flex items-center gap-1">
          <Star className="w-3 h-3" /> B
        </span>
      );
      default: return (
        <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-lg text-[10px] font-black flex items-center gap-1">
          <Circle className="w-3 h-3" /> C
        </span>
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Button */}
      <button
        onClick={handleClassify}
        disabled={isClassifying}
        className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all disabled:opacity-50"
      >
        {isClassifying ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <BarChart3 className="w-5 h-5" />
        )}
        {t('classification.runClassification')}
      </button>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        {(['A', 'B', 'C'] as const).map((cls) => (
          <button
            key={cls}
            onClick={() => setFilter(filter === cls ? 'all' : cls)}
            className={`rounded-2xl p-3 text-center transition-all ${
              filter === cls ? 'ring-2 ring-primary shadow-md' : ''
            } ${
              cls === 'A' ? 'bg-amber-500/10' : cls === 'B' ? 'bg-blue-500/10' : 'bg-muted'
            }`}
          >
            <p className={`text-xl font-black ${
              cls === 'A' ? 'text-amber-600 dark:text-amber-400' :
              cls === 'B' ? 'text-blue-600 dark:text-blue-400' :
              'text-muted-foreground'
            }`}>{counts[cls]}</p>
            <p className="text-[10px] font-bold text-muted-foreground">
              {t(`classification.class${cls}`)}
            </p>
          </button>
        ))}
      </div>

      {/* Customer List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-2xl p-8 text-center shadow-sm">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-30" />
          <p className="text-muted-foreground font-medium text-sm">{t('common.noData')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((customer) => (
            <div key={customer.id} className="bg-card rounded-2xl p-4 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-lg font-black text-muted-foreground">
                {customer.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-foreground text-sm truncate">{customer.name}</p>
                  {getClassBadge(customer.classification)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('common.balance')}: {Number(customer.balance).toLocaleString()} {CURRENCY}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerClassificationTab;
