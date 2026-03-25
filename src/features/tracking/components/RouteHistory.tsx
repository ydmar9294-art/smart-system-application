import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { History, Users, Calendar, ChevronDown, ChevronUp, MapPin, Check, ShoppingBag, SkipForward, Clock as ClockIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/store/AuthContext';

interface RouteWithStops {
  id: string;
  name: string | null;
  week_start: string;
  created_at: string;
  distributor_name: string;
  distributor_id: string;
  stops: {
    id: string;
    customer_name: string;
    status: string;
    planned_date: string;
    visited_at: string | null;
    notes: string | null;
    sequence_order: number;
  }[];
}

const RouteHistory: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { organization } = useAuth();
  const [selectedDistributor, setSelectedDistributor] = useState<string>('all');
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);

  // Fetch field agents
  const { data: distributors = [] } = useQuery({
    queryKey: ['field-agents-history', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('organization_id', organization.id)
        .eq('employee_type', 'FIELD_AGENT')
        .eq('is_active', true);
      return data || [];
    },
    enabled: !!organization?.id,
  });

  // Fetch routes with stops
  const { data: routes = [], isLoading } = useQuery({
    queryKey: ['route-history', organization?.id, selectedDistributor],
    queryFn: async () => {
      if (!organization?.id) return [];

      let query = supabase
        .from('routes')
        .select('id, name, week_start, created_at, distributor_id')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (selectedDistributor !== 'all') {
        query = query.eq('distributor_id', selectedDistributor);
      }

      const { data: routesData, error } = await query;
      if (error || !routesData) return [];

      // Fetch stops for these routes
      const routeIds = routesData.map(r => r.id);
      if (routeIds.length === 0) return [];

      const { data: stopsData } = await supabase
        .from('route_stops')
        .select('id, route_id, customer_name, status, planned_date, visited_at, notes, sequence_order')
        .in('route_id', routeIds)
        .order('sequence_order');

      const stopsMap = new Map<string, typeof stopsData>();
      for (const stop of (stopsData || [])) {
        const arr = stopsMap.get(stop.route_id) || [];
        arr.push(stop);
        stopsMap.set(stop.route_id, arr);
      }

      return routesData.map(route => {
        const dist = distributors.find(d => d.id === route.distributor_id);
        return {
          ...route,
          distributor_name: dist?.full_name || t('tracking.unknownAgent'),
          stops: (stopsMap.get(route.id) || []) as RouteWithStops['stops'],
        };
      }) as RouteWithStops[];
    },
    enabled: !!organization?.id,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sold': return <ShoppingBag className="w-3 h-3 text-emerald-600" />;
      case 'visited': return <Check className="w-3 h-3 text-blue-600" />;
      case 'skipped': return <SkipForward className="w-3 h-3 text-red-500" />;
      default: return <ClockIcon className="w-3 h-3 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'sold': return t('tracking.statusSold');
      case 'visited': return t('tracking.statusVisited');
      case 'skipped': return t('tracking.statusSkipped');
      default: return t('tracking.statusPending');
    }
  };

  const getRouteStats = (stops: RouteWithStops['stops']) => {
    const total = stops.length;
    const sold = stops.filter(s => s.status === 'sold').length;
    const visited = stops.filter(s => s.status === 'visited').length;
    const skipped = stops.filter(s => s.status === 'skipped').length;
    const pending = stops.filter(s => s.status === 'pending').length;
    const completionRate = total > 0 ? Math.round(((sold + visited) / total) * 100) : 0;
    return { total, sold, visited, skipped, pending, completionRate };
  };

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-foreground flex items-center gap-2">
        <History className="w-5 h-5 text-purple-600" />
        {t('tracking.routeHistory')}
      </h2>

      {/* Distributor filter */}
      <div className="bg-card p-3 rounded-2xl shadow-sm">
        <label className="text-xs font-bold text-muted-foreground flex items-center gap-1 mb-2">
          <Users className="w-3.5 h-3.5" /> {t('tracking.filterByDistributor')}
        </label>
        <select
          value={selectedDistributor}
          onChange={e => setSelectedDistributor(e.target.value)}
          className="w-full px-4 py-3 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-primary text-sm"
        >
          <option value="all">{t('common.all')}</option>
          {distributors.map(d => (
            <option key={d.id} value={d.id}>{d.full_name}</option>
          ))}
        </select>
      </div>

      {/* Routes list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-card p-4 rounded-2xl shadow-sm animate-pulse h-24" />
          ))}
        </div>
      ) : routes.length === 0 ? (
        <div className="bg-card p-8 rounded-3xl text-center">
          <History className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-40" />
          <p className="font-bold text-foreground mb-1">{t('tracking.noRouteHistory')}</p>
        </div>
      ) : (
        routes.map(route => {
          const stats = getRouteStats(route.stops);
          const isExpanded = expandedRoute === route.id;
          return (
            <div key={route.id} className="bg-card rounded-2xl shadow-sm overflow-hidden border border-border">
              <button
                onClick={() => setExpandedRoute(isExpanded ? null : route.id)}
                className="w-full p-4 text-start"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-purple-600" />
                    <span className="font-bold text-foreground text-sm">
                      {route.name || `${t('tracking.routesTab')} — ${new Date(route.week_start + 'T00:00:00').toLocaleDateString(isRtl ? 'ar-SY' : 'en-US', { month: 'short', day: 'numeric' })}`}
                    </span>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <Users className="w-3 h-3" />
                  <span>{route.distributor_name}</span>
                  <span>•</span>
                  <Calendar className="w-3 h-3" />
                  <span>{new Date(route.created_at).toLocaleDateString(isRtl ? 'ar-SY' : 'en-US')}</span>
                </div>

                {/* Stats bar */}
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-lg font-bold">{stats.sold} {t('tracking.soldStops')}</span>
                  <span className="bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-lg font-bold">{stats.visited} {t('tracking.statusVisited')}</span>
                  <span className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded-lg font-bold">{stats.skipped} {t('tracking.statusSkipped')}</span>
                  <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-lg font-bold">{stats.completionRate}%</span>
                </div>
              </button>

              {/* Expanded stops */}
              {isExpanded && (
                <div className="border-t border-border px-4 pb-4 pt-2 space-y-2">
                  {route.stops.map((stop, idx) => (
                    <div key={stop.id} className="flex items-center gap-3 py-2">
                      <div className="w-6 h-6 bg-muted rounded-lg flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{stop.customer_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(stop.planned_date + 'T00:00:00').toLocaleDateString(isRtl ? 'ar-SY' : 'en-US', { weekday: 'short', day: 'numeric' })}
                          </span>
                          {stop.visited_at && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <ClockIcon className="w-2.5 h-2.5" />
                              {new Date(stop.visited_at).toLocaleTimeString(isRtl ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        {stop.notes && (
                          <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{stop.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(stop.status)}
                        <span className="text-[10px] font-bold text-muted-foreground">{getStatusLabel(stop.status)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default RouteHistory;
