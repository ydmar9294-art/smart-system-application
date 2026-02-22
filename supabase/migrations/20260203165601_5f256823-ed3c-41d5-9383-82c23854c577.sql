-- ============================================
-- PHASE 2: CREATE ROLE HIERARCHY VALIDATION FUNCTION
-- ============================================

-- Function to validate role creation hierarchy
CREATE OR REPLACE FUNCTION public.can_create_employee_type(
    p_creator_role user_role,
    p_creator_employee_type employee_type,
    p_target_employee_type employee_type
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Developer cannot create employees directly (only issues licenses)
    IF p_creator_role = 'DEVELOPER' THEN
        RETURN false;
    END IF;
    
    -- Owner can create: SALES_MANAGER, ACCOUNTANT
    IF p_creator_role = 'OWNER' THEN
        RETURN p_target_employee_type IN ('SALES_MANAGER', 'ACCOUNTANT');
    END IF;
    
    -- Employee with SALES_MANAGER type can create: FIELD_AGENT (distributors), WAREHOUSE_KEEPER
    IF p_creator_role = 'EMPLOYEE' AND p_creator_employee_type = 'SALES_MANAGER' THEN
        RETURN p_target_employee_type IN ('FIELD_AGENT', 'WAREHOUSE_KEEPER');
    END IF;
    
    -- All other cases: not allowed
    RETURN false;
END;
$$;

-- ============================================
-- PHASE 3: UPDATE ADD_EMPLOYEE_RPC WITH HIERARCHY ENFORCEMENT
-- ============================================

CREATE OR REPLACE FUNCTION public.add_employee_rpc(
    p_name text, 
    p_phone text, 
    p_role user_role, 
    p_type employee_type
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_org_id UUID;
    v_code TEXT;
    v_creator_role user_role;
    v_creator_employee_type employee_type;
BEGIN
    -- Get creator's organization
    v_org_id := public.get_user_organization_id(auth.uid());
    
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'No organization found';
    END IF;
    
    -- Get creator's role and employee type
    SELECT role, employee_type INTO v_creator_role, v_creator_employee_type
    FROM public.profiles
    WHERE id = auth.uid();
    
    -- Validate hierarchy: can this user create this employee type?
    IF NOT public.can_create_employee_type(v_creator_role, v_creator_employee_type, p_type) THEN
        RAISE EXCEPTION 'Unauthorized: You cannot create employees of type %', p_type;
    END IF;
    
    -- Generate activation code
    v_code := 'EMP-' || public.generate_license_key();
    
    -- Store pending employee
    INSERT INTO public.pending_employees (
        organization_id, 
        name, 
        phone, 
        role, 
        employee_type, 
        activation_code, 
        created_by
    )
    VALUES (
        v_org_id, 
        p_name, 
        p_phone, 
        p_role, 
        p_type, 
        v_code, 
        auth.uid()
    );
    
    RETURN v_code;
END;
$$;

-- ============================================
-- PHASE 4: CREATE HELPER FUNCTION TO CHECK EMPLOYEE TYPE
-- ============================================

CREATE OR REPLACE FUNCTION public.has_employee_type(_user_id uuid, _type employee_type)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = _user_id AND employee_type = _type
    )
$$;

-- ============================================
-- PHASE 5: UPDATE RLS POLICIES FOR WAREHOUSE KEEPER
-- ============================================

-- Products: Warehouse Keepers can manage products
DROP POLICY IF EXISTS "Warehouse keepers can manage products" ON public.products;
CREATE POLICY "Warehouse keepers can manage products"
ON public.products FOR ALL
USING (
    (organization_id = get_user_organization_id(auth.uid())) 
    AND has_employee_type(auth.uid(), 'WAREHOUSE_KEEPER')
)
WITH CHECK (
    (organization_id = get_user_organization_id(auth.uid())) 
    AND has_employee_type(auth.uid(), 'WAREHOUSE_KEEPER')
);

-- Deliveries: Warehouse Keepers can manage deliveries
DROP POLICY IF EXISTS "Warehouse keepers can manage deliveries" ON public.deliveries;
CREATE POLICY "Warehouse keepers can manage deliveries"
ON public.deliveries FOR ALL
USING (
    (organization_id = get_user_organization_id(auth.uid())) 
    AND has_employee_type(auth.uid(), 'WAREHOUSE_KEEPER')
)
WITH CHECK (
    (organization_id = get_user_organization_id(auth.uid())) 
    AND has_employee_type(auth.uid(), 'WAREHOUSE_KEEPER')
);

-- Delivery items: Warehouse Keepers can manage
DROP POLICY IF EXISTS "Warehouse keepers can manage delivery items" ON public.delivery_items;
CREATE POLICY "Warehouse keepers can manage delivery items"
ON public.delivery_items FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM deliveries d
        WHERE d.id = delivery_items.delivery_id
        AND d.organization_id = get_user_organization_id(auth.uid())
        AND has_employee_type(auth.uid(), 'WAREHOUSE_KEEPER')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM deliveries d
        WHERE d.id = delivery_items.delivery_id
        AND d.organization_id = get_user_organization_id(auth.uid())
        AND has_employee_type(auth.uid(), 'WAREHOUSE_KEEPER')
    )
);

