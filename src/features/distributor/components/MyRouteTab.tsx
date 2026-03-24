import React, { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MapPin, Check, ShoppingBag, SkipForward, Clock, Navigation } from 'lucide-react';
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

  const { data: stops = [], isLoading } = useQuery({
    queryKey: ['my-route-today', today],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return [];

      const { data } = await supabase
        .from('route_stops')
        .select('id, customer_name, customer_id, sequence_order, planned_date, status, notes, visited_at, route_id, routes!inner(distributor_id)')
        .eq('planned_date', today)
        .order('sequence_order');

      // Filter to this distributor's stops
      return ((data || []) as any[])
        .filter((s: any) => s.routes?.distributor_id === session.user.id)
        .map((s: any) => ({
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

      // Optimistic update
      queryClient.setQueryData(['my-route-today', today], (prev: RouteStop[] | undefined) =>
        (prev || []).map(s => s.id === stopId ? { ...s, status, notes: notes || s.notes, visited_at: new Date().toISOString() } : s)
      );
    } catch (err) {
      console.error('Failed to update stop:', err);
    } finally {
      setUpdatingId(null);
    }
  }, [isOnline, onQueueAction, queryClient, today]);

  const completed = stops.filter(s => s.status !== 'pending').length;
  const progress = stops.length > 0 ? (completed / stops.length) * 100 : 0;

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
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress Header */}
      <div className="bg-card p-4 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-muted-foreground">{t('tracking.routeProgress')}</span>
          <span className="text-xs font-bold text-foreground">{completed}/{stops.length}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Stop Cards */}
      {stops.map((stop, idx) => (
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

            {/* Actions (only for pending stops) */}
            {stop.status === 'pending' && (
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
  );
};

export default MyRouteTab;
