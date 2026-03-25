-- Performance indexes for GPS tracking at scale (1000+ agents)

-- Index for fetching latest location per agent (used by AgentMapView)
CREATE INDEX IF NOT EXISTS idx_distributor_locations_org_user_recorded 
ON public.distributor_locations (organization_id, user_id, recorded_at DESC);

-- Index for route_stops by planned_date (used by MyRouteTab and RouteKPIs)
CREATE INDEX IF NOT EXISTS idx_route_stops_planned_date 
ON public.route_stops (planned_date, status);

-- Index for routes by org and distributor (used by RouteHistory, RoutePlanner)
CREATE INDEX IF NOT EXISTS idx_routes_org_distributor 
ON public.routes (organization_id, distributor_id, created_at DESC);

-- Server-side RPC for route KPIs aggregation (avoids fetching all rows client-side)
CREATE OR REPLACE FUNCTION public.get_route_kpis(p_organization_id uuid, p_since date)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '5s'
AS $$
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'visited', COUNT(*) FILTER (WHERE rs.status IN ('visited', 'sold')),
    'sold', COUNT(*) FILTER (WHERE rs.status = 'sold'),
    'skipped', COUNT(*) FILTER (WHERE rs.status = 'skipped'),
    'pending', COUNT(*) FILTER (WHERE rs.status = 'pending'),
    'per_agent', COALESCE((
      SELECT jsonb_agg(agent_row)
      FROM (
        SELECT jsonb_build_object(
          'distributor_id', r.distributor_id,
          'total', COUNT(*),
          'visited', COUNT(*) FILTER (WHERE rs2.status IN ('visited', 'sold')),
          'sold', COUNT(*) FILTER (WHERE rs2.status = 'sold')
        ) AS agent_row
        FROM route_stops rs2
        JOIN routes r ON r.id = rs2.route_id
        WHERE r.organization_id = p_organization_id
          AND rs2.planned_date >= p_since
        GROUP BY r.distributor_id
        ORDER BY COUNT(*) FILTER (WHERE rs2.status IN ('visited', 'sold')) DESC
        LIMIT 20
      ) sub
    ), '[]'::jsonb)
  )
  FROM route_stops rs
  JOIN routes r ON r.id = rs.route_id
  WHERE r.organization_id = p_organization_id
    AND rs.planned_date >= p_since;
$$;

-- Server-side RPC for latest agent locations (avoids fetching all day's GPS points)
CREATE OR REPLACE FUNCTION public.get_latest_agent_locations(p_organization_id uuid)
RETURNS TABLE(user_id uuid, latitude double precision, longitude double precision, accuracy double precision, recorded_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '5s'
AS $$
  SELECT DISTINCT ON (dl.user_id) 
    dl.user_id, dl.latitude, dl.longitude, dl.accuracy, dl.recorded_at
  FROM distributor_locations dl
  WHERE dl.organization_id = p_organization_id
    AND dl.recorded_at >= (CURRENT_DATE AT TIME ZONE 'UTC')
  ORDER BY dl.user_id, dl.recorded_at DESC;
$$;