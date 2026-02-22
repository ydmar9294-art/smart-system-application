
-- Sales Return Items
CREATE TABLE public.sales_return_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  return_id UUID NOT NULL REFERENCES public.sales_returns(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INT NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sales_return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org read sales return items" ON public.sales_return_items FOR SELECT USING (
  return_id IN (SELECT id FROM public.sales_returns WHERE organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
);
CREATE POLICY "Org insert sales return items" ON public.sales_return_items FOR INSERT WITH CHECK (
  return_id IN (SELECT id FROM public.sales_returns WHERE organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
);

-- Organization Legal Info
CREATE TABLE public.organization_legal_info (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) UNIQUE,
  commercial_registration TEXT,
  industrial_registration TEXT,
  tax_identification TEXT,
  trademark_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organization_legal_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org read legal info" ON public.organization_legal_info FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Owner manage legal info" ON public.organization_legal_info FOR ALL USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND role IN ('OWNER', 'DEVELOPER'))
);

-- User Notifications
CREATE TABLE public.user_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_user_notifications_user ON public.user_notifications(user_id);
CREATE POLICY "Users read own notifications" ON public.user_notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON public.user_notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users delete own notifications" ON public.user_notifications FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Insert notifications" ON public.user_notifications FOR INSERT WITH CHECK (user_id = auth.uid());

-- Add realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;

-- Create Sales Return RPC
CREATE OR REPLACE FUNCTION public.create_sales_return_rpc(
  p_sale_id UUID,
  p_items JSONB,
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_customer_name TEXT;
  v_return_id UUID;
  v_item JSONB;
  v_total NUMERIC := 0;
BEGIN
  SELECT organization_id INTO v_org_id FROM profiles WHERE id = auth.uid();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'لا توجد منشأة'; END IF;
  
  SELECT customer_name INTO v_customer_name FROM sales WHERE id = p_sale_id AND organization_id = v_org_id;
  IF v_customer_name IS NULL THEN RAISE EXCEPTION 'الفاتورة غير موجودة'; END IF;
  
  -- Calculate total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total := v_total + ((v_item->>'quantity')::INT * (v_item->>'unit_price')::NUMERIC);
  END LOOP;
  
  INSERT INTO sales_returns (organization_id, sale_id, customer_name, total_amount, reason, created_by)
  VALUES (v_org_id, p_sale_id, v_customer_name, v_total, p_reason, auth.uid())
  RETURNING id INTO v_return_id;
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO sales_return_items (return_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (v_return_id, (v_item->>'product_id')::UUID, v_item->>'product_name', (v_item->>'quantity')::INT, (v_item->>'unit_price')::NUMERIC, (v_item->>'quantity')::INT * (v_item->>'unit_price')::NUMERIC);
    
    -- Restore stock
    UPDATE products SET stock = stock + (v_item->>'quantity')::INT WHERE id = (v_item->>'product_id')::UUID AND organization_id = v_org_id;
  END LOOP;
  
  -- Update customer balance
  DECLARE v_customer_id UUID;
  BEGIN
    SELECT customer_id INTO v_customer_id FROM sales WHERE id = p_sale_id;
    UPDATE customers SET balance = balance - v_total WHERE id = v_customer_id;
  END;
  
  RETURN v_return_id;
END;
$$;
