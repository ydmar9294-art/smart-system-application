
-- ==========================================
-- MISSING TABLES AND FUNCTIONS
-- ==========================================

-- 1. Sales Returns
CREATE TABLE public.sales_returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  sale_id UUID REFERENCES public.sales(id),
  customer_name TEXT NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sales_returns_org ON public.sales_returns(organization_id);

CREATE POLICY "Org members can read sales returns" ON public.sales_returns FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Org members can insert sales returns" ON public.sales_returns FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Developers can read all sales returns" ON public.sales_returns FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'DEVELOPER')
);

-- 2. Invoice Snapshots
CREATE TABLE public.invoice_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  invoice_type TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  reference_id TEXT,
  customer_id UUID,
  customer_name TEXT NOT NULL,
  created_by UUID,
  created_by_name TEXT,
  grand_total NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  remaining NUMERIC DEFAULT 0,
  payment_type TEXT,
  items JSONB DEFAULT '[]'::JSONB,
  notes TEXT,
  reason TEXT,
  org_name TEXT,
  legal_info JSONB,
  invoice_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invoice_snapshots ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_invoice_snapshots_created_by ON public.invoice_snapshots(created_by);
CREATE INDEX idx_invoice_snapshots_org ON public.invoice_snapshots(organization_id);

CREATE POLICY "Users can read own invoice snapshots" ON public.invoice_snapshots FOR SELECT USING (
  created_by = auth.uid()
);
CREATE POLICY "Users can insert own invoice snapshots" ON public.invoice_snapshots FOR INSERT WITH CHECK (
  created_by = auth.uid()
);

-- 3. Stock Movements
CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INT NOT NULL,
  movement_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  destination_type TEXT NOT NULL,
  source_id UUID,
  destination_id UUID,
  notes TEXT,
  reference_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_stock_movements_org ON public.stock_movements(organization_id);

CREATE POLICY "Org members can read stock movements" ON public.stock_movements FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Org members can insert stock movements" ON public.stock_movements FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

-- ==========================================
-- MISSING RPC FUNCTIONS
-- ==========================================

-- Activate employee via OAuth
CREATE OR REPLACE FUNCTION public.activate_employee_oauth(
  p_user_id UUID,
  p_google_id TEXT,
  p_email TEXT,
  p_full_name TEXT,
  p_activation_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending RECORD;
BEGIN
  -- Find pending employee
  SELECT * INTO v_pending FROM pending_employees 
  WHERE activation_code = p_activation_code AND is_used = false;
  
  IF v_pending IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'كود التفعيل غير صالح أو مستخدم');
  END IF;
  
  -- Create/update profile
  INSERT INTO profiles (id, full_name, email, phone, role, employee_type, organization_id, license_key)
  VALUES (
    p_user_id, p_full_name, p_email, v_pending.phone,
    v_pending.role, v_pending.employee_type, v_pending.organization_id,
    (SELECT license_key FROM profiles WHERE organization_id = v_pending.organization_id AND role = 'OWNER' LIMIT 1)
  )
  ON CONFLICT (id) DO UPDATE SET 
    full_name = p_full_name, email = p_email,
    role = v_pending.role, employee_type = v_pending.employee_type,
    organization_id = v_pending.organization_id,
    license_key = (SELECT license_key FROM profiles WHERE organization_id = v_pending.organization_id AND role = 'OWNER' LIMIT 1);
  
  -- Mark code as used
  UPDATE pending_employees SET is_used = true, activated_at = now(), activated_by = p_user_id
  WHERE id = v_pending.id;
  
  RETURN jsonb_build_object('success', true, 'message', 'تم تفعيل حساب الموظف بنجاح');
END;
$$;

-- Activate license via OAuth (owner activation)
CREATE OR REPLACE FUNCTION public.activate_license_oauth(
  p_user_id UUID,
  p_google_id TEXT,
  p_email TEXT,
  p_full_name TEXT,
  p_license_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_license RECORD;
BEGIN
  -- Find license
  SELECT * INTO v_license FROM developer_licenses 
  WHERE "licenseKey" = p_license_key AND status IN ('READY', 'ACTIVE');
  
  IF v_license IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'الترخيص غير صالح أو غير متاح');
  END IF;
  
  -- Check expiry
  IF v_license."expiryDate" IS NOT NULL AND v_license."expiryDate" < now() THEN
    RETURN jsonb_build_object('success', false, 'message', 'الترخيص منتهي الصلاحية');
  END IF;
  
  -- Create/update owner profile
  INSERT INTO profiles (id, full_name, email, role, organization_id, license_key)
  VALUES (p_user_id, p_full_name, p_email, 'OWNER', v_license.organization_id, p_license_key)
  ON CONFLICT (id) DO UPDATE SET 
    full_name = p_full_name, email = p_email,
    role = 'OWNER', organization_id = v_license.organization_id,
    license_key = p_license_key;
  
  -- Activate license
  UPDATE developer_licenses SET status = 'ACTIVE', "ownerId" = p_user_id 
  WHERE id = v_license.id AND status = 'READY';
  
  RETURN jsonb_build_object('success', true, 'message', 'تم تفعيل الترخيص بنجاح');
END;
$$;

-- Transfer to main warehouse RPC
CREATE OR REPLACE FUNCTION public.transfer_to_main_warehouse_rpc(
  p_items JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_qty INT;
BEGIN
  v_user_id := auth.uid();
  SELECT organization_id INTO v_org_id FROM profiles WHERE id = v_user_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::INT;
    
    -- Deduct from distributor inventory
    UPDATE distributor_inventory 
    SET quantity = quantity - v_qty, updated_at = now()
    WHERE distributor_id = v_user_id AND product_id = v_product_id AND organization_id = v_org_id;
    
    -- Add back to main stock
    UPDATE products SET stock = stock + v_qty WHERE id = v_product_id AND organization_id = v_org_id;
    
    -- Log stock movement
    INSERT INTO stock_movements (organization_id, product_id, quantity, movement_type, source_type, destination_type, source_id, destination_id, created_by)
    VALUES (v_org_id, v_product_id, v_qty, 'TRANSFER', 'distributor', 'central', v_user_id, NULL, v_user_id);
  END LOOP;
END;
$$;

-- ==========================================
-- FIX PERMISSIVE RLS POLICIES (WITH CHECK true)
-- ==========================================

-- Fix sale_items insert policy
DROP POLICY IF EXISTS "Org members can insert sale items" ON public.sale_items;
CREATE POLICY "Org members can insert sale items" ON public.sale_items FOR INSERT WITH CHECK (
  sale_id IN (SELECT id FROM public.sales WHERE organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
);

-- Fix delivery_items insert policy
DROP POLICY IF EXISTS "Insert delivery items" ON public.delivery_items;
CREATE POLICY "Org members can insert delivery items" ON public.delivery_items FOR INSERT WITH CHECK (
  delivery_id IN (SELECT id FROM public.deliveries WHERE organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
);

-- Fix purchase_return_items insert policy
DROP POLICY IF EXISTS "Insert purchase return items" ON public.purchase_return_items;
CREATE POLICY "Org members can insert purchase return items" ON public.purchase_return_items FOR INSERT WITH CHECK (
  return_id IN (SELECT id FROM public.purchase_returns WHERE organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
);

-- Fix profiles insert policy
DROP POLICY IF EXISTS "Service can insert profiles" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());

-- Add realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_movements;
