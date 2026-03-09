/**
 * Domain Query Hooks - React Query based data fetching
 * 
 * TWO QUERY MODES:
 * 1. "Full" queries (useXxxQuery) — Load all data via auto-pagination for analytics/KPIs
 *    Used by DataContext for FinanceTab, ReportsTab, etc.
 * 2. "Paginated" queries (useXxxPaginatedQuery) — Cursor-based infinite scroll for UI lists
 *    Used directly by list components for efficient rendering
 * 
 * Security: Every org-scoped query includes .eq('organization_id', orgId)
 * Performance: Partial selects to reduce payload size
 * Safety: Queries only run with valid org context
 */
import { supabase } from '@/integrations/supabase/client';
import { UserRole, EmployeeType, Product, Customer, Sale, Payment, License, OrgStats } from '@/types';
import {
  Purchase, Delivery, PendingEmployee, DistributorInventoryItem,
  transformProduct, transformCustomer, transformSale, transformPayment,
  transformPurchase, transformDelivery, transformDistributorInventory,
  transformPendingEmployee, transformLicense, transformUser
} from '@/hooks/useDataOperations';
import { queryKeys } from '@/lib/queryClient';
import { safeQuery, canExecuteQuery, requireOrgContext } from '@/lib/safeQuery';
import { useOfflineQuery } from '@/hooks/useOfflineQuery';
import { useCursorPagination } from '@/hooks/data/useCursorPagination';

// Domain-specific stale times
const STALE = {
  fast: 2 * 60 * 1000,     // 2 min - sales, payments (frequently changing)
  normal: 5 * 60 * 1000,   // 5 min - products, customers
  slow: 10 * 60 * 1000,    // 10 min - licenses, org stats
};

// Offline TTL per domain
const OFFLINE_TTL = {
  fast: 12 * 60 * 60 * 1000,   // 12 hours
  normal: 24 * 60 * 60 * 1000, // 24 hours
  slow: 48 * 60 * 60 * 1000,   // 48 hours
};

/**
 * Auto-paginating fetch: loads ALL rows by fetching in 1000-row batches.
 * Used by analytics/KPI contexts that need complete datasets.
 * Supabase max per request = 1000.
 */
const BATCH_SIZE = 1000;

async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => any,
  transform: (row: any) => T,
  label: string
): Promise<T[]> {
  const allRows: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const data = await safeQuery(
      () => buildQuery(offset, offset + BATCH_SIZE - 1),
      { label: `${label}_batch_${offset}` }
    );
    const rows = (data || []) as any[];
    allRows.push(...rows.map(transform));
    hasMore = rows.length === BATCH_SIZE;
    offset += BATCH_SIZE;
  }

  return allRows;
}

/**
 * Cursor-based page fetch for infinite scroll.
 * Uses created_at + id cursor pattern for stable pagination.
 */
const PAGE_SIZE = 50;

interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
}

function parseCursor(cursor?: string): { cursorDate: string; cursorId: string } | null {
  if (!cursor) return null;
  try {
    const [cursorDate, cursorId] = JSON.parse(cursor);
    return { cursorDate, cursorId };
  } catch {
    return null;
  }
}

function buildCursor(date: string, id: string): string {
  return JSON.stringify([date, id]);
}

// ============================================
// Product Queries (full only — typically <500 items)
// ============================================

export function useProductsQuery(orgId?: string | null, role?: UserRole | null) {
  return useOfflineQuery({
    queryKey: queryKeys.products(orgId),
    offlineTtlMs: OFFLINE_TTL.normal,
    queryFn: async (): Promise<Product[]> => {
      requireOrgContext(orgId, role);
      const buildQuery = (from: number, to: number) => {
        let q = supabase
          .from('products')
          .select('id,name,category,cost_price,base_price,consumer_price,stock,min_stock,unit,is_deleted,organization_id')
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .range(from, to);
        if (orgId && role !== UserRole.DEVELOPER) q = q.eq('organization_id', orgId);
        return q;
      };
      return fetchAllRows(buildQuery, transformProduct, 'products');
    },
    enabled: canExecuteQuery(orgId, role),
    staleTime: STALE.normal,
  });
}

// ============================================
// Customer Queries
// ============================================

