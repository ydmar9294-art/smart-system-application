import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MapPin, Users, Clock, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/store/AuthContext';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Ensure leaflet CSS is loaded for proper rendering
if (typeof window !== 'undefined') {
  const link = document.querySelector('link[href*="leaflet.css"]');
  if (!link) {
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(cssLink);
  }
}

// Fix default marker icon
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = defaultIcon;

interface AgentLocation {
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recorded_at: string;
  agent_name?: string;
}

const AgentMapView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { organization } = useAuth();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const { data: locations = [], isLoading, refetch } = useQuery({
    queryKey: ['agent-locations', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('distributor_locations')
        .select('user_id, latitude, longitude, accuracy, recorded_at')
        .eq('organization_id', organization.id)
        .gte('recorded_at', todayStart.toISOString())
        .order('recorded_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id,
    refetchInterval: 60_000,
  });

  // Get agent profiles
  const { data: agents = [] } = useQuery({
    queryKey: ['field-agents', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, employee_type')
        .eq('organization_id', organization.id)
        .eq('employee_type', 'FIELD_AGENT')
        .eq('is_active', true);
      return data || [];
    },
    enabled: !!organization?.id,
    staleTime: 5 * 60_000,
  });

  // Latest location per agent
  const latestLocations = useMemo(() => {
    const map = new Map<string, AgentLocation>();
    for (const loc of locations) {
      if (!map.has(loc.user_id)) {
        const agent = agents.find(a => a.id === loc.user_id);
        map.set(loc.user_id, {
          ...loc,
          agent_name: agent?.full_name || t('tracking.unknownAgent'),
        });
      }
    }
    return map;
  }, [locations, agents, t]);

  // All agents list (with or without GPS data)
  const allAgents = useMemo(() => {
    return agents.map(agent => ({
      id: agent.id,
      name: agent.full_name || t('tracking.unknownAgent'),
      hasLocation: latestLocations.has(agent.id),
      location: latestLocations.get(agent.id) || null,
    }));
  }, [agents, latestLocations, t]);

  const agentsWithLocation = useMemo(() => 
    Array.from(latestLocations.values()), 
  [latestLocations]);

  const center: [number, number] = agentsWithLocation.length > 0
    ? [agentsWithLocation[0].latitude, agentsWithLocation[0].longitude]
    : [33.5138, 36.2765]; // Damascus default

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString(isRtl ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-foreground flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-600" />
          {t('tracking.agentMap')}
        </h2>
        <button onClick={() => refetch()} className="p-2 bg-card rounded-xl hover:bg-muted transition-colors">
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Agent List */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {latestLocations.map(loc => (
          <button
            key={loc.user_id}
            onClick={() => setSelectedAgent(loc.user_id === selectedAgent ? null : loc.user_id)}
            className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedAgent === loc.user_id
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-card text-foreground shadow-sm hover:bg-muted'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span>{loc.agent_name}</span>
            </div>
            <p className="text-[10px] opacity-70 mt-0.5">
              <Clock className="w-3 h-3 inline" /> {formatTime(loc.recorded_at)}
            </p>
          </button>
        ))}
        {latestLocations.length === 0 && !isLoading && (
          <div className="text-center py-4 text-muted-foreground text-sm w-full">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
            {t('tracking.noActiveAgents')}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="rounded-2xl overflow-hidden shadow-sm border border-border" style={{ height: 400 }}>
        <MapContainer
          center={center}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {latestLocations
            .filter(loc => !selectedAgent || loc.user_id === selectedAgent)
            .map(loc => (
              <Marker key={loc.user_id} position={[loc.latitude, loc.longitude]}>
                <Popup>
                  <div className="text-sm">
                    <p className="font-bold">{loc.agent_name}</p>
                    <p className="text-xs text-gray-500">{formatTime(loc.recorded_at)}</p>
                    {loc.accuracy && (
                      <p className="text-xs text-gray-400">±{Math.round(loc.accuracy)}m</p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default AgentMapView;
