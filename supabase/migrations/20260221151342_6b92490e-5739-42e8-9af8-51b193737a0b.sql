
-- Drop existing function with old return type
DROP FUNCTION IF EXISTS public.get_organization_stats_rpc();

-- Recreate with json return type using materialized view with fallback
CREATE OR REPLACE FUNCTION public.get_organization_stats_rpc()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  -- Verify caller is developer
  IF NOT has_role(auth.uid(), 'DEVELOPER') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Try materialized view first
  BEGIN
    SELECT json_agg(row_to_json(s))
    INTO v_result
    FROM public.mat_org_stats s;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback: live query if mat view not available
    SELECT json_agg(row_to_json(sub))
    INTO v_result
    FROM (
      SELECT 
        o.id AS org_id,
        o.name AS org_name,
        dl.status AS license_status,
        COALESCE(dl.max_employees, 10) AS max_employees,
        (SELECT COUNT(*) FROM profiles p WHERE p.organization_id = o.id AND p.role = 'EMPLOYEE' AND p.is_active = true)::int AS employee_count,
        (SELECT COUNT(*) FROM pending_employees pe WHERE pe.organization_id = o.id AND pe.is_used = false)::int AS pending_employees,
        (SELECT COUNT(*) FROM profiles p WHERE p.organization_id = o.id)::int AS total_users,
        (SELECT COUNT(*) FROM sales s WHERE s.organization_id = o.id)::int AS total_sales,
        (SELECT COALESCE(SUM(s.grand_total), 0) FROM sales s WHERE s.organization_id = o.id AND s.is_voided = false) AS total_revenue,
        (SELECT COUNT(*) FROM products pr WHERE pr.organization_id = o.id AND pr.is_deleted = false)::int AS total_products,
        (SELECT COUNT(*) FROM customers c WHERE c.organization_id = o.id)::int AS total_customers,
        (SELECT COUNT(*) FROM deliveries d WHERE d.organization_id = o.id)::int AS total_deliveries,
        (SELECT COUNT(*) FROM purchases pu WHERE pu.organization_id = o.id)::int AS total_purchases,
        (SELECT COUNT(*) FROM collections co WHERE co.organization_id = o.id)::int AS total_collections,
        (
          (SELECT COUNT(*) FROM sales s WHERE s.organization_id = o.id) +
          (SELECT COUNT(*) FROM products pr WHERE pr.organization_id = o.id) +
          (SELECT COUNT(*) FROM customers c WHERE c.organization_id = o.id) +
          (SELECT COUNT(*) FROM deliveries d WHERE d.organization_id = o.id)
        )::int AS total_records
      FROM organizations o
      LEFT JOIN profiles op ON op.organization_id = o.id AND op.role = 'OWNER'
      LEFT JOIN developer_licenses dl ON dl."licenseKey" = op.license_key
    ) sub;
  END;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