export function useCustomersQuery(orgId?: string | null, role?: UserRole | null) {
  return useOfflineQuery({
    queryKey: queryKeys.customers(orgId),
    offlineTtlMs: OFFLINE_TTL.normal,
    queryFn: async (): Promise<Customer[]> => {
      requireOrgContext(orgId, role);
      const buildQuery = (from: number, to: number) => {
        let q = supabase
          .from('customers')
          .select('id,name,phone,balance,organization_id,created_at,created_by,location')
          .order('created_at', { ascending: false })
          .range(from, to);
        if (orgId && role !== UserRole.DEVELOPER) q = q.eq('organization_id', orgId);
        return q;
      };
      return fetchAllRows(buildQuery, transformCustomer, 'customers');
    },
    enabled: canExecuteQuery(orgId, role),
    staleTime: STALE.normal,
  });
}

export function useCustomersPaginatedQuery(orgId?: string | null, role?: UserRole | null) {
  return useCursorPagination<Customer>({
    queryKey: [...queryKeys.customers(orgId), 'paginated'],
    orgId,
    role,
    staleTime: STALE.normal,
    pageSize: PAGE_SIZE,
    fetchFn: async (cursor?: string, limit = PAGE_SIZE): Promise<CursorPage<Customer>> => {
      requireOrgContext(orgId, role);
      let q = supabase
        .from('customers')
        .select('id,name,phone,balance,organization_id,created_at,created_by,location')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1);

      if (orgId && role !== UserRole.DEVELOPER) q = q.eq('organization_id', orgId);

      const parsed = parseCursor(cursor);
      if (parsed) {
        q = q.or(`created_at.lt.${parsed.cursorDate},and(created_at.eq.${parsed.cursorDate},id.lt.${parsed.cursorId})`);
      }

      const data = await safeQuery(() => q, { label: 'customers_page' });
      const rows = (data || []) as any[];
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const lastRow = page[page.length - 1];
      const nextCursor = hasMore && lastRow ? buildCursor(lastRow.created_at, lastRow.id) : null;

      return { data: page.map(transformCustomer), nextCursor };
    },
    enabled: canExecuteQuery(orgId, role),
  });
}

// ============================================
// Sales Queries
// ============================================

export function useSalesQuery(orgId?: string | null, role?: UserRole | null) {
  return useOfflineQuery({
    queryKey: queryKeys.sales(orgId),
    offlineTtlMs: OFFLINE_TTL.fast,
    queryFn: async (): Promise<Sale[]> => {
      requireOrgContext(orgId, role);
      const buildQuery = (from: number, to: number) => {
        let q = supabase
          .from('sales')
          .select('id,customer_id,customer_name,grand_total,paid_amount,remaining,payment_type,is_voided,void_reason,created_at,organization_id,created_by,discount_type,discount_value,discount_percentage')
          .order('created_at', { ascending: false })
          .range(from, to);
        if (orgId && role !== UserRole.DEVELOPER) q = q.eq('organization_id', orgId);
        return q;
      };
      return fetchAllRows(buildQuery, transformSale, 'sales');
    },
    enabled: canExecuteQuery(orgId, role),
    staleTime: STALE.fast,
  });
}

export function useSalesPaginatedQuery(orgId?: string | null, role?: UserRole | null) {
  return useCursorPagination<Sale>({
    queryKey: [...queryKeys.sales(orgId), 'paginated'],
    orgId,
    role,
    staleTime: STALE.fast,
    pageSize: PAGE_SIZE,
    fetchFn: async (cursor?: string, limit = PAGE_SIZE): Promise<CursorPage<Sale>> => {
      requireOrgContext(orgId, role);
      let q = supabase
        .from('sales')
        .select('id,customer_id,customer_name,grand_total,paid_amount,remaining,payment_type,is_voided,void_reason,created_at,organization_id,created_by,discount_type,discount_value,discount_percentage')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1);

      if (orgId && role !== UserRole.DEVELOPER) q = q.eq('organization_id', orgId);

      const parsed = parseCursor(cursor);
      if (parsed) {
        q = q.or(`created_at.lt.${parsed.cursorDate},and(created_at.eq.${parsed.cursorDate},id.lt.${parsed.cursorId})`);
      }

      const data = await safeQuery(() => q, { label: 'sales_page' });
      const rows = (data || []) as any[];
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const lastRow = page[page.length - 1];
      const nextCursor = hasMore && lastRow ? buildCursor(lastRow.created_at, lastRow.id) : null;

      return { data: page.map(transformSale), nextCursor };
    },
    enabled: canExecuteQuery(orgId, role),
  });
}

