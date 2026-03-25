import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MapPin, Check, ShoppingBag, SkipForward, Clock, Navigation, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/store/AuthContext';
import { Progress } from '@/components/ui/progress';

interface RouteStop {
  id: string;
  customer_name: string;
  customer_id: string;
  sequence_order: number;
  planned_date: string;
  status: string;
  notes: string | null;
  visited_at: string | null;
}

interface MyRouteTabProps {
  isOnline: boolean;
  onQueueAction: (type: any, payload: any, ...args: any[]) => Promise<any>;
}

const MyRouteTab: React.FC<MyRouteTabProps> = ({ isOnline, onQueueAction }) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const [skipNotes, setSkipNotes] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  // Get the current week range (Sunday to Saturday)
  const weekRange = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return {
      start: weekStart.toISOString().split('T')[0],
      end: weekEnd.toISOString().split('T')[0],
    };
  }, []);

  const { data: stops = [], isLoading } = useQuery({
    queryKey: ['my-route-week', weekRange.start, weekRange.end],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return [];

      // Fetch all stops for the current week for this distributor
      const { data, error } = await supabase
        .from('route_stops')
        .select('id, customer_name, customer_id, sequence_order, planned_date, status, notes, visited_at, route_id, routes!inner(distributor_id)')
        .gte('planned_date', weekRange.start)
        .lte('planned_date', weekRange.end)
        .eq('routes.distributor_id', session.user.id)
        .order('planned_date')
        .order('sequence_order');

      if (error) {
        console.error('MyRouteTab query error:', error);
        return [];
      }

      return ((data || []) as any[]).map((s: any) => ({
        id: s.id,
        customer_name: s.customer_name,
        customer_id: s.customer_id,
        sequence_order: s.sequence_order,
        planned_date: s.planned_date,
        status: s.status,
        notes: s.notes,
        visited_at: s.visited_at,
      })) as RouteStop[];
    },
    staleTime: 30_000,
  });

  // Split stops by today vs other days
  const todayStops = useMemo(() => stops.filter(s => s.planned_date === today), [stops, today]);
  const upcomingStops = useMemo(() => stops.filter(s => s.planned_date > today && s.status === 'pending'), [stops, today]);
  const pastStops = useMemo(() => stops.filter(s => s.planned_date < today), [stops, today]);

  const updateStop = useCallback(async (stopId: string, status: 'visited' | 'sold' | 'skipped', notes?: string) => {
    setUpdatingId(stopId);
    try {
      if (isOnline) {
        await supabase
          .from('route_stops')
          .update({
            status,
            notes: notes || null,
            visited_at: new Date().toISOString(),
          })
          .eq('id', stopId);
      } else {
        await onQueueAction('ROUTE_VISIT', {
          stopId,
          status,
          notes: notes || null,
          visitedAt: new Date().toISOString(),
        });
      }

      queryClient.setQueryData(['my-route-week', weekRange.start, weekRange.end], (prev: RouteStop[] | undefined) =>
        (prev || []).map(s => s.id === stopId ? { ...s, status, notes: notes || s.notes, visited_at: new Date().toISOString() } : s)
      );
    } catch (err) {
      console.error('Failed to update stop:', err);
    } finally {
      setUpdatingId(null);
    }
  }, [isOnline, onQueueAction, queryClient, weekRange]);

  const completed = todayStops.filter(s => s.status !== 'pending').length;
  const progress = todayStops.length > 0 ? (completed / todayStops.length) * 100 : 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sold': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'visited': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'skipped': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-muted text-muted-foreground border-border';
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString(isRtl ? 'ar-SY' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-card p-4 rounded-2xl shadow-sm animate-pulse h-28" />
        ))}
      </div>
    );
  }

  if (stops.length === 0) {
    return (
      <div className="bg-card p-8 rounded-3xl text-center">
        <Navigation className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-40" />
        <p className="font-bold text-foreground mb-1">{t('tracking.noRouteToday')}</p>
        <p className="text-sm text-muted-foreground">{t('tracking.noRouteDescription')}</p>
        <p className="text-xs text-muted-foreground/60 mt-2">{t('tracking.routeAssignedByManager')}</p>
      </div>
    );
  }

  const renderStopCard = (stop: RouteStop, idx: number, showActions: boolean) => (
    <div key={stop.id} className={`bg-card rounded-2xl shadow-sm overflow-hidden border ${getStatusColor(stop.status)}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
            stop.status === 'pending' ? 'bg-blue-500/10 text-blue-600' : 'bg-emerald-500/10 text-emerald-600'
          }`}>
            {idx + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground text-sm">{stop.customer_name}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${getStatusColor(stop.status)}`}>
                {getStatusLabel(stop.status)}
              </span>
              {stop.visited_at && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(stop.visited_at).toLocaleTimeString(isRtl ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions (only for pending stops on today or past) */}
        {showActions && stop.status === 'pending' && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <button
                onClick={() => updateStop(stop.id, 'sold')}
                disabled={updatingId === stop.id}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              >
                <ShoppingBag className="w-3.5 h-3.5" /> {t('tracking.visitedAndSold')}
              </button>
              <button
                onClick={() => updateStop(stop.id, 'visited')}
                disabled={updatingId === stop.id}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              >
                <Check className="w-3.5 h-3.5" /> {t('tracking.visitedNoSale')}
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={skipNotes[stop.id] || ''}
                onChange={e => setSkipNotes(prev => ({ ...prev, [stop.id]: e.target.value }))}
                placeholder={t('tracking.skipReason')}
                className="flex-1 px-3 py-2 bg-muted text-foreground rounded-xl text-xs border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
              />
              <button
                onClick={() => updateStop(stop.id, 'skipped', skipNotes[stop.id])}
                disabled={updatingId === stop.id}
                className="px-4 py-2 bg-red-500/10 text-red-500 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <SkipForward className="w-3.5 h-3.5" /> {t('tracking.skip')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Today's Progress */}
      {todayStops.length > 0 && (
        <>
          <div className="bg-card p-4 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-muted-foreground">{t('tracking.routeProgress')} — {t('common.today')}</span>
              <span className="text-xs font-bold text-foreground">{completed}/{todayStops.length}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
          {todayStops.map((stop, idx) => renderStopCard(stop, idx, true))}
        </>
      )}

      {/* Past pending stops (missed) */}
      {pastStops.filter(s => s.status === 'pending').length > 0 && (
        <>
          <h3 className="text-xs font-bold text-destructive px-1 flex items-center gap-1.5 pt-2">
            <Calendar className="w-3.5 h-3.5" /> {t('tracking.missedVisits')}
          </h3>
          {pastStops.filter(s => s.status === 'pending').map((stop, idx) => (
            <div key={stop.id}>
              <p className="text-[10px] text-muted-foreground px-1 mb-1">{formatDate(stop.planned_date)}</p>
              {renderStopCard(stop, idx, true)}
            </div>
          ))}
        </>
      )}

      {/* Upcoming stops */}
      {upcomingStops.length > 0 && (
        <>
          <h3 className="text-xs font-bold text-muted-foreground px-1 flex items-center gap-1.5 pt-2">
            <Calendar className="w-3.5 h-3.5" /> {t('tracking.upcomingStops')}
          </h3>
          {upcomingStops.map((stop, idx) => (
            <div key={stop.id}>
              <p className="text-[10px] text-muted-foreground px-1 mb-1">{formatDate(stop.planned_date)}</p>
              {renderStopCard(stop, idx, false)}
            </div>
          ))}
        </>
      )}

      {/* Today has no stops but week has */}
      {todayStops.length === 0 && stops.length > 0 && (
        <div className="bg-card p-6 rounded-2xl text-center">
          <Navigation className="w-10 h-10 mx-auto text-muted-foreground mb-3 opacity-40" />
          <p className="font-bold text-foreground text-sm mb-1">{t('tracking.noStopsToday')}</p>
          <p className="text-xs text-muted-foreground">{t('tracking.hasWeekStops')}</p>
        </div>
      )}
    </div>
  );
};

export default MyRouteTab;
