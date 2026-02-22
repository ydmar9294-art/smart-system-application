-- =====================================================
-- إصلاح المشاكل الحرجة: المخزون، اسم الموظف، تتبع الحركات
-- =====================================================

-- 1. إنشاء جدول تتبع حركات المخزون (Stock Movements)
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    product_id UUID NOT NULL REFERENCES public.products(id),
    source_type TEXT NOT NULL CHECK (source_type IN ('CENTRAL', 'DISTRIBUTOR')),
    source_id UUID, -- NULL للمخزون المركزي، أو distributor_id للموزع
    destination_type TEXT NOT NULL CHECK (destination_type IN ('CENTRAL', 'DISTRIBUTOR', 'CUSTOMER')),
    destination_id UUID, -- NULL للمخزون المركزي، أو distributor_id للموزع، أو customer_id للعميل
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    movement_type TEXT NOT NULL CHECK (movement_type IN ('TRANSFER', 'SALE', 'RETURN', 'PURCHASE', 'ADJUSTMENT')),
    reference_id UUID, -- رقم الفاتورة أو التسليم المرجعي
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_stock_movements_org ON public.stock_movements(organization_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_source ON public.stock_movements(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_dest ON public.stock_movements(destination_type, destination_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON public.stock_movements(created_at DESC);

-- تفعيل RLS
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان
CREATE POLICY "Deny anon access to stock_movements"
ON public.stock_movements FOR ALL TO anon USING (false);

CREATE POLICY "Users can view org stock movements"
ON public.stock_movements FOR SELECT TO authenticated
USING (
    organization_id = public.get_user_organization_id(auth.uid())
    OR public.has_role(auth.uid(), 'DEVELOPER')
);

CREATE POLICY "Owners can manage stock movements"
ON public.stock_movements FOR ALL TO authenticated
USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.has_role(auth.uid(), 'OWNER')
)
WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.has_role(auth.uid(), 'OWNER')
);

-- 2. إصلاح دالة activate_employee_oauth لمنع تجاوز اسم الموظف من Google
CREATE OR REPLACE FUNCTION public.activate_employee_oauth(
    p_user_id uuid, 
    p_google_id text, 
    p_email text, 
    p_full_name text,  -- يُتجاهل الآن - لا يستخدم
    p_activation_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending RECORD;
BEGIN
  -- Validate activation code
  IF p_activation_code IS NULL OR trim(p_activation_code) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CODE', 'message', 'كود التفعيل مطلوب');
  END IF;
  
  -- Find pending employee with expiration check
  SELECT * INTO v_pending
  FROM public.pending_employees
  WHERE activation_code = trim(p_activation_code)
  AND is_used = false
  AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE;
  
  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.pending_employees WHERE activation_code = trim(p_activation_code) AND is_used = true) THEN
      RETURN jsonb_build_object('success', false, 'error', 'CODE_ALREADY_USED', 'message', 'كود التفعيل مستخدم بالفعل');
    END IF;
    IF EXISTS (SELECT 1 FROM public.pending_employees WHERE activation_code = trim(p_activation_code) AND expires_at <= now()) THEN
      RETURN jsonb_build_object('success', false, 'error', 'CODE_EXPIRED', 'message', 'انتهت صلاحية كود التفعيل');
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'CODE_NOT_FOUND', 'message', 'كود التفعيل غير موجود');
  END IF;
  
  -- إنشاء الملف الشخصي - استخدام اسم الموظف المُدخل من المالك فقط (v_pending.name)
  -- بيانات Google تستخدم للمصادقة فقط وليس لتحديث الاسم
  INSERT INTO public.profiles (id, full_name, phone, role, employee_type, organization_id, google_id, email, email_verified)
  VALUES (
    p_user_id, 
    v_pending.name,  -- الاسم الرسمي المُدخل من المالك فقط
    v_pending.phone, 
    v_pending.role, 
    v_pending.employee_type, 
    v_pending.organization_id, 
    p_google_id, 
    p_email, 
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = v_pending.name,  -- دائماً استخدام اسم الموظف المُدخل من المالك
    role = v_pending.role,
    employee_type = v_pending.employee_type,
    organization_id = v_pending.organization_id,
    google_id = p_google_id,
    email = p_email,
    email_verified = true,
    updated_at = now();
  
  -- Add user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, v_pending.role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Link to organization
  INSERT INTO public.organization_users (organization_id, user_id, role)
  VALUES (v_pending.organization_id, p_user_id, v_pending.role)
  ON CONFLICT DO NOTHING;
  
  -- Mark as used (single-use enforcement)
  UPDATE public.pending_employees
  SET is_used = true
  WHERE id = v_pending.id;
  
  RETURN jsonb_build_object(
    'success', true,
    'role', v_pending.role::text,
    'employee_type', v_pending.employee_type::text,
    'organization_id', v_pending.organization_id,
    'full_name', v_pending.name  -- إرجاع الاسم الرسمي
  );
END;
$$;

-- 3. إنشاء دالة لتسجيل حركة المخزون عند التسليم
CREATE OR REPLACE FUNCTION public.log_delivery_stock_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_delivery RECORD;
BEGIN
    -- Get delivery info
    SELECT * INTO v_delivery 
    FROM public.deliveries 
    WHERE id = NEW.delivery_id;
    
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;
    
    -- Log movement: CENTRAL -> DISTRIBUTOR
    INSERT INTO public.stock_movements (
        organization_id,
        product_id,
        source_type,
        source_id,
        destination_type,
        destination_id,
        quantity,
        movement_type,
        reference_id,
        created_by
    )
    VALUES (
        v_delivery.organization_id,
        NEW.product_id,
        'CENTRAL',
        NULL,
        'DISTRIBUTOR',
        v_delivery.distributor_id,
        NEW.quantity,
        'TRANSFER',
        v_delivery.id,
        v_delivery.created_by
    );
    
    RETURN NEW;
END;
$$;

-- إنشاء Trigger لتسجيل حركات التسليم
DROP TRIGGER IF EXISTS trigger_log_delivery_movement ON public.delivery_items;
CREATE TRIGGER trigger_log_delivery_movement
    AFTER INSERT ON public.delivery_items
    FOR EACH ROW
    EXECUTE FUNCTION public.log_delivery_stock_movement();

-- 4. تحديث دالة البيع لتخصم من مخزون الموزع وتسجل الحركة
CREATE OR REPLACE FUNCTION public.create_sale_rpc(p_customer_id uuid, p_items jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_sale_id UUID;
  v_grand_total NUMERIC := 0;
  v_customer RECORD;
  v_product RECORD;
  v_dist_inv RECORD;
  v_item RECORD;
  v_is_distributor BOOLEAN := false;
BEGIN
  v_user_id := auth.uid();
  v_org_id := public.get_user_organization_id(v_user_id);
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found';
  END IF;
  
  -- التحقق إذا كان المستخدم موزع
  SELECT employee_type = 'FIELD_AGENT' INTO v_is_distributor
  FROM public.profiles
  WHERE id = v_user_id;
  
  -- Validate items is an array
  IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' THEN
    RAISE EXCEPTION 'Items must be a valid array';
  END IF;
  
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one item is required';
  END IF;
  
  -- Get customer WITH organization check
  SELECT * INTO v_customer 
  FROM public.customers 
  WHERE id = p_customer_id
  AND organization_id = v_org_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found or access denied';
  END IF;
  
  -- Validate each item and calculate total
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity INTEGER, unit_price NUMERIC)
  LOOP
    IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Quantity must be positive for all items';
    END IF;
    
    IF v_item.unit_price IS NULL OR v_item.unit_price < 0 THEN
      RAISE EXCEPTION 'Unit price cannot be negative';
    END IF;
    
    IF v_is_distributor THEN
      -- للموزع: التحقق من مخزون الموزع الخاص
      SELECT * INTO v_dist_inv
      FROM public.distributor_inventory
      WHERE distributor_id = v_user_id
      AND product_id = v_item.product_id
      FOR UPDATE;
      
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not in your inventory: %', COALESCE(v_item.product_name, 'Unknown');
      END IF;
      
      IF v_dist_inv.quantity < v_item.quantity THEN
        RAISE EXCEPTION 'Insufficient stock in your inventory for: %. Available: %, Requested: %', 
            v_dist_inv.product_name, v_dist_inv.quantity, v_item.quantity;
      END IF;
    ELSE
      -- للمالك: التحقق من المخزون المركزي
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
    END IF;
    
    v_grand_total := v_grand_total + (v_item.quantity * v_item.unit_price);
  END LOOP;
  
  -- Create sale
  INSERT INTO public.sales (organization_id, customer_id, customer_name, grand_total, remaining, created_by)
  VALUES (v_org_id, p_customer_id, v_customer.name, v_grand_total, v_grand_total, v_user_id)
  RETURNING id INTO v_sale_id;
  
  -- Insert items and update appropriate stock
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity INTEGER, unit_price NUMERIC)
  LOOP
    INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (v_sale_id, v_item.product_id, v_item.product_name, v_item.quantity, v_item.unit_price, v_item.quantity * v_item.unit_price);
    
    IF v_is_distributor THEN
      -- خصم من مخزون الموزع
      UPDATE public.distributor_inventory
      SET quantity = quantity - v_item.quantity,
          updated_at = now()
      WHERE distributor_id = v_user_id
      AND product_id = v_item.product_id;
      
      -- تسجيل حركة المخزون: DISTRIBUTOR -> CUSTOMER
      INSERT INTO public.stock_movements (
          organization_id, product_id, source_type, source_id,
          destination_type, destination_id, quantity, movement_type,
          reference_id, created_by
      )
      VALUES (
          v_org_id, v_item.product_id, 'DISTRIBUTOR', v_user_id,
          'CUSTOMER', p_customer_id, v_item.quantity, 'SALE',
          v_sale_id, v_user_id
      );
    ELSE
      -- خصم من المخزون المركزي
      UPDATE public.products
      SET stock = stock - v_item.quantity
      WHERE id = v_item.product_id
      AND organization_id = v_org_id;
      
      -- تسجيل حركة المخزون: CENTRAL -> CUSTOMER
      INSERT INTO public.stock_movements (
          organization_id, product_id, source_type, source_id,
          destination_type, destination_id, quantity, movement_type,
          reference_id, created_by
      )
      VALUES (
          v_org_id, v_item.product_id, 'CENTRAL', NULL,
          'CUSTOMER', p_customer_id, v_item.quantity, 'SALE',
          v_sale_id, v_user_id
      );
    END IF;
  END LOOP;
  
  -- Update customer balance
  UPDATE public.customers
  SET balance = balance + v_grand_total
  WHERE id = p_customer_id
  AND organization_id = v_org_id;
  
  RETURN v_sale_id;