// ============================================
// Payments (Collections) Queries
// ============================================

export function usePaymentsQuery(orgId?: string | null, role?: UserRole | null) {
  return useOfflineQuery({
    queryKey: queryKeys.payments(orgId),
    offlineTtlMs: OFFLINE_TTL.fast,
    queryFn: async (): Promise<Payment[]> => {
      requireOrgContext(orgId, role);
      const buildQuery = (from: number, to: number) => {
        let q = supabase
          .from('collections')
          .select('id,sale_id,amount,notes,is_reversed,reverse_reason,created_at,organization_id,collected_by')
          .order('created_at', { ascending: false })
          .range(from, to);
        if (orgId && role !== UserRole.DEVELOPER) q = q.eq('organization_id', orgId);
        return q;
      };
      return fetchAllRows(buildQuery, transformPayment, 'payments');
    },
    enabled: canExecuteQuery(orgId, role),
    staleTime: STALE.fast,
  });
}

export function usePaymentsPaginatedQuery(orgId?: string | null, role?: UserRole | null) {
  return useCursorPagination<Payment>({
    queryKey: [...queryKeys.payments(orgId), 'paginated'],
    orgId,
    role,
    staleTime: STALE.fast,
    pageSize: PAGE_SIZE,
    fetchFn: async (cursor?: string, limit = PAGE_SIZE): Promise<CursorPage<Payment>> => {
      requireOrgContext(orgId, role);
      let q = supabase
        .from('collections')
        .select('id,sale_id,amount,notes,is_reversed,reverse_reason,created_at,organization_id,collected_by')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1);

      if (orgId && role !== UserRole.DEVELOPER) q = q.eq('organization_id', orgId);

      const parsed = parseCursor(cursor);
      if (parsed) {
        q = q.or(`created_at.lt.${parsed.cursorDate},and(created_at.eq.${parsed.cursorDate},id.lt.${parsed.cursorId})`);
      }

      const data = await safeQuery(() => q, { label: 'payments_page' });
      const rows = (data || []) as any[];
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const lastRow = page[page.length - 1];
      const nextCursor = hasMore && lastRow ? buildCursor(lastRow.created_at, lastRow.id) : null;

      return { data: page.map(transformPayment), nextCursor };
    },
    enabled: canExecuteQuery(orgId, role),
  });
}

// ============================================
// Purchases Queries
// ============================================

export function usePurchasesQuery(orgId?: string | null, role?: UserRole | null) {
  return useOfflineQuery({
    queryKey: queryKeys.purchases(orgId),
    offlineTtlMs: OFFLINE_TTL.normal,
    queryFn: async (): Promise<Purchase[]> => {
      requireOrgContext(orgId, role);
      const buildQuery = (from: number, to: number) => {
        let q = supabase
          .from('purchases')
          .select('id,product_id,product_name,quantity,unit_price,total_price,supplier_name,notes,created_at,organization_id')
          .order('created_at', { ascending: false })
          .range(from, to);
        if (orgId && role !== UserRole.DEVELOPER) q = q.eq('organization_id', orgId);
        return q;
      };
      return fetchAllRows(buildQuery, transformPurchase, 'purchases');
    },
    enabled: canExecuteQuery(orgId, role),
    staleTime: STALE.normal,
  });
}

export function usePurchasesPaginatedQuery(orgId?: string | null, role?: UserRole | null) {
  return useCursorPagination<Purchase>({
    queryKey: [...queryKeys.purchases(orgId), 'paginated'],
    orgId,
    role,
    staleTime: STALE.normal,
    pageSize: PAGE_SIZE,
    fetchFn: async (cursor?: string, limit = PAGE_SIZE): Promise<CursorPage<Purchase>> => {
      requireOrgContext(orgId, role);
      let q = supabase
        .from('purchases')
        .select('id,product_id,product_name,quantity,unit_price,total_price,supplier_name,notes,created_at,organization_id')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1);

      if (orgId && role !== UserRole.DEVELOPER) q = q.eq('organization_id', orgId);

      const parsed = parseCursor(cursor);
      if (parsed) {
        q = q.or(`created_at.lt.${parsed.cursorDate},and(created_at.eq.${parsed.cursorDate},id.lt.${parsed.cursorId})`);
      }

      const data = await safeQuery(() => q, { label: 'purchases_page' });
      const rows = (data || []) as any[];
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const lastRow = page[page.length - 1];
      const nextCursor = hasMore && lastRow ? buildCursor(lastRow.created_at, lastRow.id) : null;

      return { data: page.map(transformPurchase), nextCursor };
    },
    enabled: canExecuteQuery(orgId, role),
  });
}

