-- ============================================
-- جداول مرتجعات المبيعات
-- ============================================

-- جدول مرتجعات المبيعات الرئيسي
CREATE TABLE public.sales_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  sale_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  customer_name TEXT NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- جدول عناصر مرتجعات المبيعات
CREATE TABLE public.sales_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.sales_returns(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- جداول مرتجعات المشتريات
-- ============================================

-- جدول مرتجعات المشتريات الرئيسي
CREATE TABLE public.purchase_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  purchase_id UUID,
  supplier_name TEXT,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- جدول عناصر مرتجعات المشتريات
CREATE TABLE public.purchase_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.purchase_returns(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- تفعيل RLS
-- ============================================

ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_return_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- سياسات RLS لمرتجعات المبيعات
-- ============================================

-- يمكن للجميع في المنشأة عرض مرتجعات المبيعات
CREATE POLICY "Users can view sales returns in their org"
ON public.sales_returns FOR SELECT
USING (
  organization_id = public.get_user_organization_id(auth.uid()) 
  OR public.has_role(auth.uid(), 'DEVELOPER')
);

-- الموزعون يمكنهم إنشاء مرتجعات
CREATE POLICY "Field agents can create sales returns"
ON public.sales_returns FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

-- المالك فقط يمكنه تعديل المرتجعات
CREATE POLICY "Owners can update sales returns"
ON public.sales_returns FOR UPDATE
USING (
  organization_id = public.get_user_organization_id(auth.uid()) 
  AND public.has_role(auth.uid(), 'OWNER')
);

-- سياسات عناصر مرتجعات المبيعات
CREATE POLICY "Users can view sales return items"
ON public.sales_return_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.sales_returns sr
    WHERE sr.id = sales_return_items.return_id
    AND sr.organization_id = public.get_user_organization_id(auth.uid())
  )
);

CREATE POLICY "Users can create sales return items"
ON public.sales_return_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sales_returns sr
    WHERE sr.id = sales_return_items.return_id
    AND sr.organization_id = public.get_user_organization_id(auth.uid())
  )
);

-- ============================================
-- سياسات RLS لمرتجعات المشتريات
-- ============================================

-- المالك فقط يمكنه إدارة مرتجعات المشتريات
CREATE POLICY "Owners can manage purchase returns"
ON public.purchase_returns FOR ALL
USING (
  organization_id = public.get_user_organization_id(auth.uid()) 
  AND public.has_role(auth.uid(), 'OWNER')
)
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid()) 
  AND public.has_role(auth.uid(), 'OWNER')
);

-- يمكن للجميع العرض
CREATE POLICY "Users can view purchase returns"
ON public.purchase_returns FOR SELECT
USING (
  organization_id = public.get_user_organization_id(auth.uid()) 
  OR public.has_role(auth.uid(), 'DEVELOPER')
);

-- سياسات عناصر مرتجعات المشتريات
CREATE POLICY "Owners can manage purchase return items"
ON public.purchase_return_items FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_returns pr
    WHERE pr.id = purchase_return_items.return_id
    AND pr.organization_id = public.get_user_organization_id(auth.uid())
    AND public.has_role(auth.uid(), 'OWNER')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.purchase_returns pr
    WHERE pr.id = purchase_return_items.return_id
    AND pr.organization_id = public.get_user_organization_id(auth.uid())
    AND public.has_role(auth.uid(), 'OWNER')
  )
);

CREATE POLICY "Users can view purchase return items"
ON public.purchase_return_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_returns pr
    WHERE pr.id = purchase_return_items.return_id
    AND pr.organization_id = public.get_user_organization_id(auth.uid())
  )
);

-- ============================================
-- دالة إنشاء مرتجع مبيعات
-- ============================================

