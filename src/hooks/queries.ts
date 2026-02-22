/**
 * Domain Query Hooks - React Query based data fetching
 * 
 * Security: Every org-scoped query includes .eq('organization_id', orgId) (Section 1)
 * Performance: Partial selects to reduce payload size (Section 5)
 * Safety: Queries only run with valid org context (Section 2)
 */
import { useQuery } from '@tanstack/react-query';
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

// Domain-specific stale times (Section 7)
const STALE = {
  fast: 2 * 60 * 1000,     // 2 min - sales, payments (frequently changing)
  normal: 5 * 60 * 1000,   // 5 min - products, customers
  slow: 10 * 60 * 1000,    // 10 min - licenses, org stats
};

// Max rows per query to prevent hitting Supabase 1000-row default
const PAGE_LIMIT = 500;

// ============================================
// Product Queries — Section 1: org filter + Section 5: partial select
// ============================================

export function useProductsQuery(orgId?: string | null, role?: UserRole | null) {
  return useQuery({
    queryKey: queryKeys.products(orgId),
    queryFn: async (): Promise<Product[]> => {
      requireOrgContext(orgId, role);
      // Section 5: partial select — only fields needed by UI
      let query = supabase
        .from('products')
        .select('id,name,category,cost_price,base_price,consumer_price,stock,min_stock,unit,is_deleted,organization_id')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .range(0, PAGE_LIMIT - 1);

      if (orgId && role !== UserRole.DEVELOPER) {
        query = query.eq('organization_id', orgId);
      }

      const data = await safeQuery(() => query, { label: 'products' });
      return (data || []).map(transformProduct);
    },
    // Section 2: safe enable condition
    enabled: canExecuteQuery(orgId, role),
    staleTime: STALE.normal,
  });
}

// ============================================
// Customer Queries
// ============================================

export function useCustomersQuery(orgId?: string | null, role?: UserRole | null) {
  return useQuery({
    queryKey: queryKeys.customers(orgId),
    queryFn: async (): Promise<Customer[]> => {
      requireOrgContext(orgId, role);
      let query = supabase
        .from('customers')
        .select('id,name,phone,balance,organization_id,created_at,created_by,location')
        .order('created_at', { ascending: false })
        .range(0, PAGE_LIMIT - 1);

      if (orgId && role !== UserRole.DEVELOPER) {
        query = query.eq('organization_id', orgId);
      }

      const data = await safeQuery(() => query, { label: 'customers' });
      return (data || []).map(transformCustomer);
    },
    enabled: canExecuteQuery(orgId, role),
    staleTime: STALE.normal,
  });
}

// ============================================
// Sales Queries
// ============================================

export function useSalesQuery(orgId?: string | null, role?: UserRole | null) {
  return useQuery({
    queryKey: queryKeys.sales(orgId),
    queryFn: async (): Promise<Sale[]> => {
      requireOrgContext(orgId, role);
      let query = supabase
        .from('sales')
        .select('id,customer_id,customer_name,grand_total,paid_amount,remaining,payment_type,is_voided,void_reason,created_at,organization_id,created_by')
        .order('created_at', { ascending: false })
        .range(0, PAGE_LIMIT - 1);

      if (orgId && role !== UserRole.DEVELOPER) {
        query = query.eq('organization_id', orgId);
      }

      const data = await safeQuery(() => query, { label: 'sales' });
      return (data || []).map(transformSale);
    },
    enabled: canExecuteQuery(orgId, role),
    staleTime: STALE.fast,
  });
}

// ============================================
// Payments (Collections) Queries
// ============================================

export function usePaymentsQuery(orgId?: string | null, role?: UserRole | null) {
  return useQuery({
    queryKey: queryKeys.payments(orgId),
    queryFn: async (): Promise<Payment[]> => {
      requireOrgContext(orgId, role);
      let query = supabase
        .from('collections')
        .select('id,sale_id,amount,notes,is_reversed,reverse_reason,created_at,organization_id,collected_by')
        .order('created_at', { ascending: false })
        .range(0, PAGE_LIMIT - 1);

      if (orgId && role !== UserRole.DEVELOPER) {
        query = query.eq('organization_id', orgId);
      }

      const data = await safeQuery(() => query, { label: 'payments' });
      return (data || []).map(transformPayment);
    },
    enabled: canExecuteQuery(orgId, role),
    staleTime: STALE.fast,
  });
}

// ============================================
// Purchases Queries
// ============================================

