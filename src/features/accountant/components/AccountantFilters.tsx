import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Calendar, Filter, X } from 'lucide-react';

export interface AccountantFilterState {
  search: string;
  dateFrom: string;
  dateTo: string;
}

interface AccountantFiltersProps {
  filters: AccountantFilterState;
  onChange: (filters: AccountantFilterState) => void;
  searchPlaceholder?: string;
  showSearch?: boolean;
  showDates?: boolean;
  className?: string;
}

const AccountantFilters: React.FC<AccountantFiltersProps> = ({
  filters,
  onChange,
  searchPlaceholder,
  showSearch = true,
  showDates = true,
  className = '',
}) => {
  const { t } = useTranslation();
  const hasActiveFilters = filters.search || filters.dateFrom || filters.dateTo;

  const updateFilter = (key: keyof AccountantFilterState, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onChange({ search: '', dateFrom: '', dateTo: '' });
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {showSearch && (
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={searchPlaceholder || t('common.search')}
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="w-full bg-muted border-none rounded-xl px-10 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
          />
        </div>
      )}
      {showDates && (
        <div className="flex gap-2 items-center">
          <div className="flex-1 relative">
            <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => updateFilter('dateFrom', e.target.value)}
              className="w-full bg-muted rounded-xl px-3 py-2 text-xs font-medium text-foreground border-none"
            />
          </div>
          <span className="text-muted-foreground text-xs">→</span>
          <div className="flex-1 relative">
            <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => updateFilter('dateTo', e.target.value)}
              className="w-full bg-muted rounded-xl px-3 py-2 text-xs font-medium text-foreground border-none"
            />
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="p-2 bg-destructive/10 text-destructive rounded-xl hover:bg-destructive/20 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AccountantFilters;
