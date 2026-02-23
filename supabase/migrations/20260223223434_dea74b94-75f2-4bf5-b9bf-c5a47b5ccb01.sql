
-- Fix 1: create_delivery_rpc reads 'product_id' to match frontend (was 'productId')
-- Fix 2: activate_employee_oauth uses pending_employees.name instead of Google name

CREATE OR REPLACE FUNCTION public.create_delivery_rpc(p_distributor_name text, p_items jsonb, p_notes text DEFAULT NULL::text, p_distributor_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_delivery_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_qty INT;
  v_current_stock INT;
  v_product_name TEXT;
  v_dist_id UUID;
BEGIN
  SELECT organization_id INTO v_org_id FROM profiles WHERE id = auth.uid();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;
  
  IF p_distributor_id IS NULL THEN
    RAISE EXCEPTION 'يجب تحديد الموزع';
  END IF;
  
  v_dist_id := p_distributor_id;
  
  -- Validate stock BEFORE creating delivery
  -- Support BOTH field names: product_id (frontend) and productId (legacy)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := COALESCE(
      (v_item->>'product_id')::UUID,
      (v_item->>'productId')::UUID
    );
    v_qty := (v_item->>'quantity')::INT;
    
    SELECT stock, name INTO v_current_stock, v_product_name
    FROM products WHERE id = v_product_id AND organization_id = v_org_id;
    
    IF v_current_stock IS NULL THEN
      RAISE EXCEPTION 'المنتج غير موجود (id: %)', v_product_id;
    END IF;
    
    IF v_qty > v_current_stock THEN
      RAISE EXCEPTION 'الكمية المطلوبة (%) تتجاوز المخزون المتوفر (%) للمنتج %', v_qty, v_current_stock, v_product_name;
    END IF;
  END LOOP;
  
  INSERT INTO deliveries (organization_id, distributor_id, distributor_name, status, notes, created_by)
  VALUES (v_org_id, v_dist_id, p_distributor_name, 'completed', p_notes, auth.uid())
  RETURNING id INTO v_delivery_id;
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := COALESCE(
      (v_item->>'product_id')::UUID,
      (v_item->>'productId')::UUID
    );
    v_qty := (v_item->>'quantity')::INT;
    
    -- Get the actual product name from DB
    SELECT name INTO v_product_name FROM products WHERE id = v_product_id;
    
    INSERT INTO delivery_items (delivery_id, product_id, product_name, quantity)
    VALUES (v_delivery_id, v_product_id, v_product_name, v_qty);
    
    -- Deduct from main stock
    UPDATE products SET stock = stock - v_qty WHERE id = v_product_id AND organization_id = v_org_id;
    
    -- UPSERT distributor inventory
    INSERT INTO distributor_inventory (organization_id, distributor_id, product_id, product_name, quantity)
    VALUES (v_org_id, v_dist_id, v_product_id, v_product_name, v_qty)
    ON CONFLICT (organization_id, distributor_id, product_id) 
    DO UPDATE SET quantity = distributor_inventory.quantity + EXCLUDED.quantity, updated_at = now();
  END LOOP;
  
  RETURN v_delivery_id;
END;
$function$;

-- Fix 2: activate_employee_oauth - use the registered name from pending_employees
-- instead of the Google account name
CREATE OR REPLACE FUNCTION public.activate_employee_oauth(p_user_id uuid, p_google_id text, p_email text, p_full_name text, p_activation_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pending RECORD;
  v_employee_name TEXT;
BEGIN
  -- Find pending employee
  SELECT * INTO v_pending FROM pending_employees 
  WHERE activation_code = p_activation_code AND is_used = false;
  
  IF v_pending IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'كود التفعيل غير صالح أو مستخدم');
  END IF;
  
  -- USE THE MANUALLY REGISTERED NAME, not the Google account name
  v_employee_name := v_pending.name;
  
  -- Create/update profile with the registered name
  INSERT INTO profiles (id, full_name, email, phone, role, employee_type, organization_id, license_key)
  VALUES (
    p_user_id, v_employee_name, p_email, v_pending.phone,
    v_pending.role, v_pending.employee_type, v_pending.organization_id,
    (SELECT license_key FROM profiles WHERE organization_id = v_pending.organization_id AND role = 'OWNER' LIMIT 1)
  )
  ON CONFLICT (id) DO UPDATE SET 
    full_name = v_employee_name, email = p_email,
    role = v_pending.role, employee_type = v_pending.employee_type,
    organization_id = v_pending.organization_id,
    license_key = (SELECT license_key FROM profiles WHERE organization_id = v_pending.organization_id AND role = 'OWNER' LIMIT 1);
  
  -- Mark code as used
  UPDATE pending_employees SET is_used = true, activated_at = now(), activated_by = p_user_id
  WHERE id = v_pending.id;
  
  RETURN jsonb_build_object('success', true, 'message', 'تم تفعيل حساب الموظف بنجاح');
END;
$function$;
