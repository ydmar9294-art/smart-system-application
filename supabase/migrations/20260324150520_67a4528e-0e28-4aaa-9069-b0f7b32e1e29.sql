
-- Routes table: weekly route assignments by Sales Manager
CREATE TABLE IF NOT EXISTS public.routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  name text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Route stops: ordered customer stops within a route
CREATE TABLE IF NOT EXISTS public.route_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  sequence_order integer NOT NULL,
  planned_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  visited_at timestamptz,
  location_lat double precision,
  location_lng double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_routes_org_distributor ON public.routes(organization_id, distributor_id);
CREATE INDEX IF NOT EXISTS idx_routes_week ON public.routes(week_start);
CREATE INDEX IF NOT EXISTS idx_route_stops_route ON public.route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_planned_date ON public.route_stops(planned_date);
CREATE INDEX IF NOT EXISTS idx_route_stops_status ON public.route_stops(status);

-- Index for distributor_locations queries (agent map polling)
CREATE INDEX IF NOT EXISTS idx_distributor_locations_org_user_time 
  ON public.distributor_locations(organization_id, user_id, recorded_at DESC);

-- Enable RLS
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;

-- Routes RLS: org members can read
CREATE POLICY "Org members can read routes" ON public.routes
  FOR SELECT TO authenticated
  USING (organization_id = get_my_org_id());

-- Routes RLS: managers can insert
CREATE POLICY "Managers can insert routes" ON public.routes
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = get_my_org_id() 
    AND (get_my_role() = 'OWNER' OR get_my_role() = 'DEVELOPER' 
         OR (get_my_role() = 'EMPLOYEE' AND EXISTS (
           SELECT 1 FROM profiles WHERE id = auth.uid() AND employee_type = 'SALES_MANAGER'
         )))
  );

-- Routes RLS: managers can update
CREATE POLICY "Managers can update routes" ON public.routes
  FOR UPDATE TO authenticated
  USING (
    organization_id = get_my_org_id()
    AND (get_my_role() = 'OWNER' OR get_my_role() = 'DEVELOPER'
         OR (get_my_role() = 'EMPLOYEE' AND EXISTS (
           SELECT 1 FROM profiles WHERE id = auth.uid() AND employee_type = 'SALES_MANAGER'
         )))
  );

-- Route stops RLS: org members can read via route join
CREATE POLICY "Org members can read route stops" ON public.route_stops
  FOR SELECT TO authenticated
  USING (route_id IN (SELECT id FROM public.routes WHERE organization_id = get_my_org_id()));

-- Route stops RLS: managers can insert
CREATE POLICY "Managers can insert route stops" ON public.route_stops
  FOR INSERT TO authenticated
  WITH CHECK (route_id IN (
    SELECT id FROM public.routes WHERE organization_id = get_my_org_id()
    AND (get_my_role() = 'OWNER' OR get_my_role() = 'DEVELOPER'
         OR (get_my_role() = 'EMPLOYEE' AND EXISTS (
           SELECT 1 FROM profiles WHERE id = auth.uid() AND employee_type = 'SALES_MANAGER'
         )))
  ));

-- Route stops RLS: org members can update (distributors update their own stop status)
CREATE POLICY "Org members can update route stops" ON public.route_stops
  FOR UPDATE TO authenticated
  USING (route_id IN (SELECT id FROM public.routes WHERE organization_id = get_my_org_id()));
