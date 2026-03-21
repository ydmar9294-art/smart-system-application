/**
 * VisitPlanTab — Distributor's daily visit plan
 * Shows today's planned visits with complete/skip/notes actions.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/store/AuthContext';
import { MapPin, Check, SkipForward, Clock, User, Loader2, RefreshCw } from 'lucide-react';

interface VisitPlan {
  id: string;
  customer_name: string;
  customer_id: string;
  planned_date: string;
  status: string;
  completed_at: string | null;
  notes: string | null;
}

const VisitPlanTab: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: visits = [], isLoading, refetch } = useQuery({
    queryKey: ['visit-plans', user?.id, today],
    queryFn: async (): Promise<VisitPlan[]> => {
      const { data, error } = await supabase
        .from('visit_plans')
        .select('id, customer_name, customer_id, planned_date, status, completed_at, notes')
        .eq('distributor_id', user?.id)
        .eq('planned_date', today)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as VisitPlan[];
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const update: any = { status };
      if (status === 'completed') update.completed_at = new Date().toISOString();
      if (notes !== undefined) update.notes = notes;
      const { error } = await supabase.from('visit_plans').update(update).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, status, notes }) => {
      await queryClient.cancelQueries({ queryKey: ['visit-plans', user?.id, today] });
      const prev = queryClient.getQueryData<VisitPlan[]>(['visit-plans', user?.id, today]);
      queryClient.setQueryData<VisitPlan[]>(['visit-plans', user?.id, today], (old) =>
        (old || []).map(v => v.id === id ? {
          ...v,
          status,
          completed_at: status === 'completed' ? new Date().toISOString() : v.completed_at,
          notes: notes !== undefined ? (notes || v.notes) : v.notes,
        } : v)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['visit-plans', user?.id, today], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['visit-plans'] }),
  });

  const planned = visits.filter(v => v.status === 'planned');
  const completed = visits.filter(v => v.status === 'completed');
  const skipped = visits.filter(v => v.status === 'skipped');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <Check className="w-4 h-4 text-emerald-500" />;
      case 'skipped': return <SkipForward className="w-4 h-4 text-amber-500" />;
      case 'missed': return <Clock className="w-4 h-4 text-red-500" />;
      default: return <MapPin className="w-4 h-4 text-blue-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-card rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-500" />
            {t('visits.todayPlan')}
          </h3>
          <button onClick={() => refetch()} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-blue-500/10 rounded-xl p-2">
            <p className="text-lg font-black text-blue-600 dark:text-blue-400">{planned.length}</p>
            <p className="text-[10px] text-muted-foreground font-bold">{t('visits.pending')}</p>
          </div>
          <div className="bg-emerald-500/10 rounded-xl p-2">
            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{completed.length}</p>
            <p className="text-[10px] text-muted-foreground font-bold">{t('visits.completed')}</p>
          </div>
          <div className="bg-amber-500/10 rounded-xl p-2">
            <p className="text-lg font-black text-amber-600 dark:text-amber-400">{skipped.length}</p>
            <p className="text-[10px] text-muted-foreground font-bold">{t('visits.skipped')}</p>
          </div>
        </div>
      </div>

      {/* Visit List */}
      {visits.length === 0 ? (
        <div className="bg-card rounded-2xl p-8 text-center shadow-sm">
          <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-30" />
          <p className="text-muted-foreground font-medium text-sm">{t('visits.noVisitsToday')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visits.map((visit) => (
            <VisitCard
              key={visit.id}
              visit={visit}
              onComplete={(id) => updateMutation.mutate({ id, status: 'completed' })}
              onSkip={(id, notes) => updateMutation.mutate({ id, status: 'skipped', notes })}
              isUpdating={updateMutation.isPending}
              getStatusIcon={getStatusIcon}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const VisitCard: React.FC<{
  visit: VisitPlan;
  onComplete: (id: string) => void;
  onSkip: (id: string, notes?: string) => void;
  isUpdating: boolean;
  getStatusIcon: (status: string) => React.ReactNode;
}> = ({ visit, onComplete, onSkip, isUpdating, getStatusIcon }) => {
  const { t } = useTranslation();
  const [showSkipInput, setShowSkipInput] = useState(false);
  const [skipReason, setSkipReason] = useState('');

  const isActionable = visit.status === 'planned';

  return (
    <div className={`bg-card rounded-2xl p-4 shadow-sm border ${
      visit.status === 'completed' ? 'border-emerald-500/20 opacity-70' :
      visit.status === 'skipped' ? 'border-amber-500/20 opacity-70' :
      visit.status === 'missed' ? 'border-red-500/20 opacity-60' :
      'border-border'
    }`}>
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          visit.status === 'planned' ? 'bg-blue-500/10' : 'bg-muted'
        }`}>
          <User className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-foreground text-sm">{visit.customer_name}</p>
          <div className="flex items-center gap-1 mt-0.5">
            {getStatusIcon(visit.status)}
            <span className="text-[10px] text-muted-foreground font-medium">
              {visit.status === 'completed' && visit.completed_at
                ? new Date(visit.completed_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
                : t(`visits.status_${visit.status}`)}
            </span>
          </div>
        </div>
      </div>

      {visit.notes && (
        <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-1.5 mb-2">{visit.notes}</p>
      )}

      {isActionable && !showSkipInput && (
        <div className="flex gap-2">
          <button
            onClick={() => onComplete(visit.id)}
            disabled={isUpdating}
            className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <Check className="w-4 h-4" /> {t('visits.markDone')}
          </button>
          <button
            onClick={() => setShowSkipInput(true)}
            disabled={isUpdating}
            className="flex-1 py-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <SkipForward className="w-4 h-4" /> {t('visits.skip')}
          </button>
        </div>
      )}

      {showSkipInput && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder={t('visits.skipReason')}
            value={skipReason}
            onChange={(e) => setSkipReason(e.target.value)}
            className="w-full px-3 py-2 bg-muted rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-amber-500/20"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { onSkip(visit.id, skipReason || undefined); setShowSkipInput(false); }}
              disabled={isUpdating}
              className="flex-1 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold"
            >
              {t('common.confirm')}
            </button>
            <button
              onClick={() => setShowSkipInput(false)}
              className="flex-1 py-2 bg-muted text-muted-foreground rounded-xl text-xs font-bold"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisitPlanTab;
