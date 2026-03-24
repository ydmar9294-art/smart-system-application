import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Route, Save, Users, Calendar, ChevronUp, ChevronDown, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/store/AuthContext';

interface StopEntry {
  customerId: string;
  customerName: string;
  plannedDate: string;
}

const RoutePlanner: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDistributor, setSelectedDistributor] = useState('');
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split('T')[0];
  });
  const [routeName, setRouteName] = useState('');
  const [stops, setStops] = useState<StopEntry[]>([]);
  const [saved, setSaved] = useState(false);

  // Fetch field agents
  const { data: distributors = [] } = useQuery({
    queryKey: ['field-agents-planner', organization?.id],
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

  // Fetch customers
  const { data: customers = [] } = useQuery({
    queryKey: ['customers-planner', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data } = await supabase
        .from('customers')
        .select('id, name, location')
        .eq('organization_id', organization.id)
        .order('name');
      return data || [];
    },
    enabled: !!organization?.id,
  });

  const addStop = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer || stops.find(s => s.customerId === customerId)) return;
    setStops(prev => [...prev, {
      customerId,
      customerName: customer.name,
      plannedDate: weekStart,
    }]);
  };

  const removeStop = (idx: number) => {
    setStops(prev => prev.filter((_, i) => i !== idx));
  };

  const moveStop = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= stops.length) return;
    setStops(prev => {
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    });
  };

  const updateStopDate = (idx: number, date: string) => {
    setStops(prev => prev.map((s, i) => i === idx ? { ...s, plannedDate: date } : s));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!organization?.id || !selectedDistributor || stops.length === 0) {
        throw new Error('Missing data');
      }

      const { data: { session } } = await supabase.auth.getSession();

      const { data: route, error: routeErr } = await supabase
        .from('routes')
        .insert({
          distributor_id: selectedDistributor,
          organization_id: organization.id,
          week_start: weekStart,
          name: routeName || null,
          created_by: session?.user?.id || null,
        })
        .select('id')
        .single();

      if (routeErr) throw routeErr;

      const stopsData = stops.map((s, idx) => ({
        route_id: route.id,
        customer_id: s.customerId,
        customer_name: s.customerName,
        sequence_order: idx + 1,
        planned_date: s.plannedDate,
        status: 'pending',
      }));

      const { error: stopsErr } = await supabase
        .from('route_stops')
        .insert(stopsData);

      if (stopsErr) throw stopsErr;
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setStops([]);
      setRouteName('');
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
  });

  const availableCustomers = useMemo(
    () => customers.filter(c => !stops.find(s => s.customerId === c.id)),
    [customers, stops]
  );

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-foreground flex items-center gap-2">
        <Route className="w-5 h-5 text-orange-500" />
        {t('tracking.routePlanner')}
      </h2>

      {/* Distributor selector */}
      <div className="bg-card p-4 rounded-2xl shadow-sm space-y-3">
        <label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
          <Users className="w-3.5 h-3.5" /> {t('tracking.selectDistributor')}
        </label>
        <select
          value={selectedDistributor}
          onChange={e => setSelectedDistributor(e.target.value)}
          className="w-full px-4 py-3 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">{t('tracking.chooseDistributor')}</option>
          {distributors.map(d => (
            <option key={d.id} value={d.id}>{d.full_name}</option>
          ))}
        </select>

        <label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" /> {t('tracking.weekStart')}
        </label>
        <input
          type="date"
          value={weekStart}
          onChange={e => setWeekStart(e.target.value)}
          className="w-full px-4 py-3 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-primary"
        />

        <input
          type="text"
          value={routeName}
          onChange={e => setRouteName(e.target.value)}
          placeholder={t('tracking.routeNameOptional')}
          className="w-full px-4 py-3 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
        />
      </div>

      {/* Add customers */}
      {selectedDistributor && (
        <div className="bg-card p-4 rounded-2xl shadow-sm space-y-3">
          <label className="text-xs font-bold text-muted-foreground">{t('tracking.addCustomerToRoute')}</label>
          <select
            onChange={e => { addStop(e.target.value); e.target.value = ''; }}
            className="w-full px-4 py-3 bg-muted text-foreground rounded-xl border-none outline-none focus:ring-2 focus:ring-primary"
            value=""
          >
            <option value="">{t('tracking.chooseCustomer')}</option>
            {availableCustomers.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.location ? ` — ${c.location}` : ''}</option>
            ))}
          </select>
        </div>
      )}

      {/* Stops list */}
      {stops.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground px-1">
            {t('tracking.routeStops')} ({stops.length})
          </p>
          {stops.map((stop, idx) => (
            <div key={stop.customerId} className="bg-card p-3 rounded-xl shadow-sm flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500/10 text-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground text-sm truncate">{stop.customerName}</p>
                <input
                  type="date"
                  value={stop.plannedDate}
                  onChange={e => updateStopDate(idx, e.target.value)}
                  className="text-xs bg-muted px-2 py-1 rounded-lg mt-1 text-muted-foreground"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveStop(idx, -1)} disabled={idx === 0} className="p-1 hover:bg-muted rounded disabled:opacity-30">
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => moveStop(idx, 1)} disabled={idx === stops.length - 1} className="p-1 hover:bg-muted rounded disabled:opacity-30">
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
              <button onClick={() => removeStop(idx)} className="text-destructive text-xs font-bold">✕</button>
            </div>
          ))}

          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !selectedDistributor || stops.length === 0}
            className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all disabled:opacity-50"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : saved ? (
              <><Check className="w-5 h-5" /> {t('tracking.routeSaved')}</>
            ) : (
              <><Save className="w-5 h-5" /> {t('tracking.saveRoute')}</>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default RoutePlanner;
