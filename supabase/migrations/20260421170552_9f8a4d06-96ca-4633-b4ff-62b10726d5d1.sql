
CREATE OR REPLACE FUNCTION public.get_organization_stats_rpc()
 RETURNS TABLE(org_id uuid, org_name text, license_id uuid, license_status text, license_type text, max_employees integer, expiry_date timestamp with time zone, employee_count bigint, total_users bigint, pending_employees bigint, total_sales bigint, total_products bigint, total_customers bigint, total_deliveries bigint, total_purchases bigint, total_revenue numeric, total_collections numeric, total_records bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'DEVELOPER') THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;

  RETURN QUERY
  SELECT
    o.id AS org_id,
    o.name AS org_name,
    dl.id AS license_id,
    dl.status AS license_status,
    dl.type AS license_type,
    dl.max_employees,
    dl."expiryDate" AS expiry_date,
    -- الموزعون الميدانيون النشطون فقط (يقابل سياسة الحد الأقصى الجديدة)
    (SELECT COUNT(*) FROM profiles p
       WHERE p.organization_id = o.id
         AND p.role = 'EMPLOYEE'
         AND p.employee_type = 'FIELD_AGENT'
         AND p.is_active = true)::BIGINT AS employee_count,
    (SELECT COUNT(*) FROM profiles p WHERE p.organization_id = o.id)::BIGINT AS total_users,
    (SELECT COUNT(*) FROM pending_employees pe
       WHERE pe.organization_id = o.id
         AND pe.employee_type = 'FIELD_AGENT'
         AND pe.is_used = false)::BIGINT AS pending_employees,
    (SELECT COUNT(*) FROM sales s WHERE s.organization_id = o.id)::BIGINT AS total_sales,
    (SELECT COUNT(*) FROM products pr WHERE pr.organization_id = o.id AND pr.is_deleted = false)::BIGINT AS total_products,
    (SELECT COUNT(*) FROM customers c WHERE c.organization_id = o.id)::BIGINT AS total_customers,
    (SELECT COUNT(*) FROM deliveries d WHERE d.organization_id = o.id)::BIGINT AS total_deliveries,
    (SELECT COUNT(*) FROM purchases pu WHERE pu.organization_id = o.id)::BIGINT AS total_purchases,
    COALESCE((SELECT SUM(s.grand_total) FROM sales s WHERE s.organization_id = o.id AND s.is_voided = false), 0) AS total_revenue,
    COALESCE((SELECT SUM(col.amount) FROM collections col WHERE col.organization_id = o.id AND col.is_reversed = false), 0) AS total_collections,
    (
      (SELECT COUNT(*) FROM sales s WHERE s.organization_id = o.id) +
      (SELECT COUNT(*) FROM products pr WHERE pr.organization_id = o.id) +
      (SELECT COUNT(*) FROM customers c WHERE c.organization_id = o.id)
    )::BIGINT AS total_records
  FROM organizations o
  LEFT JOIN developer_licenses dl ON dl.organization_id = o.id
  ORDER BY o.name;
END;
$function$;