-- Purchases: Warehouse Keepers can manage
DROP POLICY IF EXISTS "Warehouse keepers can manage purchases" ON public.purchases;
CREATE POLICY "Warehouse keepers can manage purchases"
ON public.purchases FOR ALL
USING (
    (organization_id = get_user_organization_id(auth.uid())) 
    AND has_employee_type(auth.uid(), 'WAREHOUSE_KEEPER')
)
WITH CHECK (
    (organization_id = get_user_organization_id(auth.uid())) 
    AND has_employee_type(auth.uid(), 'WAREHOUSE_KEEPER')
);

-- Purchase returns: Warehouse Keepers can manage
DROP POLICY IF EXISTS "Warehouse keepers can manage purchase returns" ON public.purchase_returns;
CREATE POLICY "Warehouse keepers can manage purchase returns"
ON public.purchase_returns FOR ALL
USING (
    (organization_id = get_user_organization_id(auth.uid())) 
    AND has_employee_type(auth.uid(), 'WAREHOUSE_KEEPER')
)
WITH CHECK (
    (organization_id = get_user_organization_id(auth.uid())) 
    AND has_employee_type(auth.uid(), 'WAREHOUSE_KEEPER')
);

-- Purchase return items: Warehouse Keepers can manage
DROP POLICY IF EXISTS "Warehouse keepers can manage purchase return items" ON public.purchase_return_items;
CREATE POLICY "Warehouse keepers can manage purchase return items"
ON public.purchase_return_items FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM purchase_returns pr
        WHERE pr.id = purchase_return_items.return_id
        AND pr.organization_id = get_user_organization_id(auth.uid())
        AND has_employee_type(auth.uid(), 'WAREHOUSE_KEEPER')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM purchase_returns pr
        WHERE pr.id = purchase_return_items.return_id
        AND pr.organization_id = get_user_organization_id(auth.uid())
        AND has_employee_type(auth.uid(), 'WAREHOUSE_KEEPER')
    )
);

-- Distributor inventory: Warehouse Keepers can manage all distributor inventory in org
DROP POLICY IF EXISTS "Warehouse keepers can manage all distributor inventory" ON public.distributor_inventory;
CREATE POLICY "Warehouse keepers can manage all distributor inventory"
ON public.distributor_inventory FOR ALL
USING (
    (organization_id = get_user_organization_id(auth.uid())) 
    AND has_employee_type(auth.uid(), 'WAREHOUSE_KEEPER')
)
WITH CHECK (
    (organization_id = get_user_organization_id(auth.uid())) 
    AND has_employee_type(auth.uid(), 'WAREHOUSE_KEEPER')
);

