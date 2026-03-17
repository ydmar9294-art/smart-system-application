/**
 * RouteTrackingTab — View distributor visit locations
 * For Owner and Sales Manager dashboards
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/store/AuthContext';
import { MapPin, Clock, User, Loader2, Filter, Navigation } from 'lucide-react';

interface LocationEntry {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  visit_type: string;
  customer_id: string | null;
  notes: string | null;
  recorded_at: string;
}

interface DistributorProfile {
  id: string;
  full_name: string | null;
}

const RouteTrackingTab: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { organization } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDistributor, setSelectedDistributor] = useState<string>('all');

  // Get distributors
  const { data: distributors = [] } = useQuery({
    queryKey: ['distributors-list', organization?.id],
    queryFn: async (): Promise<DistributorProfile[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('organization_id', organization?.id)
        .eq('role', 'EMPLOYEE')
        .eq('employee_type', 'FIELD_AGENT')
        .eq('is_active', true);
      if (error) throw error;
      return (data || []) as DistributorProfile[];
    },
    enabled: !!organization?.id,
  });

  // Get locations
  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['distributor-locations', organization?.id, selectedDate, selectedDistributor],
    queryFn: async (): Promise<LocationEntry[]> => {
      let query = supabase
        .from('distributor_locations')
        .select('id, user_id, latitude, longitude, accuracy, visit_type, customer_id, notes, recorded_at')
        .eq('organization_id', organization?.id)
        .gte('recorded_at', `${selectedDate}T00:00:00`)
        .lt('recorded_at', `${selectedDate}T23:59:59`)
        .order('recorded_at', { ascending: true });

      if (selectedDistributor !== 'all') {
        query = query.eq('user_id', selectedDistributor);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as LocationEntry[];
    },
    enabled: !!organization?.id,
    staleTime: 30_000,
  });

  const getVisitTypeLabel = (type: string) => {
    switch (type) {
      case 'customer_visit': return t('routes.customerVisit');
      case 'check_in': return t('routes.checkIn');
      default: return t('routes.routePoint');
    }
  };

  const getDistributorName = (userId: string) => {
    return distributors.find(d => d.id === userId)?.full_name || t('common.unknown');
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-card rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-bold text-foreground">{t('routes.filters')}</span>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full px-3 py-2 bg-muted rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
        />
        <select
          value={selectedDistributor}
          onChange={(e) => setSelectedDistributor(e.target.value)}
          className="w-full px-3 py-2 bg-muted rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="all">{t('routes.allDistributors')}</option>
          {distributors.map(d => (
            <option key={d.id} value={d.id}>{d.full_name || d.id.substring(0, 8)}</option>
          ))}
        </select>
      </div>

      {/* Summary */}
      <div className="bg-card rounded-2xl p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-500/10 rounded-xl p-3 text-center">
            <p className="text-xl font-black text-blue-600 dark:text-blue-400">{locations.length}</p>
            <p className="text-[10px] text-muted-foreground font-bold">{t('routes.totalPoints')}</p>
          </div>
          <div className="bg-emerald-500/10 rounded-xl p-3 text-center">
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              {locations.filter(l => l.visit_type === 'customer_visit').length}
            </p>
            <p className="text-[10px] text-muted-foreground font-bold">{t('routes.customerVisits')}</p>
          </div>
        </div>
      </div>

      {/* Location List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : locations.length === 0 ? (
        <div className="bg-card rounded-2xl p-8 text-center shadow-sm">
          <Navigation className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-30" />
          <p className="text-muted-foreground font-medium text-sm">{t('routes.noLocations')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {locations.map((loc) => (
            <div key={loc.id} className="bg-card rounded-2xl p-3 shadow-sm flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mt-0.5 ${
                loc.visit_type === 'customer_visit' ? 'bg-emerald-500/10 text-emerald-500' :
                loc.visit_type === 'check_in' ? 'bg-blue-500/10 text-blue-500' :
                'bg-muted text-muted-foreground'
              }`}>
                <MapPin className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-foreground">{getVisitTypeLabel(loc.visit_type)}</span>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {new Date(loc.recorded_at).toLocaleTimeString(isRtl ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {selectedDistributor === 'all' && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <User className="w-3 h-3" /> {getDistributorName(loc.user_id)}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground">
                  📍 {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                  {loc.accuracy && ` (±${Math.round(loc.accuracy)}m)`}
                </p>
                {loc.notes && <p className="text-[10px] text-muted-foreground mt-1">📝 {loc.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RouteTrackingTab;
