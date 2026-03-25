import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BarChart3, CheckCircle2, XCircle, TrendingUp, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/store/AuthContext';

interface KpiData {
  total: number;
  visited: number;
  sold: number;
  skipped: number;
  pending: number;
  per_agent: Array<{
    distributor_id: string;
    total: number;
    visited: number;
    sold: number;
  }>;
}

const RouteKPIs: React.FC = () => {
  const { t } = useTranslation();
  const { organization } = useAuth();

  const weekStart = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
  }, []);

  // Use server-side RPC for aggregated KPIs (no row fetching)
  const { data: kpis, isLoading } = useQuery({
    queryKey: ['route-kpis-rpc', organization?.id, weekStart],
    queryFn: async () => {
      if (!organization?.id) return null;
      const { data, error } = await supabase.rpc('get_route_kpis', {
        p_organization_id: organization.id,
        p_since: weekStart,
      });
      if (error) {
        console.error('get_route_kpis error:', error);
        return null;
      }
      return data as unknown as KpiData;
    },
    enabled: !!organization?.id,
    staleTime: 60_000,
  });

  const total = kpis?.total ?? 0;
  const visited = kpis?.visited ?? 0;
  const sold = kpis?.sold ?? 0;
  const skipped = kpis?.skipped ?? 0;
  const pending = kpis?.pending ?? 0;
  const agentStats = kpis?.per_agent ?? [];

  const visitRate = total > 0 ? Math.round((visited / total) * 100) : 0;
  const conversionRate = visited > 0 ? Math.round((sold / visited) * 100) : 0;

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

      {agentStats.length > 0 && (
        <div className="bg-card p-4 rounded-2xl shadow-sm">
          <h3 className="text-xs font-bold text-muted-foreground mb-3">{t('tracking.agentRanking')}</h3>
          <div className="space-y-2">
            {agentStats.slice(0, 10).map((agent, idx) => {
              const rate = agent.total > 0 ? Math.round((agent.visited / agent.total) * 100) : 0;
              return (
                <div key={agent.distributor_id} className="flex items-center gap-3">
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
                  <span className="text-[10px] text-muted-foreground">{agent.visited}/{agent.total}</span>
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
