-- ================= helper: pieces from pack/piece/quantity =================
CREATE OR REPLACE FUNCTION public.calc_pieces(p_item jsonb, p_units_per_pack integer)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN COALESCE((p_item->>'pack_quantity')::int, 0) > 0
      OR COALESCE((p_item->>'piece_quantity')::int, 0) > 0
    THEN COALESCE((p_item->>'pack_quantity')::int, 0) * GREATEST(COALESCE(p_units_per_pack,1),1)
       + COALESCE((p_item->>'piece_quantity')::int, 0)
    ELSE COALESCE((p_item->>'quantity')::int, 0)
  END;
$$;

-- ================= PURCHASE =================
CREATE OR REPLACE FUNCTION public.add_purchase_rpc(
  p_product_id uuid, p_quantity integer, p_unit_price numeric,
  p_supplier_name text DEFAULT NULL, p_notes text DEFAULT NULL,
  p_pack_quantity integer DEFAULT 0, p_piece_quantity integer DEFAULT 0
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '5s' AS $$
DECLARE
  v_org_id uuid; v_name text; v_upp int; v_pieces int; v_total numeric; v_id uuid; v_role text;
BEGIN
  SELECT organization_id, role INTO v_org_id, v_role FROM profiles WHERE id = auth.uid();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;
  IF v_role NOT IN ('OWNER','DEVELOPER') THEN RAISE EXCEPTION 'غير مصرح: الشراء متاح للإدارة فقط'; END IF;

  SELECT name, GREATEST(COALESCE(units_per_pack,1),1) INTO v_name, v_upp
  FROM products WHERE id = p_product_id AND organization_id = v_org_id AND COALESCE(is_archived,false) = false;
  IF v_name IS NULL THEN RAISE EXCEPTION 'المادة غير موجودة أو مؤرشفة'; END IF;

  v_pieces := CASE WHEN COALESCE(p_pack_quantity,0) > 0 OR COALESCE(p_piece_quantity,0) > 0
                   THEN COALESCE(p_pack_quantity,0) * v_upp + COALESCE(p_piece_quantity,0)
                   ELSE COALESCE(p_quantity,0) END;
  IF v_pieces <= 0 THEN RAISE EXCEPTION 'الكمية يجب أن تكون أكبر من صفر'; END IF;
  IF p_unit_price IS NULL OR p_unit_price < 0 THEN RAISE EXCEPTION 'سعر الوحدة غير صالح'; END IF;

  v_total := v_pieces * p_unit_price;

  INSERT INTO purchases (organization_id, product_id, product_name, quantity, unit_price, total_price,
                         supplier_name, notes, created_by, pack_quantity, piece_quantity, units_per_pack_snapshot)
  VALUES (v_org_id, p_product_id, v_name, v_pieces, p_unit_price, v_total,
          p_supplier_name, p_notes, auth.uid(),
          COALESCE(p_pack_quantity,0), COALESCE(p_piece_quantity,0), v_upp)
  RETURNING id INTO v_id;

  PERFORM apply_stock_movement(v_org_id, p_product_id, v_pieces, 'PURCHASE',
    'SUPPLIER', 'CENTRAL', NULL, NULL, v_id, p_supplier_name);

  RETURN v_id;
END;
$$;

-- ================= DELIVERY (pending -> received/rejected/cancelled) =================
CREATE OR REPLACE FUNCTION public.create_delivery_rpc(
  p_distributor_name text, p_items jsonb, p_notes text DEFAULT NULL, p_distributor_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '5s' AS $$
DECLARE
  v_org_id uuid; v_role text; v_delivery_id uuid; v_item jsonb;
  v_product_id uuid; v_pieces int; v_name text; v_upp int; v_dist_org uuid;
BEGIN
  SELECT organization_id, role INTO v_org_id, v_role FROM profiles WHERE id = auth.uid();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;
  IF v_role NOT IN ('OWNER','DEVELOPER') THEN RAISE EXCEPTION 'غير مصرح: التسليم متاح للإدارة فقط'; END IF;
  IF p_distributor_id IS NULL THEN RAISE EXCEPTION 'يجب تحديد الموزع'; END IF;
  IF jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'يجب إضافة صنف واحد على الأقل'; END IF;

  SELECT organization_id INTO v_dist_org FROM profiles WHERE id = p_distributor_id;
  IF v_dist_org IS DISTINCT FROM v_org_id THEN RAISE EXCEPTION 'الموزع لا ينتمي لهذه المنشأة'; END IF;

  INSERT INTO deliveries (organization_id, distributor_id, distributor_name, status, notes, created_by)
  VALUES (v_org_id, p_distributor_id, p_distributor_name, 'pending', p_notes, auth.uid())
  RETURNING id INTO v_delivery_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := COALESCE((v_item->>'product_id')::uuid, (v_item->>'productId')::uuid);

    SELECT name, GREATEST(COALESCE(units_per_pack,1),1) INTO v_name, v_upp
    FROM products WHERE id = v_product_id AND organization_id = v_org_id AND COALESCE(is_archived,false) = false;
    IF v_name IS NULL THEN RAISE EXCEPTION 'المادة غير موجودة أو مؤرشفة'; END IF;

    v_pieces := calc_pieces(v_item, v_upp);
    IF v_pieces <= 0 THEN RAISE EXCEPTION 'كمية غير صالحة للمادة «%»', v_name; END IF;

    INSERT INTO delivery_items (delivery_id, product_id, product_name, quantity,
                                pack_quantity, piece_quantity, units_per_pack_snapshot)
    VALUES (v_delivery_id, v_product_id, v_name, v_pieces,
            COALESCE((v_item->>'pack_quantity')::int, 0),
            COALESCE((v_item->>'piece_quantity')::int, 0), v_upp);

    -- reserve out of central warehouse (in transit)
    PERFORM apply_stock_movement(v_org_id, v_product_id, v_pieces, 'DELIVERY',
      'CENTRAL', 'TRANSIT', NULL, p_distributor_id, v_delivery_id, 'تسليم قيد الاستلام');
  END LOOP;

  RETURN v_delivery_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_delivery_rpc(p_delivery_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '5s' AS $$
DECLARE v_org_id uuid; v_role text; v_dist uuid; v_status text; r record;
BEGIN
  SELECT organization_id, role INTO v_org_id, v_role FROM profiles WHERE id = auth.uid();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;

  SELECT distributor_id, status INTO v_dist, v_status
  FROM deliveries WHERE id = p_delivery_id AND organization_id = v_org_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'التسليم غير موجود'; END IF;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'تمت معالجة هذا التسليم مسبقاً'; END IF;
  IF v_dist <> auth.uid() AND v_role NOT IN ('OWNER','DEVELOPER') THEN
    RAISE EXCEPTION 'غير مصرح لك بتأكيد هذا التسليم';
  END IF;

  FOR r IN SELECT product_id, quantity FROM delivery_items WHERE delivery_id = p_delivery_id LOOP
    PERFORM apply_stock_movement(v_org_id, r.product_id, r.quantity, 'DELIVERY_CONFIRM',
      'TRANSIT', 'DISTRIBUTOR', NULL, v_dist, p_delivery_id, 'تأكيد استلام التسليم');
  END LOOP;

  UPDATE deliveries SET status = 'received', confirmed_at = now(), confirmed_by = auth.uid()
  WHERE id = p_delivery_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_delivery_rpc(p_delivery_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '5s' AS $$
DECLARE v_org_id uuid; v_role text; v_dist uuid; v_status text; r record; v_new text;
BEGIN
  SELECT organization_id, role INTO v_org_id, v_role FROM profiles WHERE id = auth.uid();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;

  SELECT distributor_id, status INTO v_dist, v_status
  FROM deliveries WHERE id = p_delivery_id AND organization_id = v_org_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'التسليم غير موجود'; END IF;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'تمت معالجة هذا التسليم مسبقاً'; END IF;

  IF v_dist = auth.uid() THEN v_new := 'rejected';
  ELSIF v_role IN ('OWNER','DEVELOPER') THEN v_new := 'cancelled';
  ELSE RAISE EXCEPTION 'غير مصرح لك بهذا الإجراء';
  END IF;

  FOR r IN SELECT product_id, quantity FROM delivery_items WHERE delivery_id = p_delivery_id LOOP
    PERFORM apply_stock_movement(v_org_id, r.product_id, r.quantity, 'DELIVERY_CANCEL',
      'TRANSIT', 'CENTRAL', NULL, NULL, p_delivery_id, COALESCE(p_reason, 'إلغاء/رفض تسليم'));
  END LOOP;

  UPDATE deliveries SET status = v_new, rejection_reason = p_reason WHERE id = p_delivery_id;
END;
$$;

-- ================= PURCHASE RETURN =================
CREATE OR REPLACE FUNCTION public.create_purchase_return_rpc(
  p_items jsonb, p_reason text DEFAULT NULL, p_supplier_name text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '5s' AS $$
DECLARE
  v_org_id uuid; v_role text; v_return_id uuid; v_item jsonb;
  v_total numeric := 0; v_pieces int; v_name text; v_upp int; v_product_id uuid; v_price numeric;
BEGIN
  SELECT organization_id, role INTO v_org_id, v_role FROM profiles WHERE id = auth.uid();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;
  IF v_role NOT IN ('OWNER','DEVELOPER') THEN RAISE EXCEPTION 'غير مصرح: مرتجع الشراء متاح للإدارة فقط'; END IF;
  IF jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'يجب إضافة صنف واحد على الأقل'; END IF;

  INSERT INTO purchase_returns (organization_id, supplier_name, total_amount, reason, created_by)
  VALUES (v_org_id, p_supplier_name, 0, p_reason, auth.uid())
  RETURNING id INTO v_return_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := COALESCE((v_item->>'product_id')::uuid, (v_item->>'productId')::uuid);

    SELECT name, GREATEST(COALESCE(units_per_pack,1),1) INTO v_name, v_upp
    FROM products WHERE id = v_product_id AND organization_id = v_org_id;
    IF v_name IS NULL THEN RAISE EXCEPTION 'المادة غير موجودة'; END IF;

    v_pieces := calc_pieces(v_item, v_upp);
    IF v_pieces <= 0 THEN RAISE EXCEPTION 'كمية غير صالحة للمادة «%»', v_name; END IF;
    v_price := COALESCE((v_item->>'unit_price')::numeric, 0);

    INSERT INTO purchase_return_items (return_id, product_id, product_name, quantity, unit_price, total_price,
                                       pack_quantity, piece_quantity, units_per_pack_snapshot)
    VALUES (v_return_id, v_product_id, v_name, v_pieces, v_price, v_pieces * v_price,
            COALESCE((v_item->>'pack_quantity')::int, 0),
            COALESCE((v_item->>'piece_quantity')::int, 0), v_upp);

    v_total := v_total + v_pieces * v_price;

    PERFORM apply_stock_movement(v_org_id, v_product_id, v_pieces, 'PURCHASE_RETURN',
      'CENTRAL', 'SUPPLIER', NULL, NULL, v_return_id, p_reason);
  END LOOP;

  UPDATE purchase_returns SET total_amount = v_total WHERE id = v_return_id;
  RETURN v_return_id;
END;
$$;

-- ================= DISTRIBUTOR -> CENTRAL TRANSFER =================
CREATE OR REPLACE FUNCTION public.transfer_to_main_warehouse_rpc(p_items jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '5s' AS $$
DECLARE v_org_id uuid; v_user uuid; v_item jsonb; v_product_id uuid; v_pieces int; v_upp int; v_name text;
BEGIN
  v_user := auth.uid();
  SELECT organization_id INTO v_org_id FROM profiles WHERE id = v_user;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;
  IF jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'يجب إضافة صنف واحد على الأقل'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := COALESCE((v_item->>'product_id')::uuid, (v_item->>'productId')::uuid);
    SELECT name, GREATEST(COALESCE(units_per_pack,1),1) INTO v_name, v_upp
    FROM products WHERE id = v_product_id AND organization_id = v_org_id;
    IF v_name IS NULL THEN RAISE EXCEPTION 'المادة غير موجودة'; END IF;

    v_pieces := calc_pieces(v_item, v_upp);
    IF v_pieces <= 0 THEN RAISE EXCEPTION 'كمية غير صالحة للمادة «%»', v_name; END IF;

    PERFORM apply_stock_movement(v_org_id, v_product_id, v_pieces, 'DISTRIBUTOR_RETURN',
      'DISTRIBUTOR', 'CENTRAL', v_user, NULL, NULL, 'إرجاع من مستودع الموزع');
  END LOOP;
END;
$$;

-- ================= STOCK ADJUSTMENT (inventory count) =================
CREATE OR REPLACE FUNCTION public.adjust_stock_rpc(
  p_product_id uuid, p_delta integer, p_reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '5s' AS $$
DECLARE v_org_id uuid; v_role text; v_name text;
BEGIN
  SELECT organization_id, role INTO v_org_id, v_role FROM profiles WHERE id = auth.uid();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;
  IF v_role NOT IN ('OWNER','DEVELOPER') THEN RAISE EXCEPTION 'غير مصرح: التسوية متاحة للإدارة فقط'; END IF;
  IF p_delta IS NULL OR p_delta = 0 THEN RAISE EXCEPTION 'قيمة التسوية يجب أن تكون مختلفة عن صفر'; END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 3 THEN RAISE EXCEPTION 'يجب إدخال سبب التسوية'; END IF;

  SELECT name INTO v_name FROM products WHERE id = p_product_id AND organization_id = v_org_id;
  IF v_name IS NULL THEN RAISE EXCEPTION 'المادة غير موجودة'; END IF;

  IF p_delta > 0 THEN
    PERFORM apply_stock_movement(v_org_id, p_product_id, p_delta, 'ADJUSTMENT',
      'ADJUSTMENT', 'CENTRAL', NULL, NULL, NULL, p_reason);
  ELSE
    PERFORM apply_stock_movement(v_org_id, p_product_id, -p_delta, 'ADJUSTMENT',
      'CENTRAL', 'ADJUSTMENT', NULL, NULL, NULL, p_reason);
  END IF;
END;
$$;

-- ================= ARCHIVE / RESTORE PRODUCT =================
CREATE OR REPLACE FUNCTION public.archive_product_rpc(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '5s' AS $$
DECLARE v_org_id uuid; v_role text; v_name text; v_stock int; v_dist_qty int; v_dist_name text; v_pending int;
BEGIN
  SELECT organization_id, role INTO v_org_id, v_role FROM profiles WHERE id = auth.uid();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;
  IF v_role NOT IN ('OWNER','DEVELOPER') THEN RAISE EXCEPTION 'غير مصرح: الأرشفة متاحة للإدارة فقط'; END IF;

  SELECT name, stock INTO v_name, v_stock FROM products
  WHERE id = p_product_id AND organization_id = v_org_id FOR UPDATE;
  IF v_name IS NULL THEN RAISE EXCEPTION 'المادة غير موجودة'; END IF;

  IF v_stock > 0 THEN
    RAISE EXCEPTION 'لا يمكن أرشفة «%»: يوجد % قطعة في المستودع الرئيسي', v_name, v_stock;
  END IF;

  SELECT di.quantity, COALESCE(p.full_name, 'موزع') INTO v_dist_qty, v_dist_name
  FROM distributor_inventory di
  LEFT JOIN profiles p ON p.id = di.distributor_id
  WHERE di.product_id = p_product_id AND di.organization_id = v_org_id AND di.quantity > 0
  LIMIT 1;

  IF v_dist_qty IS NOT NULL THEN
    RAISE EXCEPTION 'لا يمكن أرشفة «%»: يوجد % قطعة لدى الموزع %', v_name, v_dist_qty, v_dist_name;
  END IF;

  SELECT count(*) INTO v_pending FROM delivery_items di
  JOIN deliveries d ON d.id = di.delivery_id
  WHERE di.product_id = p_product_id AND d.status = 'pending' AND d.organization_id = v_org_id;

  IF v_pending > 0 THEN
    RAISE EXCEPTION 'لا يمكن أرشفة «%»: يوجد تسليمات قيد الاستلام تحتوي هذه المادة', v_name;
  END IF;

  UPDATE products SET is_archived = true, is_deleted = true, archived_at = now(),
    archived_by = auth.uid(), updated_at = now()
  WHERE id = p_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_product_rpc(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '5s' AS $$
DECLARE v_org_id uuid; v_role text;
BEGIN
  SELECT organization_id, role INTO v_org_id, v_role FROM profiles WHERE id = auth.uid();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;
  IF v_role NOT IN ('OWNER','DEVELOPER') THEN RAISE EXCEPTION 'غير مصرح'; END IF;

  UPDATE products SET is_archived = false, is_deleted = false, archived_at = NULL,
    archived_by = NULL, updated_at = now()
  WHERE id = p_product_id AND organization_id = v_org_id;
END;
$$;

-- ================= units_per_pack guard: include distributor stock =================
CREATE OR REPLACE FUNCTION public.prevent_units_per_pack_change_if_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE has_sales boolean; dist_qty int;
BEGIN
  IF NEW.units_per_pack IS DISTINCT FROM OLD.units_per_pack THEN
    IF COALESCE(OLD.stock, 0) > 0 THEN
      RAISE EXCEPTION 'لا يمكن تغيير عدد القطع داخل الطرد لأن المخزون الحالي = %. يجب تصفير المخزون أولاً.', OLD.stock
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT COALESCE(sum(quantity), 0) INTO dist_qty
    FROM distributor_inventory WHERE product_id = OLD.id;
    IF dist_qty > 0 THEN
      RAISE EXCEPTION 'لا يمكن تغيير عدد القطع داخل الطرد لأن هناك % قطعة لدى الموزعين.', dist_qty
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT EXISTS(SELECT 1 FROM sale_items si WHERE si.product_id = OLD.id) INTO has_sales;
    IF has_sales THEN
      RAISE EXCEPTION 'لا يمكن تغيير عدد القطع داخل الطرد لأن هناك فواتير سابقة تستخدم هذه المادة.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ================= central sale: route through the engine =================
CREATE OR REPLACE FUNCTION public.create_sale_rpc(
  p_customer_id uuid, p_items jsonb, p_payment_type text DEFAULT 'CASH',
  p_discount_type text DEFAULT NULL, p_discount_percentage numeric DEFAULT 0, p_discount_value numeric DEFAULT 0
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '5s' AS $$
DECLARE
  v_org_id uuid; v_user_id uuid; v_customer_name text;
  v_subtotal numeric := 0; v_grand_total numeric := 0; v_sale_id uuid;
  v_item jsonb; v_product_id uuid; v_pieces int; v_price numeric;
  v_product_name text; v_upp int;
BEGIN
  v_user_id := auth.uid();
  SELECT organization_id INTO v_org_id FROM profiles WHERE id = v_user_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;

  SELECT name INTO v_customer_name FROM customers WHERE id = p_customer_id AND organization_id = v_org_id;
  IF v_customer_name IS NULL THEN RAISE EXCEPTION 'العميل غير موجود'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := COALESCE((v_item->>'productId')::uuid, (v_item->>'product_id')::uuid);
    SELECT GREATEST(COALESCE(units_per_pack,1),1) INTO v_upp FROM products
    WHERE id = v_product_id AND organization_id = v_org_id AND COALESCE(is_archived,false) = false;
    IF v_upp IS NULL THEN RAISE EXCEPTION 'المادة غير موجودة أو مؤرشفة'; END IF;
    v_pieces := calc_pieces(v_item, v_upp);
    v_subtotal := v_subtotal + COALESCE((v_item->>'totalPrice')::numeric,
      v_pieces * COALESCE((v_item->>'unitPrice')::numeric, 0));
  END LOOP;

  v_grand_total := GREATEST(0, v_subtotal - COALESCE(p_discount_value, 0));

  INSERT INTO sales (organization_id, customer_id, customer_name, grand_total, paid_amount, remaining,
                     payment_type, created_by, discount_type, discount_percentage, discount_value)
  VALUES (v_org_id, p_customer_id, v_customer_name, v_grand_total,
    CASE WHEN p_payment_type = 'CASH' THEN v_grand_total ELSE 0 END,
    CASE WHEN p_payment_type = 'CASH' THEN 0 ELSE v_grand_total END,
    p_payment_type, v_user_id, p_discount_type,
    COALESCE(p_discount_percentage,0), COALESCE(p_discount_value,0))
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := COALESCE((v_item->>'productId')::uuid, (v_item->>'product_id')::uuid);
    SELECT name, GREATEST(COALESCE(units_per_pack,1),1) INTO v_product_name, v_upp
    FROM products WHERE id = v_product_id;
    v_pieces := calc_pieces(v_item, v_upp);
    v_price := COALESCE((v_item->>'unitPrice')::numeric, (v_item->>'unit_price')::numeric, 0);

    INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, total_price,
                            pack_quantity, piece_quantity, units_per_pack_snapshot, sold_unit)
    VALUES (v_sale_id, v_product_id, COALESCE(v_product_name, v_item->>'productName'), v_pieces, v_price,
      COALESCE((v_item->>'totalPrice')::numeric, v_pieces * v_price),
      COALESCE((v_item->>'pack_quantity')::int, 0),
      COALESCE((v_item->>'piece_quantity')::int, 0), v_upp,
      COALESCE(v_item->>'sold_unit', 'PIECE'));

    PERFORM apply_stock_movement(v_org_id, v_product_id, v_pieces, 'SALE',
      'CENTRAL', 'CUSTOMER', NULL, p_customer_id, v_sale_id, NULL);
  END LOOP;

  IF p_payment_type = 'CREDIT' THEN
    UPDATE customers SET balance = balance + v_grand_total WHERE id = p_customer_id AND organization_id = v_org_id;
  END IF;

  RETURN v_sale_id;
END;
$$;