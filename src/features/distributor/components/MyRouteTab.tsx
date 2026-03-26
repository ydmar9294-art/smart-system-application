import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Check, ShoppingBag, SkipForward, Clock, Navigation, Calendar, ChevronDown, FolderOpen } from 'lucide-react';
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

interface DayGroup {
  date: string;
  label: string;
  stops: RouteStop[];
  isToday: boolean;
  isPast: boolean;
  completedCount: number;
  totalCount: number;
}

const MyRouteTab: React.FC<MyRouteTabProps> = ({ isOnline, onQueueAction }) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const [skipNotes, setSkipNotes] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const today = new Date().toISOString().split('T')[0];

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

  // Group stops by date into day folders
  const dayGroups = useMemo(() => {
    const groupMap = new Map<string, RouteStop[]>();
    for (const stop of stops) {
      const arr = groupMap.get(stop.planned_date) || [];
      arr.push(stop);
      groupMap.set(stop.planned_date, arr);
    }

    const groups: DayGroup[] = [];
    for (const [date, dayStops] of groupMap) {
      const isToday = date === today;
      const isPast = date < today;
      const completedCount = dayStops.filter(s => s.status !== 'pending').length;
      const d = new Date(date + 'T00:00:00');
      const dayName = d.toLocaleDateString(isRtl ? 'ar-SY' : 'en-US', { weekday: 'long' });
      const dateStr = d.toLocaleDateString(isRtl ? 'ar-SY' : 'en-US', { month: 'short', day: 'numeric' });
      const label = isToday
        ? `${t('common.today')} — ${dayName} ${dateStr}`
        : `${dayName} — ${dateStr}`;

      groups.push({ date, label, stops: dayStops, isToday, isPast, completedCount, totalCount: dayStops.length });
    }

    return groups.sort((a, b) => a.date.localeCompare(b.date));
  }, [stops, today, isRtl, t]);

  // Auto-expand today
  useMemo(() => {
    const todayGroup = dayGroups.find(g => g.isToday);
    if (todayGroup && !expandedDays.has(todayGroup.date)) {
      setExpandedDays(prev => new Set(prev).add(todayGroup.date));
    }
  }, [dayGroups]);

  const toggleDay = useCallback((date: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }, []);

  const updateStop = useCallback(async (stopId: string, status: 'visited' | 'sold' | 'skipped', notes?: string) => {
    setUpdatingId(stopId);
    try {
      if (isOnline) {
        await supabase
          .from('route_stops')
          .update({ status, notes: notes || null, visited_at: new Date().toISOString() })
          .eq('id', stopId);
      } else {
        await onQueueAction('ROUTE_VISIT', { stopId, status, notes: notes || null, visitedAt: new Date().toISOString() });
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

  const getDayStatusColor = (group: DayGroup) => {
    if (group.completedCount === group.totalCount) return 'border-emerald-500/30 bg-emerald-500/5';
    if (group.isToday) return 'border-blue-500/30 bg-blue-500/5';
    if (group.isPast && group.completedCount < group.totalCount) return 'border-red-500/20 bg-red-500/5';
    return 'border-border bg-card';
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-card p-4 rounded-2xl shadow-sm animate-pulse h-20" />
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

  return (
    <div className="space-y-3">
      {dayGroups.map(group => {
        const isExpanded = expandedDays.has(group.date);
        const progress = group.totalCount > 0 ? (group.completedCount / group.totalCount) * 100 : 0;
        const showActions = group.isToday || group.isPast;
        const pendingCount = group.totalCount - group.completedCount;

        return (
          <div key={group.date} className={`rounded-2xl border overflow-hidden shadow-sm ${getDayStatusColor(group)}`}>
            {/* Day folder header */}
            <button
              onClick={() => toggleDay(group.date)}
              className="w-full p-4 flex items-center gap-3 text-start active:scale-[0.99] transition-all"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                group.isToday ? 'bg-blue-500/15 text-blue-600' :
                group.completedCount === group.totalCount ? 'bg-emerald-500/15 text-emerald-600' :
                group.isPast && pendingCount > 0 ? 'bg-red-500/15 text-red-500' :
                'bg-muted text-muted-foreground'
              }`}>
                <FolderOpen className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground text-sm">{group.label}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground">
                    {group.completedCount}/{group.totalCount} {t('tracking.completed')}
                  </span>
                  {group.isPast && pendingCount > 0 && (
                    <span className="text-[10px] text-red-500 font-bold">
                      {pendingCount} {t('tracking.missedVisits')}
                    </span>
                  )}
                </div>
                <Progress value={progress} className="h-1.5 mt-1.5" />
              </div>

              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>

            {/* Expanded stops */}
            {isExpanded && (
              <div className="px-3 pb-3 space-y-2">
                {group.stops.map((stop, idx) => (
                  <div key={stop.id} className={`bg-card rounded-xl border overflow-hidden ${getStatusColor(stop.status)}`}>
                    <div className="p-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                          stop.status === 'pending' ? 'bg-blue-500/10 text-blue-600' : 'bg-emerald-500/10 text-emerald-600'
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-foreground text-sm">{stop.customer_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
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
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MyRouteTab;
