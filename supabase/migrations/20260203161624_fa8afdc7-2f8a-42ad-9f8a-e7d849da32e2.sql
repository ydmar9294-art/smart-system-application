
-- PART 1: Fix stock_movements source_type constraint to allow 'CUSTOMER' for returns
ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_source_type_check;

ALTER TABLE public.stock_movements
ADD CONSTRAINT stock_movements_source_type_check
CHECK (source_type = ANY (ARRAY['CENTRAL'::text, 'DISTRIBUTOR'::text, 'CUSTOMER'::text]));

-- PART 2: Create invoice_snapshots table for immutable invoice history
CREATE TABLE IF NOT EXISTS public.invoice_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    invoice_type TEXT NOT NULL CHECK (invoice_type IN ('sale', 'return', 'collection')),
    invoice_number TEXT NOT NULL,
    reference_id UUID NOT NULL,
    customer_id UUID,
    customer_name TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_by_name TEXT,
    grand_total NUMERIC NOT NULL DEFAULT 0,
    paid_amount NUMERIC DEFAULT 0,
    remaining NUMERIC DEFAULT 0,
    payment_type TEXT CHECK (payment_type IN ('CASH', 'CREDIT')),
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    reason TEXT,
    org_name TEXT,
    legal_info JSONB DEFAULT '{}'::jsonb,
    invoice_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, invoice_number)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invoice_snapshots_org_type ON public.invoice_snapshots(organization_id, invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoice_snapshots_created_by ON public.invoice_snapshots(created_by);
CREATE INDEX IF NOT EXISTS idx_invoice_snapshots_date ON public.invoice_snapshots(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_snapshots_reference ON public.invoice_snapshots(reference_id);

-- Enable RLS
ALTER TABLE public.invoice_snapshots ENABLE ROW LEVEL SECURITY;

-- Block anon access
CREATE POLICY "Block anon access invoice_snapshots"
ON public.invoice_snapshots FOR ALL
USING (false);

-- Distributors view own invoices
CREATE POLICY "Users view own org invoices"
ON public.invoice_snapshots FOR SELECT
USING (
    (created_by = auth.uid() AND organization_id = get_user_organization_id(auth.uid()))
    OR has_role(auth.uid(), 'OWNER')
    OR has_role(auth.uid(), 'DEVELOPER')
);

-- Insert via RPC only
CREATE POLICY "Insert own org invoices"
ON public.invoice_snapshots FOR INSERT
WITH CHECK (organization_id = get_user_organization_id(auth.uid()));

-- Generate invoice number function
CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_org_id UUID, p_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prefix TEXT;
    v_year TEXT;
    v_count INTEGER;
BEGIN
    CASE p_type
        WHEN 'sale' THEN v_prefix := 'INV';
        WHEN 'return' THEN v_prefix := 'RTN';
        WHEN 'collection' THEN v_prefix := 'RCP';
        ELSE v_prefix := 'DOC';
    END CASE;
    
    v_year := to_char(now(), 'YY');
    
    SELECT COUNT(*) + 1 INTO v_count
    FROM public.invoice_snapshots
    WHERE organization_id = p_org_id
    AND invoice_type = p_type
    AND EXTRACT(YEAR FROM invoice_date) = EXTRACT(YEAR FROM now());
    
    RETURN v_prefix || '-' || v_year || '-' || LPAD(v_count::text, 6, '0');
END;
$$;

-- Save invoice snapshot function
CREATE OR REPLACE FUNCTION public.save_invoice_snapshot(
    p_type TEXT,
    p_reference_id UUID,
    p_customer_id UUID,
    p_customer_name TEXT,
    p_grand_total NUMERIC,
    p_paid_amount NUMERIC DEFAULT 0,
    p_remaining NUMERIC DEFAULT 0,
    p_payment_type TEXT DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::jsonb,
    p_notes TEXT DEFAULT NULL,
    p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id UUID;
    v_user_id UUID;
    v_snapshot_id UUID;
    v_invoice_number TEXT;
    v_creator_name TEXT;
    v_org_name TEXT;
    v_legal_info JSONB;
BEGIN
    v_user_id := auth.uid();
    v_org_id := public.get_user_organization_id(v_user_id);
    
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'No organization found';
    END IF;
    
    SELECT full_name INTO v_creator_name FROM public.profiles WHERE id = v_user_id;
    SELECT name INTO v_org_name FROM public.organizations WHERE id = v_org_id;
    
    SELECT jsonb_build_object(
        'commercial_registration', commercial_registration,
        'industrial_registration', industrial_registration,
        'tax_identification', tax_identification,
        'trademark_name', trademark_name
    ) INTO v_legal_info
    FROM public.organization_legal_info
    WHERE organization_id = v_org_id;
    
    v_invoice_number := public.generate_invoice_number(v_org_id, p_type);
    
    INSERT INTO public.invoice_snapshots (
        organization_id, invoice_type, invoice_number, reference_id,
        customer_id, customer_name, created_by, created_by_name,
        grand_total, paid_amount, remaining, payment_type,
        items, notes, reason, org_name, legal_info
    )
    VALUES (
        v_org_id, p_type, v_invoice_number, p_reference_id,
        p_customer_id, p_customer_name, v_user_id, v_creator_name,
        p_grand_total, p_paid_amount, p_remaining, p_payment_type,
        p_items, p_notes, p_reason, v_org_name, COALESCE(v_legal_info, '{}'::jsonb)
    )
    RETURNING id INTO v_snapshot_id;
    
    RETURN v_snapshot_id;
END;
$$;