-- Stock movements: Warehouse Keepers can manage
DROP POLICY IF EXISTS "Warehouse keepers can manage stock movements" ON public.stock_movements;
CREATE POLICY "Warehouse keepers can manage stock movements"
ON public.stock_movements FOR ALL
USING (
    (organization_id = get_user_organization_id(auth.uid())) 
    AND has_employee_type(auth.uid(), 'WAREHOUSE_KEEPER')
)
WITH CHECK (
    (organization_id = get_user_organization_id(auth.uid())) 
    AND has_employee_type(auth.uid(), 'WAREHOUSE_KEEPER')
);

-- ============================================
-- PHASE 6: RLS POLICIES FOR SALES MANAGER
-- ============================================

-- Pending employees: Sales Managers can manage (for creating distributors/warehouse keepers)
DROP POLICY IF EXISTS "Sales managers can manage pending employees" ON public.pending_employees;
CREATE POLICY "Sales managers can manage pending employees"
ON public.pending_employees FOR ALL
USING (
    (organization_id = get_user_organization_id(auth.uid())) 
    AND has_employee_type(auth.uid(), 'SALES_MANAGER')
)
WITH CHECK (
    (organization_id = get_user_organization_id(auth.uid())) 
    AND has_employee_type(auth.uid(), 'SALES_MANAGER')
);

-- Sales: Sales Managers can view all sales in org
DROP POLICY IF EXISTS "Sales managers can view all sales" ON public.sales;
CREATE POLICY "Sales managers can view all sales"
ON public.sales FOR SELECT
USING (
    (organization_id = get_user_organization_id(auth.uid())) 
    AND has_employee_type(auth.uid(), 'SALES_MANAGER')
);

-- Collections: Sales Managers can view all collections
DROP POLICY IF EXISTS "Sales managers can view all collections" ON public.collections;
CREATE POLICY "Sales managers can view all collections"
ON public.collections FOR SELECT
USING (
    (organization_id = get_user_organization_id(auth.uid())) 
    AND has_employee_type(auth.uid(), 'SALES_MANAGER')
);

-- Customers: Sales Managers can view all customers
DROP POLICY IF EXISTS "Sales managers can view all customers" ON public.customers;
CREATE POLICY "Sales managers can view all customers"
ON public.customers FOR SELECT
USING (
    (organization_id = get_user_organization_id(auth.uid())) 
    AND has_employee_type(auth.uid(), 'SALES_MANAGER')
);

-- Sales returns: Sales Managers can view
DROP POLICY IF EXISTS "Sales managers can view sales returns" ON public.sales_returns;
CREATE POLICY "Sales managers can view sales returns"
ON public.sales_returns FOR SELECT
USING (
    (organization_id = get_user_organization_id(auth.uid())) 
    AND has_employee_type(auth.uid(), 'SALES_MANAGER')
);

-- Distributor inventory: Sales Managers can view
DROP POLICY IF EXISTS "Sales managers can view distributor inventory" ON public.distributor_inventory;
CREATE POLICY "Sales managers can view distributor inventory"
ON public.distributor_inventory FOR SELECT
USING (
    (organization_id = get_user_organization_id(auth.uid())) 
    AND has_employee_type(auth.uid(), 'SALES_MANAGER')
);

-- Profiles: Sales Managers can view org profiles (for managing distributors)
DROP POLICY IF EXISTS "Sales managers can view org profiles" ON public.profiles;
CREATE POLICY "Sales managers can view org profiles"
ON public.profiles FOR SELECT
USING (
    (organization_id = get_user_organization_id(auth.uid())) 
    AND has_employee_type(auth.uid(), 'SALES_MANAGER')
);

-- ============================================
-- PHASE 7: UPDATE CREATE_DELIVERY_RPC FOR WAREHOUSE KEEPER
-- ============================================