END;
$$;

-- 5. تحديث دالة مرتجع البيع لتُرجع المخزون للمصدر الصحيح
CREATE OR REPLACE FUNCTION public.create_sales_return_rpc(p_sale_id uuid, p_items jsonb, p_reason text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_return_id UUID;
  v_sale RECORD;
  v_item RECORD;
  v_product RECORD;
  v_total NUMERIC := 0;
  v_is_distributor BOOLEAN := false;
BEGIN
  v_user_id := auth.uid();
  v_org_id := public.get_user_organization_id(v_user_id);
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found';
  END IF;
  
  -- التحقق إذا كان المستخدم موزع
  SELECT employee_type = 'FIELD_AGENT' INTO v_is_distributor
  FROM public.profiles
  WHERE id = v_user_id;
  
  -- Validate items
  IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one item is required';
  END IF;
  
  -- Get sale with organization check
  SELECT * INTO v_sale
  FROM public.sales
  WHERE id = p_sale_id
  AND organization_id = v_org_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found or access denied';
  END IF;
  
  IF v_sale.is_voided THEN
    RAISE EXCEPTION 'Cannot return items from voided sale';
  END IF;
  
  -- Validate items and calculate total
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity INTEGER, unit_price NUMERIC)
  LOOP
    IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Quantity must be positive for all items';
    END IF;
    
    -- Verify product belongs to organization
    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_item.product_id
    AND organization_id = v_org_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', COALESCE(v_item.product_name, 'Unknown');
    END IF;
    
    v_total := v_total + (v_item.quantity * v_item.unit_price);
  END LOOP;
  
  -- Create sales return
  INSERT INTO public.sales_returns (organization_id, sale_id, customer_id, customer_name, total_amount, reason, created_by)
  VALUES (v_org_id, p_sale_id, v_sale.customer_id, v_sale.customer_name, v_total, NULLIF(trim(COALESCE(p_reason, '')), ''), v_user_id)
  RETURNING id INTO v_return_id;
  
  -- Insert items and update appropriate stock
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity INTEGER, unit_price NUMERIC)
  LOOP
    INSERT INTO public.sales_return_items (return_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (v_return_id, v_item.product_id, v_item.product_name, v_item.quantity, v_item.unit_price, v_item.quantity * v_item.unit_price);
    
    IF v_is_distributor THEN
      -- إرجاع المخزون لمخزون الموزع
      INSERT INTO public.distributor_inventory (distributor_id, product_id, product_name, quantity, organization_id)
      VALUES (v_user_id, v_item.product_id, v_item.product_name, v_item.quantity, v_org_id)
      ON CONFLICT (distributor_id, product_id)
      DO UPDATE SET 
          quantity = distributor_inventory.quantity + EXCLUDED.quantity,
          updated_at = now();
      
      -- تسجيل حركة المخزون: CUSTOMER -> DISTRIBUTOR (مرتجع)
      INSERT INTO public.stock_movements (
          organization_id, product_id, source_type, source_id,
          destination_type, destination_id, quantity, movement_type,
          reference_id, created_by
      )
      VALUES (
          v_org_id, v_item.product_id, 'CUSTOMER', v_sale.customer_id,
          'DISTRIBUTOR', v_user_id, v_item.quantity, 'RETURN',
          v_return_id, v_user_id
      );
    ELSE
      -- إرجاع المخزون للمخزون المركزي
      UPDATE public.products
      SET stock = stock + v_item.quantity
      WHERE id = v_item.product_id
      AND organization_id = v_org_id;
      
      -- تسجيل حركة المخزون: CUSTOMER -> CENTRAL (مرتجع)
      INSERT INTO public.stock_movements (
          organization_id, product_id, source_type, source_id,
          destination_type, destination_id, quantity, movement_type,
          reference_id, created_by
      )
      VALUES (
          v_org_id, v_item.product_id, 'CUSTOMER', v_sale.customer_id,
          'CENTRAL', NULL, v_item.quantity, 'RETURN',
          v_return_id, v_user_id
      );
    END IF;
  END LOOP;
  
  -- تنقيص رصيد العميل
  UPDATE public.customers
  SET balance = balance - v_total
  WHERE id = v_sale.customer_id
  AND organization_id = v_org_id;
  
  RETURN v_return_id;
END;
$$;