// ============================================
// Deliveries Queries
// ============================================

export function useDeliveriesQuery(orgId?: string | null, role?: UserRole | null) {
  return useOfflineQuery({
    queryKey: queryKeys.deliveries(orgId),
    offlineTtlMs: OFFLINE_TTL.normal,
    queryFn: async (): Promise<Delivery[]> => {
      requireOrgContext(orgId, role);
      const buildQuery = (from: number, to: number) => {
        let q = supabase
          .from('deliveries')
          .select('id,distributor_name,status,notes,created_at,organization_id,distributor_id')
          .order('created_at', { ascending: false })
          .range(from, to);
        if (orgId && role !== UserRole.DEVELOPER) q = q.eq('organization_id', orgId);
        return q;
      };
      return fetchAllRows(buildQuery, transformDelivery, 'deliveries');
    },
    enabled: canExecuteQuery(orgId, role),
    staleTime: STALE.normal,
  });
}

export function useDeliveriesPaginatedQuery(orgId?: string | null, role?: UserRole | null) {
  return useCursorPagination<Delivery>({
    queryKey: [...queryKeys.deliveries(orgId), 'paginated'],
    orgId,
    role,
    staleTime: STALE.normal,
    pageSize: PAGE_SIZE,
    fetchFn: async (cursor?: string, limit = PAGE_SIZE): Promise<CursorPage<Delivery>> => {
      requireOrgContext(orgId, role);
      let q = supabase
        .from('deliveries')
        .select('id,distributor_name,status,notes,created_at,organization_id,distributor_id')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1);

      if (orgId && role !== UserRole.DEVELOPER) q = q.eq('organization_id', orgId);

      const parsed = parseCursor(cursor);
      if (parsed) {
        q = q.or(`created_at.lt.${parsed.cursorDate},and(created_at.eq.${parsed.cursorDate},id.lt.${parsed.cursorId})`);
      }

      const data = await safeQuery(() => q, { label: 'deliveries_page' });
      const rows = (data || []) as any[];
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const lastRow = page[page.length - 1];
      const nextCursor = hasMore && lastRow ? buildCursor(lastRow.created_at, lastRow.id) : null;

      return { data: page.map(transformDelivery), nextCursor };
    },
    enabled: canExecuteQuery(orgId, role),
  });
}

// ============================================
// Pending Employees Queries (small dataset — no pagination needed)
// ============================================

export function usePendingEmployeesQuery(
  orgId?: string | null,
  role?: UserRole | null,
  employeeType?: EmployeeType
) {
  const canView = role === UserRole.OWNER || 
    (role === UserRole.EMPLOYEE && employeeType === EmployeeType.SALES_MANAGER);

  return useOfflineQuery({
    queryKey: queryKeys.pendingEmployees(orgId),
    offlineTtlMs: OFFLINE_TTL.normal,
    queryFn: async (): Promise<PendingEmployee[]> => {
      requireOrgContext(orgId, role);
      let query = supabase
        .from('pending_employees')
        .select('id,name,phone,role,employee_type,activation_code,is_used,created_at,organization_id,activated_at,activated_by')
        .order('created_at', { ascending: false });

      if (orgId) {
        query = query.eq('organization_id', orgId);
      }

      const data = await safeQuery(() => query, { label: 'pendingEmployees' });
      return (data || []).map(transformPendingEmployee);
    },
    enabled: !!orgId && canView,
    staleTime: STALE.normal,
  });
}

// ============================================
// Distributor Inventory Queries (small dataset — no pagination needed)
// ============================================

