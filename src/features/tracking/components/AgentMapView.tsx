import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MapPin, Users, Clock, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/store/AuthContext';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Helper component to fly map to a position
const FlyToAgent: React.FC<{ position: [number, number] | null }> = ({ position }) => {
  const map = useMap();
  React.useEffect(() => {
    if (position) {
      map.flyTo(position, 15, { duration: 1 });
    }
  }, [map, position]);
  return null;
};

if (typeof window !== 'undefined') {
  const link = document.querySelector('link[href*="leaflet.css"]');
  if (!link) {
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(cssLink);
  }
}

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

  // Use server-side RPC for latest locations (DISTINCT ON, no full-day scan)
  const { data: locations = [], isLoading, refetch } = useQuery({
    queryKey: ['agent-locations-rpc', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase.rpc('get_latest_agent_locations', {
        p_organization_id: organization.id,
      });
      if (error) {
        console.error('get_latest_agent_locations error:', error);
        return [];
      }
      return (data || []) as AgentLocation[];
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

  // Fetch device online status
  const { data: onlineDevices = [] } = useQuery({
    queryKey: ['agent-devices-online', organization?.id],
    queryFn: async () => {
      if (!organization?.id || agents.length === 0) return [];
      const agentIds = agents.map(a => a.id);
      const { data } = await supabase
        .from('devices')
        .select('user_id, last_seen, is_active')
        .in('user_id', agentIds)
        .eq('is_active', true)
        .order('last_seen', { ascending: false });
      return data || [];
    },
    enabled: !!organization?.id && agents.length > 0,
    refetchInterval: 60_000,
  });

  const onlineStatusMap = useMemo(() => {
    const map = new Map<string, { isOnline: boolean; lastSeen: string }>();
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    for (const device of onlineDevices) {
      if (!map.has(device.user_id)) {
        map.set(device.user_id, {
          isOnline: device.last_seen >= tenMinAgo,
          lastSeen: device.last_seen,
        });
      }
    }
    return map;
  }, [onlineDevices]);

  // Location map from RPC results (already 1 per agent)
  const latestLocations = useMemo(() => {
    const map = new Map<string, AgentLocation>();
    for (const loc of locations) {
      const agent = agents.find(a => a.id === loc.user_id);
      map.set(loc.user_id, {
        ...loc,
        agent_name: agent?.full_name || t('tracking.unknownAgent'),
      });
    }
    return map;
  }, [locations, agents, t]);

  const allAgents = useMemo(() => {
    return agents.map(agent => {
      const deviceStatus = onlineStatusMap.get(agent.id);
      return {
        id: agent.id,
        name: agent.full_name || t('tracking.unknownAgent'),
        hasLocation: latestLocations.has(agent.id),
        location: latestLocations.get(agent.id) || null,
        isOnline: deviceStatus?.isOnline ?? false,
        lastSeen: deviceStatus?.lastSeen || null,
      };
    });
  }, [agents, latestLocations, onlineStatusMap, t]);

  const agentsWithLocation = useMemo(() => 
    Array.from(latestLocations.values()), 
  [latestLocations]);

  const center: [number, number] = agentsWithLocation.length > 0
    ? [agentsWithLocation[0].latitude, agentsWithLocation[0].longitude]
    : [33.5138, 36.2765];

  const flyToPosition: [number, number] | null = useMemo(() => {
    if (!selectedAgent) return null;
    const loc = latestLocations.get(selectedAgent);
    if (loc) return [loc.latitude, loc.longitude];
    return null;
  }, [selectedAgent, latestLocations]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString(isRtl ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-foreground flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-600" />
          {t('tracking.agentMap')}
        </h2>
        <button onClick={() => refetch()} className="p-2 bg-card rounded-xl hover:bg-muted transition-colors">
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {allAgents.map(agent => (
          <button
            key={agent.id}
            onClick={() => setSelectedAgent(agent.id === selectedAgent ? null : agent.id)}
            className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedAgent === agent.id
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-card text-foreground shadow-sm hover:bg-muted'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${agent.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground/40'}`} />
              <span>{agent.name}</span>
              {agent.isOnline ? (
                <Wifi className="w-3 h-3 text-emerald-500" />
              ) : (
                <WifiOff className="w-3 h-3 text-muted-foreground/40" />
              )}
            </div>
            {agent.isOnline ? (
              <p className="text-[10px] opacity-70 mt-0.5">{t('tracking.online')}</p>
            ) : agent.lastSeen ? (
              <p className="text-[10px] opacity-50 mt-0.5">
                <Clock className="w-3 h-3 inline" /> {formatTime(agent.lastSeen)}
              </p>
            ) : (
              <p className="text-[10px] opacity-50 mt-0.5">{t('tracking.neverConnected')}</p>
            )}
          </button>
        ))}
        {allAgents.length === 0 && !isLoading && (
          <div className="text-center py-4 text-muted-foreground text-sm w-full">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
            {t('tracking.noActiveAgents')}
          </div>
        )}
      </div>

      <div className="rounded-2xl overflow-hidden shadow-sm border border-border" style={{ height: 400 }}>
        <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {agentsWithLocation
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
