
-- =============================================
-- Feature 3: ABC Classification + Visit Plans
-- =============================================

-- Add classification column to customers (additive, no breaking change)
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS classification TEXT DEFAULT 'C';

-- Visit Plans table
CREATE TABLE IF NOT EXISTS public.visit_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  distributor_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  customer_name TEXT NOT NULL,
  planned_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  completed_at TIMESTAMPTZ,
  location_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visit_plans_distributor_date ON public.visit_plans(distributor_id, planned_date);
CREATE INDEX IF NOT EXISTS idx_visit_plans_org_date ON public.visit_plans(organization_id, planned_date);
CREATE INDEX IF NOT EXISTS idx_visit_plans_status ON public.visit_plans(status);

ALTER TABLE public.visit_plans ENABLE ROW LEVEL SECURITY;

-- Distributors can read/update their own plans
CREATE POLICY "Distributors read own visit plans" ON public.visit_plans
  FOR SELECT TO authenticated
  USING (distributor_id = auth.uid());

CREATE POLICY "Distributors update own visit plans" ON public.visit_plans
  FOR UPDATE TO authenticated
  USING (distributor_id = auth.uid());

-- Org members (owner/sales manager) can manage all plans
CREATE POLICY "Org managers manage visit plans" ON public.visit_plans
  FOR ALL TO authenticated
  USING (organization_id = get_my_org_id());

-- Developers can read all
CREATE POLICY "Developers read all visit plans" ON public.visit_plans
  FOR SELECT TO authenticated
  USING (is_developer());

-- =============================================
-- Feature 4: Alert Settings
-- =============================================

CREATE TABLE IF NOT EXISTS public.alert_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  alert_type TEXT NOT NULL,
  threshold NUMERIC NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, alert_type)
);

ALTER TABLE public.alert_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read alert settings" ON public.alert_settings
  FOR SELECT TO authenticated
  USING (organization_id = get_my_org_id());

CREATE POLICY "Owners manage alert settings" ON public.alert_settings
  FOR ALL TO authenticated
  USING (organization_id = get_my_org_id() AND get_my_role() IN ('OWNER', 'DEVELOPER'));

-- Update user_notifications RLS to allow service_role inserts (for edge functions)
-- Add insert policy for service-generated notifications
CREATE POLICY "Service can insert notifications" ON public.user_notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Drop the old restrictive insert policy and replace with a broader one
DROP POLICY IF EXISTS "Insert notifications" ON public.user_notifications;

CREATE POLICY "Users insert own notifications" ON public.user_notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- =============================================
-- Feature 1: GPS / Route Tracking
-- =============================================

CREATE TABLE IF NOT EXISTS public.distributor_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  visit_type TEXT NOT NULL DEFAULT 'route_point',
  customer_id UUID REFERENCES public.customers(id),
  notes TEXT,
  is_synced BOOLEAN NOT NULL DEFAULT true,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dist_locations_user ON public.distributor_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_dist_locations_org_date ON public.distributor_locations(organization_id, recorded_at);

ALTER TABLE public.distributor_locations ENABLE ROW LEVEL SECURITY;

-- Distributors can insert their own locations
CREATE POLICY "Distributors insert own locations" ON public.distributor_locations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Distributors can read their own locations
CREATE POLICY "Distributors read own locations" ON public.distributor_locations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Org managers can read all org locations
CREATE POLICY "Org managers read locations" ON public.distributor_locations
  FOR SELECT TO authenticated
  USING (organization_id = get_my_org_id());

-- Developers can read all
CREATE POLICY "Developers read all locations" ON public.distributor_locations
  FOR SELECT TO authenticated
  USING (is_developer());