CREATE OR REPLACE FUNCTION public.create_delivery_rpc(
    p_distributor_name text, 
    p_items jsonb, 
    p_notes text DEFAULT NULL::text, 
    p_distributor_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_org_id UUID;
    v_delivery_id UUID;
    v_item RECORD;
    v_product RECORD;
    v_distributor_name TEXT;
    v_creator_role user_role;
    v_creator_employee_type employee_type;
BEGIN
    -- Get creator's role and employee type
    SELECT role, employee_type INTO v_creator_role, v_creator_employee_type
    FROM public.profiles
    WHERE id = auth.uid();
    
    -- Only owners and warehouse keepers can create deliveries
    IF NOT (v_creator_role = 'OWNER' OR v_creator_employee_type = 'WAREHOUSE_KEEPER') THEN
        RAISE EXCEPTION 'Unauthorized: Only owners and warehouse keepers can create deliveries';
    END IF;

    -- Get user's organization
    v_org_id := public.get_user_organization_id(auth.uid());
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'No organization found';
    END IF;

    -- Distributor must be a real user (required for inventory isolation)
    IF p_distributor_id IS NULL THEN
        RAISE EXCEPTION 'Distributor is required';
    END IF;

    -- Validate distributor belongs to organization and fetch official name
    SELECT full_name
        INTO v_distributor_name
    FROM public.profiles
    WHERE id = p_distributor_id
        AND organization_id = v_org_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Distributor does not belong to your organization';
    END IF;

    -- Validate items is an array
    IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' THEN
        RAISE EXCEPTION 'Items must be a valid array';
    END IF;

    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'At least one item is required';
    END IF;

    -- Validate each item and check organization ownership
    FOR v_item IN 
        SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity INTEGER)
    LOOP
        IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
            RAISE EXCEPTION 'Quantity must be positive for all items';
        END IF;
        
        -- Get product and lock row
        SELECT * INTO v_product
        FROM public.products
        WHERE id = v_item.product_id
        AND organization_id = v_org_id
        FOR UPDATE;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product not found or access denied: %', COALESCE(v_item.product_name, 'Unknown');
        END IF;
        
        IF v_product.stock < v_item.quantity THEN
            RAISE EXCEPTION 'Insufficient stock for product: %. Available: %, Requested: %', 
                v_product.name, v_product.stock, v_item.quantity;
        END IF;
    END LOOP;

    -- Create delivery
    INSERT INTO public.deliveries (
        organization_id, 
        distributor_id, 
        distributor_name, 
        notes, 
        status, 
        created_by
    )
    VALUES (
        v_org_id, 
        p_distributor_id, 
        v_distributor_name, 
        NULLIF(trim(COALESCE(p_notes, '')), ''), 
        'pending', 
        auth.uid()
    )
    RETURNING id INTO v_delivery_id;

    -- Insert items and update stock
    FOR v_item IN 
        SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity INTEGER)
    LOOP
        INSERT INTO public.delivery_items (delivery_id, product_id, product_name, quantity)
        VALUES (v_delivery_id, v_item.product_id, v_item.product_name, v_item.quantity);
        
        -- Deduct from central stock
        UPDATE public.products
        SET stock = stock - v_item.quantity
        WHERE id = v_item.product_id
        AND organization_id = v_org_id;
    END LOOP;

    RETURN v_delivery_id;
END;
$$;

-- ============================================
-- PHASE 8: ADD INDEXES FOR PERFORMANCE
-- ============================================

-- Index for employee_type lookups
CREATE INDEX IF NOT EXISTS idx_profiles_employee_type ON public.profiles(employee_type);
CREATE INDEX IF NOT EXISTS idx_profiles_org_employee_type ON public.profiles(organization_id, employee_type);

-- Index for pending_employees created_by (for hierarchy tracking)
CREATE INDEX IF NOT EXISTS idx_pending_employees_created_by ON public.pending_employees(created_by);