CREATE OR REPLACE FUNCTION public.create_sales_return_rpc(
  p_sale_id UUID,
  p_items JSONB,
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org_id UUID;
  v_return_id UUID;
  v_sale RECORD;
  v_item RECORD;
  v_product RECORD;
  v_total NUMERIC := 0;
BEGIN
  -- Get user's organization
  v_org_id := public.get_user_organization_id(auth.uid());
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found';
  END IF;
  
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
  VALUES (v_org_id, p_sale_id, v_sale.customer_id, v_sale.customer_name, v_total, NULLIF(trim(COALESCE(p_reason, '')), ''), auth.uid())
  RETURNING id INTO v_return_id;
  
  -- Insert items and update stock (increase stock for returns)
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity INTEGER, unit_price NUMERIC)
  LOOP
    INSERT INTO public.sales_return_items (return_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (v_return_id, v_item.product_id, v_item.product_name, v_item.quantity, v_item.unit_price, v_item.quantity * v_item.unit_price);
    
    -- مرتجع البيع يزيد المخزون
    UPDATE public.products
    SET stock = stock + v_item.quantity
    WHERE id = v_item.product_id
    AND organization_id = v_org_id;
  END LOOP;
  
  -- تنقيص رصيد العميل
  UPDATE public.customers
  SET balance = balance - v_total
  WHERE id = v_sale.customer_id
  AND organization_id = v_org_id;
  
  RETURN v_return_id;
END;
$$;

-- ============================================
-- دالة إنشاء مرتجع مشتريات
-- ============================================

CREATE OR REPLACE FUNCTION public.create_purchase_return_rpc(
  p_items JSONB,
  p_supplier_name TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org_id UUID;
  v_return_id UUID;
  v_item RECORD;
  v_product RECORD;
  v_total NUMERIC := 0;
BEGIN
  -- Only owners can create purchase returns
  IF NOT public.has_role(auth.uid(), 'OWNER') THEN
    RAISE EXCEPTION 'Unauthorized: Only owners can create purchase returns';
  END IF;
  
  -- Get user's organization
  v_org_id := public.get_user_organization_id(auth.uid());
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found';
  END IF;
  
  -- Validate items
  IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one item is required';
  END IF;
  
  -- Validate items and calculate total
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity INTEGER, unit_price NUMERIC)
  LOOP
    IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Quantity must be positive for all items';
    END IF;
    
    IF v_item.unit_price IS NULL OR v_item.unit_price < 0 THEN
      RAISE EXCEPTION 'Unit price cannot be negative';
    END IF;
    
    -- Verify product belongs to organization and has sufficient stock
    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_item.product_id
    AND organization_id = v_org_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', COALESCE(v_item.product_name, 'Unknown');
    END IF;
    
    -- مرتجع الشراء يتطلب وجود مخزون كافي
    IF v_product.stock < v_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product: %. Available: %, Requested: %', 
        v_product.name, v_product.stock, v_item.quantity;
    END IF;
    
    v_total := v_total + (v_item.quantity * v_item.unit_price);
  END LOOP;
  
  -- Create purchase return
  INSERT INTO public.purchase_returns (organization_id, supplier_name, total_amount, reason, created_by)
  VALUES (v_org_id, NULLIF(trim(COALESCE(p_supplier_name, '')), ''), v_total, NULLIF(trim(COALESCE(p_reason, '')), ''), auth.uid())
  RETURNING id INTO v_return_id;
  
  -- Insert items and update stock (decrease stock for purchase returns)
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity INTEGER, unit_price NUMERIC)
  LOOP
    INSERT INTO public.purchase_return_items (return_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (v_return_id, v_item.product_id, v_item.product_name, v_item.quantity, v_item.unit_price, v_item.quantity * v_item.unit_price);
    
    -- مرتجع الشراء ينقص المخزون
    UPDATE public.products
    SET stock = stock - v_item.quantity
    WHERE id = v_item.product_id
    AND organization_id = v_org_id;
  END LOOP;
  
  RETURN v_return_id;
END;
$$;