export function useDistributorInventoryQuery(orgId?: string | null, role?: UserRole | null) {
  return useOfflineQuery({
    queryKey: queryKeys.distributorInventory(orgId),
    offlineTtlMs: OFFLINE_TTL.normal,
    queryFn: async (): Promise<DistributorInventoryItem[]> => {
      requireOrgContext(orgId, role);
      let query = supabase
        .from('distributor_inventory')
        .select('id,distributor_id,product_id,product_name,quantity,organization_id,updated_at')
        .order('updated_at', { ascending: false });

      if (orgId && role !== UserRole.DEVELOPER) {
        query = query.eq('organization_id', orgId);
      }

      const data = await safeQuery(() => query, { label: 'distributorInventory' });
      return (data || []).map(transformDistributorInventory);
    },
    enabled: canExecuteQuery(orgId, role),
    staleTime: STALE.normal,
  });
}

// ============================================
// Users Queries (small dataset — no pagination needed)
// ============================================

export function useUsersQuery(
  orgId?: string | null,
  role?: UserRole | null,
  employeeType?: EmployeeType
) {
  const canView = role === UserRole.OWNER || 
    role === UserRole.DEVELOPER ||
    role === UserRole.EMPLOYEE;

  return useOfflineQuery({
    queryKey: queryKeys.users(orgId),
    offlineTtlMs: OFFLINE_TTL.normal,
    queryFn: async () => {
      requireOrgContext(orgId, role);
      const data = await safeQuery(
        () => supabase
          .from('profiles')
          .select('id,full_name,phone,role,employee_type,license_key,organization_id,is_active')
          .eq('organization_id', orgId!),
        { label: 'users' }
      );
      return (data || []).map(transformUser);
    },
    enabled: !!orgId && canView,
    staleTime: STALE.normal,
  });
}

// ============================================
// Purchase Returns Queries
// ============================================

export interface PurchaseReturn {
  id: string;
  supplier_name: string | null;
  total_amount: number;
  reason: string | null;
  created_at: string;
  created_by: string | null;
  organization_id: string;
}

export function usePurchaseReturnsQuery(orgId?: string | null, role?: UserRole | null, employeeType?: string | null) {
  const canView = role === UserRole.OWNER || role === UserRole.DEVELOPER || employeeType === 'WAREHOUSE_KEEPER' || employeeType === 'ACCOUNTANT';
  return useOfflineQuery({
    queryKey: queryKeys.purchaseReturns(orgId),
    offlineTtlMs: OFFLINE_TTL.normal,
    queryFn: async (): Promise<PurchaseReturn[]> => {
      requireOrgContext(orgId, role);
      const buildQuery = (from: number, to: number) => {
        let q = supabase
          .from('purchase_returns')
          .select('id,supplier_name,total_amount,reason,created_at,created_by,organization_id')
          .order('created_at', { ascending: false })
          .range(from, to);
        if (orgId && role !== UserRole.DEVELOPER) q = q.eq('organization_id', orgId);
        return q;
      };
      return fetchAllRows(buildQuery, (r: any) => r as PurchaseReturn, 'purchaseReturns');
    },
    enabled: !!orgId && canView,
    staleTime: STALE.normal,
  });
}

// ============================================
// Licenses Queries (Developer only — small dataset)
// ============================================

export function useLicensesQuery(role?: UserRole | null) {
  return useOfflineQuery({
    queryKey: queryKeys.licenses(),
    offlineTtlMs: OFFLINE_TTL.slow,
    queryFn: async (): Promise<License[]> => {
      const data = await safeQuery(
        () => supabase
          .from('developer_licenses')
          .select('id,licenseKey,orgName,type,status,ownerId,issuedAt,expiryDate,days_valid,max_employees,owner_phone,monthly_price,renewal_alert_days,organization_id')
          .order('issuedAt', { ascending: false }),
        { label: 'licenses' }
      );
      return (data || []).map(transformLicense);
    },
    enabled: role === UserRole.DEVELOPER,
    staleTime: STALE.slow,
  });
}

// ============================================
// Organization Stats Queries (Developer only)
// ============================================

export function useOrgStatsQuery(role?: UserRole | null) {
  return useOfflineQuery({
    queryKey: queryKeys.orgStats(),
    offlineTtlMs: OFFLINE_TTL.slow,
    skipOfflineCache: true,
    queryFn: async (): Promise<OrgStats[]> => {
      const data = await safeQuery(
        () => supabase.rpc('get_organization_stats_rpc'),
        { label: 'orgStats' }
      );
      return Array.isArray(data) ? (data as unknown as OrgStats[]) : [];
    },
    enabled: role === UserRole.DEVELOPER,
    staleTime: STALE.slow,
  });
}
