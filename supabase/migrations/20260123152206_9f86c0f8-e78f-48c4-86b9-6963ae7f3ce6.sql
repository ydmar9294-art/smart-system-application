-- جدول المشتريات (purchases) لتتبع شراء المواد
CREATE TABLE public.purchases (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL,
    product_id UUID NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    total_price NUMERIC NOT NULL DEFAULT 0,
    supplier_name TEXT,
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- تفعيل RLS للمشتريات
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- سياسات المشتريات
CREATE POLICY "Owners can manage purchases"
ON public.purchases
FOR ALL
USING ((organization_id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'OWNER'::user_role))
WITH CHECK ((organization_id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'OWNER'::user_role));

CREATE POLICY "Users can view purchases in their org"
ON public.purchases
FOR SELECT
USING ((organization_id = get_user_organization_id(auth.uid())) OR has_role(auth.uid(), 'DEVELOPER'::user_role));

-- جدول تسليمات الموزعين (deliveries)
CREATE TABLE public.deliveries (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL,
    distributor_id UUID,
    distributor_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- جدول تفاصيل التسليمات
CREATE TABLE public.delivery_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    delivery_id UUID NOT NULL,
    product_id UUID NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- تفعيل RLS للتسليمات
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;

-- سياسات التسليمات
CREATE POLICY "Owners can manage deliveries"
ON public.deliveries
FOR ALL
USING ((organization_id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'OWNER'::user_role))
WITH CHECK ((organization_id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'OWNER'::user_role));

CREATE POLICY "Users can view deliveries"
ON public.deliveries
FOR SELECT
USING ((organization_id = get_user_organization_id(auth.uid())) OR has_role(auth.uid(), 'DEVELOPER'::user_role));

CREATE POLICY "Users can view delivery items"
ON public.delivery_items
FOR SELECT
USING (EXISTS (SELECT 1 FROM deliveries d WHERE d.id = delivery_items.delivery_id AND d.organization_id = get_user_organization_id(auth.uid())));

CREATE POLICY "Owners can manage delivery items"
ON public.delivery_items
FOR ALL
USING (EXISTS (SELECT 1 FROM deliveries d WHERE d.id = delivery_items.delivery_id AND d.organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'OWNER'::user_role)))
WITH CHECK (EXISTS (SELECT 1 FROM deliveries d WHERE d.id = delivery_items.delivery_id AND d.organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'OWNER'::user_role)));

-- جدول الموظفين المعلقين (pending_employees)
CREATE TABLE public.pending_employees (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    role user_role NOT NULL DEFAULT 'EMPLOYEE',
    employee_type employee_type NOT NULL,
    activation_code TEXT NOT NULL UNIQUE,
    is_used BOOLEAN NOT NULL DEFAULT false,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- تفعيل RLS للموظفين المعلقين
ALTER TABLE public.pending_employees ENABLE ROW LEVEL SECURITY;

-- سياسات الموظفين المعلقين
CREATE POLICY "Owners can manage pending employees"
ON public.pending_employees
FOR ALL
USING ((organization_id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'OWNER'::user_role))
WITH CHECK ((organization_id = get_user_organization_id(auth.uid())) AND has_role(auth.uid(), 'OWNER'::user_role));

CREATE POLICY "Anyone can view pending employees for activation"
ON public.pending_employees
FOR SELECT
USING (true);

-- دالة إضافة مشتريات
CREATE OR REPLACE FUNCTION public.add_purchase_rpc(
    p_product_id UUID,
    p_quantity INTEGER,
    p_unit_price NUMERIC,
    p_supplier_name TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_org_id UUID;
    v_purchase_id UUID;
    v_product_name TEXT;
BEGIN
    v_org_id := public.get_user_organization_id(auth.uid());
    
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'No organization found';
    END IF;
    
    -- Get product name
    SELECT name INTO v_product_name FROM public.products WHERE id = p_product_id;
    
    -- Insert purchase
    INSERT INTO public.purchases (organization_id, product_id, product_name, quantity, unit_price, total_price, supplier_name, notes, created_by)
    VALUES (v_org_id, p_product_id, COALESCE(v_product_name, 'Unknown'), p_quantity, p_unit_price, p_quantity * p_unit_price, p_supplier_name, p_notes, auth.uid())
    RETURNING id INTO v_purchase_id;
    
    -- Update product stock (increase)
    UPDATE public.products
    SET stock = stock + p_quantity
    WHERE id = p_product_id;
    
    RETURN v_purchase_id;
END;
$$;

-- دالة تسليم بضاعة للموزع
CREATE OR REPLACE FUNCTION public.create_delivery_rpc(
    p_distributor_name TEXT,
    p_items JSONB,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_org_id UUID;
    v_delivery_id UUID;
    v_item RECORD;
BEGIN
    v_org_id := public.get_user_organization_id(auth.uid());
    
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'No organization found';
    END IF;
    
    -- Create delivery
    INSERT INTO public.deliveries (organization_id, distributor_name, notes, created_by, status)
    VALUES (v_org_id, p_distributor_name, p_notes, auth.uid(), 'completed')
    RETURNING id INTO v_delivery_id;
    
    -- Insert items and update stock
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity INTEGER)
    LOOP
        INSERT INTO public.delivery_items (delivery_id, product_id, product_name, quantity)
        VALUES (v_delivery_id, v_item.product_id, v_item.product_name, v_item.quantity);
        
        -- Decrease product stock
        UPDATE public.products
        SET stock = stock - v_item.quantity
        WHERE id = v_item.product_id;
    END LOOP;
    
    RETURN v_delivery_id;
END;
$$;

-- تحديث دالة إضافة موظف لتخزين البيانات في جدول pending_employees
CREATE OR REPLACE FUNCTION public.add_employee_rpc(p_name text, p_phone text, p_role user_role, p_type employee_type)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_org_id UUID;
    v_code TEXT;
BEGIN
    v_org_id := public.get_user_organization_id(auth.uid());
    
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'No organization found';
    END IF;
    
    -- Generate activation code
    v_code := 'EMP-' || public.generate_license_key();
    
    -- Store pending employee
    INSERT INTO public.pending_employees (organization_id, name, phone, role, employee_type, activation_code, created_by)
    VALUES (v_org_id, p_name, p_phone, p_role, p_type, v_code, auth.uid());
    
    RETURN v_code;
END;
$$;

-- دالة تفعيل حساب الموظف
CREATE OR REPLACE FUNCTION public.activate_employee(p_user_id UUID, p_activation_code TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_pending RECORD;
BEGIN
    -- Find pending employee
    SELECT * INTO v_pending
    FROM public.pending_employees
    WHERE activation_code = p_activation_code AND is_used = false;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Activation code not found or already used';
    END IF;
    
    -- Create profile
    INSERT INTO public.profiles (id, full_name, phone, role, employee_type, organization_id)
    VALUES (p_user_id, v_pending.name, v_pending.phone, v_pending.role, v_pending.employee_type, v_pending.organization_id)
    ON CONFLICT (id) DO UPDATE SET
        full_name = v_pending.name,
        role = v_pending.role,
        employee_type = v_pending.employee_type,
        organization_id = v_pending.organization_id;
    
    -- Add user role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id, v_pending.role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Link to organization
    INSERT INTO public.organization_users (organization_id, user_id, role)
    VALUES (v_pending.organization_id, p_user_id, v_pending.role)
    ON CONFLICT DO NOTHING;
    
    -- Mark as used
    UPDATE public.pending_employees
    SET is_used = true
    WHERE id = v_pending.id;
END;
$$;