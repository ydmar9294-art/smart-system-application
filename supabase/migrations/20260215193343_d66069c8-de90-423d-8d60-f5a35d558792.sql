
-- KPI Snapshots table for historical tracking
CREATE TABLE public.kpi_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  employee_id uuid NOT NULL,
  employee_name text NOT NULL,
  employee_type text NOT NULL,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  
  -- Distributor KPIs
  total_sales_amount numeric DEFAULT 0,
  sales_count integer DEFAULT 0,
  total_collections numeric DEFAULT 0,
  collections_count integer DEFAULT 0,
  collection_rate numeric DEFAULT 0,
  return_amount numeric DEFAULT 0,
  return_rate numeric DEFAULT 0,
  new_customers_count integer DEFAULT 0,
  avg_invoice_value numeric DEFAULT 0,
  cash_sales_ratio numeric DEFAULT 0,
  
  -- Warehouse Keeper KPIs
  deliveries_count integer DEFAULT 0,
  delivered_items_count integer DEFAULT 0,
  delivery_fulfillment_rate numeric DEFAULT 0,
  purchases_count integer DEFAULT 0,
  purchase_returns_amount numeric DEFAULT 0,
  stock_movements_count integer DEFAULT 0,
  inventory_accuracy numeric DEFAULT 0,
  
  -- Score
  overall_score numeric DEFAULT 0,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(organization_id, employee_id, snapshot_date)
);

-- Indexes
CREATE INDEX idx_kpi_snapshots_org_date ON public.kpi_snapshots(organization_id, snapshot_date DESC);
CREATE INDEX idx_kpi_snapshots_employee ON public.kpi_snapshots(employee_id, snapshot_date DESC);

-- Enable RLS
ALTER TABLE public.kpi_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Owners can manage KPI snapshots"
ON public.kpi_snapshots FOR ALL
USING (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'OWNER'::user_role))
WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'OWNER'::user_role));

CREATE POLICY "Sales managers can view KPI snapshots"
ON public.kpi_snapshots FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()) AND has_employee_type(auth.uid(), 'SALES_MANAGER'::employee_type));

CREATE POLICY "Developers can view KPI snapshots"
ON public.kpi_snapshots FOR SELECT
USING (has_role(auth.uid(), 'DEVELOPER'::user_role));

CREATE POLICY "Employees can view own KPI snapshots"
ON public.kpi_snapshots FOR SELECT
USING (employee_id = auth.uid() AND organization_id = get_user_organization_id(auth.uid()));