export function usePurchasesQuery(orgId?: string | null, role?: UserRole | null) {
  return useQuery({
    queryKey: queryKeys.purchases(orgId),
    queryFn: async (): Promise<Purchase[]> => {
      requireOrgContext(orgId, role);
      let query = supabase
        .from('purchases')
        .select('id,product_id,product_name,quantity,unit_price,total_price,supplier_name,notes,created_at,organization_id')
        .order('created_at', { ascending: false })
        .range(0, PAGE_LIMIT - 1);

      if (orgId && role !== UserRole.DEVELOPER) {
        query = query.eq('organization_id', orgId);
      }

      const data = await safeQuery(() => query, { label: 'purchases' });
      return (data || []).map(transformPurchase);
    },
    enabled: canExecuteQuery(orgId, role),
    staleTime: STALE.normal,
  });
}

// ============================================
// Deliveries Queries
// ============================================

export function useDeliveriesQuery(orgId?: string | null, role?: UserRole | null) {
  return useQuery({
    queryKey: queryKeys.deliveries(orgId),
    queryFn: async (): Promise<Delivery[]> => {
      requireOrgContext(orgId, role);
      let query = supabase
        .from('deliveries')
        .select('id,distributor_name,status,notes,created_at,organization_id,distributor_id')
        .order('created_at', { ascending: false })
        .range(0, PAGE_LIMIT - 1);

      if (orgId && role !== UserRole.DEVELOPER) {
        query = query.eq('organization_id', orgId);
      }

      const data = await safeQuery(() => query, { label: 'deliveries' });
      return (data || []).map(transformDelivery);
    },
    enabled: canExecuteQuery(orgId, role),
    staleTime: STALE.normal,
  });
}

// ============================================
// Pending Employees Queries
// ============================================

export function usePendingEmployeesQuery(
  orgId?: string | null,
  role?: UserRole | null,
  employeeType?: EmployeeType
) {
  const canView = role === UserRole.OWNER || 
    (role === UserRole.EMPLOYEE && employeeType === EmployeeType.SALES_MANAGER);

  return useQuery({
    queryKey: queryKeys.pendingEmployees(orgId),
    queryFn: async (): Promise<PendingEmployee[]> => {
      requireOrgContext(orgId, role);
      let query = supabase
        .from('pending_employees')
        .select('id,name,phone,role,employee_type,activation_code,is_used,created_at,organization_id,activated_at,activated_by')
        .order('created_at', { ascending: false });

      // Always filter by org for non-developers
      if (orgId) {
        query = query.eq('organization_id', orgId);
      }

      const data = await safeQuery(() => query, { label: 'pendingEmployees' });
      return (data || []).map(transformPendingEmployee);
    },
    // Require both orgId and role permission
    enabled: !!orgId && canView,
    staleTime: STALE.normal,
    // Polling replaced by Realtime subscriptions (useRealtimeSync)
  });
}

// ============================================
// Distributor Inventory Queries
// ============================================

export function useDistributorInventoryQuery(orgId?: string | null, role?: UserRole | null) {
  return useQuery({
    queryKey: queryKeys.distributorInventory(orgId),
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
    // Polling replaced by Realtime subscriptions (useRealtimeSync)
  });
}

// ============================================
// Users Queries
// ============================================

export function useUsersQuery(
  orgId?: string | null,
  role?: UserRole | null,
  employeeType?: EmployeeType
) {
  // All authenticated org users can fetch the users list.
  // RLS policies on profiles table enforce actual data visibility per role.
  const canView = role === UserRole.OWNER || 
    role === UserRole.DEVELOPER ||
    role === UserRole.EMPLOYEE;

  return useQuery({
    queryKey: queryKeys.users(orgId),
    queryFn: async () => {
      requireOrgContext(orgId, role);
      // Section 5: partial select for user profiles
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
    // Polling replaced by Realtime subscriptions (useRealtimeSync)
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
  return useQuery({
    queryKey: queryKeys.purchaseReturns(orgId),
    queryFn: async (): Promise<PurchaseReturn[]> => {
      requireOrgContext(orgId, role);
      let query = supabase
        .from('purchase_returns')
        .select('id,supplier_name,total_amount,reason,created_at,created_by,organization_id')
        .order('created_at', { ascending: false })
        .range(0, PAGE_LIMIT - 1);

      if (orgId && role !== UserRole.DEVELOPER) {
        query = query.eq('organization_id', orgId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PurchaseReturn[];
    },
    enabled: !!orgId && canView,
    staleTime: STALE.normal,
  });
}

// ============================================
// Licenses Queries (Developer only)
// ============================================

export function useLicensesQuery(role?: UserRole | null) {
  return useQuery({
    queryKey: queryKeys.licenses(),
    queryFn: async (): Promise<License[]> => {
      const data = await safeQuery(
        () => supabase
          .from('developer_licenses')
          .select('id,licenseKey,orgName,type,status,ownerId,issuedAt,expiryDate,days_valid,max_employees,owner_phone')
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
  return useQuery({
    queryKey: queryKeys.orgStats(),
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
