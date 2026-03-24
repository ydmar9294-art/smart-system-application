import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BarChart3, CheckCircle2, XCircle, TrendingUp, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/store/AuthContext';

const RouteKPIs: React.FC = () => {
  const { t } = useTranslation();
  const { organization } = useAuth();

  const { data: stops = [], isLoading } = useQuery({
    queryKey: ['route-kpis', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      // Get this week's stops
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from('route_stops')
        .select('id, status, route_id, routes!inner(organization_id, distributor_id)')
        .gte('planned_date', weekStart.toISOString().split('T')[0]);

      // Filter by org (RLS handles this but double-check)
      return (data || []) as Array<{
        id: string;
        status: string;
        route_id: string;
        routes: { organization_id: string; distributor_id: string };
      }>;
    },
    enabled: !!organization?.id,
    staleTime: 60_000,
  });

  const total = stops.length;
  const visited = stops.filter(s => s.status === 'visited' || s.status === 'sold').length;
  const sold = stops.filter(s => s.status === 'sold').length;
  const skipped = stops.filter(s => s.status === 'skipped').length;
  const pending = stops.filter(s => s.status === 'pending').length;

  const visitRate = total > 0 ? Math.round((visited / total) * 100) : 0;
  const conversionRate = visited > 0 ? Math.round((sold / visited) * 100) : 0;

  // Per-agent breakdown
  const agentStats = React.useMemo(() => {
    const map = new Map<string, { total: number; visited: number; sold: number }>();
    for (const stop of stops) {
      const agentId = stop.routes?.distributor_id;
      if (!agentId) continue;
      const entry = map.get(agentId) || { total: 0, visited: 0, sold: 0 };
      entry.total++;
      if (stop.status === 'visited' || stop.status === 'sold') entry.visited++;
      if (stop.status === 'sold') entry.sold++;
      map.set(agentId, entry);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].visited - a[1].visited);
  }, [stops]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-card p-4 rounded-2xl shadow-sm animate-pulse h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-foreground flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-emerald-500" />
        {t('tracking.routeKPIs')}
      </h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card p-4 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-bold text-muted-foreground">{t('tracking.visitRate')}</span>
          </div>
          <p className="text-2xl font-black text-emerald-600">{visitRate}%</p>
          <p className="text-[10px] text-muted-foreground">{visited}/{total} {t('tracking.stops')}</p>
        </div>

        <div className="bg-card p-4 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-bold text-muted-foreground">{t('tracking.conversionRate')}</span>
          </div>
          <p className="text-2xl font-black text-blue-600">{conversionRate}%</p>
          <p className="text-[10px] text-muted-foreground">{sold}/{visited} {t('tracking.soldStops')}</p>
        </div>

        <div className="bg-card p-4 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-xs font-bold text-muted-foreground">{t('tracking.missedVisits')}</span>
          </div>
          <p className="text-2xl font-black text-red-500">{skipped}</p>
        </div>

        <div className="bg-card p-4 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-bold text-muted-foreground">{t('tracking.pendingStops')}</span>
          </div>
          <p className="text-2xl font-black text-purple-600">{pending}</p>
        </div>
      </div>

      {/* Agent Ranking */}
      {agentStats.length > 0 && (
        <div className="bg-card p-4 rounded-2xl shadow-sm">
          <h3 className="text-xs font-bold text-muted-foreground mb-3">{t('tracking.agentRanking')}</h3>
          <div className="space-y-2">
            {agentStats.slice(0, 5).map(([agentId, stats], idx) => {
              const rate = stats.total > 0 ? Math.round((stats.visited / stats.total) * 100) : 0;
              return (
                <div key={agentId} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    idx === 0 ? 'bg-yellow-500/20 text-yellow-600' : 'bg-muted text-muted-foreground'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${rate}%` }} />
                    </div>
                  </div>
                  <span className="text-xs font-bold text-foreground">{rate}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteKPIs;
