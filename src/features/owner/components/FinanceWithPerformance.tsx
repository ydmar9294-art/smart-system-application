import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { FinanceTab } from './FinanceTab';
import { PerformanceTab } from './PerformanceTab';

const FinanceWithPerformance: React.FC = () => {
  const { t } = useTranslation();
  const [view, setView] = useState<'finance' | 'performance'>('finance');

  return (
    <div className="space-y-3">
      {/* Inner segmented control */}
      <div
        className="flex p-1 rounded-2xl gap-1"
        style={{
          background: 'var(--card-glass-bg)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid var(--card-glass-border)',
        }}
        data-guest-nav
      >
        <button
          onClick={() => setView('finance')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
            view === 'finance'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-muted-foreground'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          {t('owner.tabs.finance')}
        </button>
        <button
          onClick={() => setView('performance')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
            view === 'performance'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-muted-foreground'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          {t('owner.tabs.performance')}
        </button>
      </div>

      <div className="animate-fade-in">
        {view === 'finance' ? <FinanceTab /> : <PerformanceTab />}
      </div>
    </div>
  );
};

export default FinanceWithPerformance;
