/**
 * Accountant Data Hook - READ-ONLY React Query hooks for financial analytics
 * No mutations. Only SELECT queries and RPC reads.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/store/AuthContext';

// ============================================
// Financial Summary (RPC-based)
// ============================================
export function useFinancialSummary() {
  return useQuery({
    queryKey: ['accountant', 'financial-summary'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_financial_summary_rpc');
      if (error) throw error;
      return data as {
        purchases_total: number;
        sales_returns_total: number;
        purchase_returns_total: number;
        collections_total: number;
        total_discounts: number;
        distributor_inventory: any[];
      };
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

// ============================================
// Sales Returns (paginated via React Query)
// ============================================
export function useSalesReturnsQuery() {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ['accountant', 'sales-returns', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('sales_returns')
        .select('id, sale_id, customer_name, total_amount, reason, created_at')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id,
    staleTime: 2 * 60 * 1000,
  });
}

// ============================================
// Purchase Returns (paginated via React Query)
// ============================================
export function usePurchaseReturnsQuery() {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ['accountant', 'purchase-returns', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('purchase_returns')
        .select('id, supplier_name, total_amount, reason, created_at')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id,
    staleTime: 2 * 60 * 1000,
  });
}

// ============================================
// Daily Sales Trend (for charts)
// ============================================
export function useDailySalesTrend(days: number = 30) {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ['accountant', 'daily-sales-trend', organization?.id, days],
    queryFn: async () => {
      if (!organization?.id) return [];
      const since = new Date();
      since.setDate(since.getDate() - days);
      
      const { data, error } = await supabase
        .from('sales')
        .select('created_at, grand_total, paid_amount, is_voided')
        .eq('organization_id', organization.id)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true });
      if (error) throw error;
      
      // Group by day
      const grouped: Record<string, { sales: number; collections: number; count: number }> = {};
      (data || []).forEach(s => {
        if (s.is_voided) return;
        const day = new Date(s.created_at).toISOString().slice(0, 10);
        if (!grouped[day]) grouped[day] = { sales: 0, collections: 0, count: 0 };
        grouped[day].sales += Number(s.grand_total);
        grouped[day].collections += Number(s.paid_amount);
        grouped[day].count += 1;
      });
      
      return Object.entries(grouped)
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date));
    },
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================
// Collections by date (for chart overlay)
// ============================================
export function useCollectionsTrend(days: number = 30) {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ['accountant', 'collections-trend', organization?.id, days],
    queryFn: async () => {
      if (!organization?.id) return [];
      const since = new Date();
      since.setDate(since.getDate() - days);
      
      const { data, error } = await supabase
        .from('collections')
        .select('created_at, amount, is_reversed')
        .eq('organization_id', organization.id)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true });
      if (error) throw error;
      
      const grouped: Record<string, number> = {};
      (data || []).forEach(c => {
        if (c.is_reversed) return;
        const day = new Date(c.created_at).toISOString().slice(0, 10);
        grouped[day] = (grouped[day] || 0) + Number(c.amount);
      });
      
      return Object.entries(grouped)
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date));
    },
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================
// Customer statement data
// ============================================
export function useCustomerStatement(customerId: string | null) {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ['accountant', 'customer-statement', customerId],
    queryFn: async () => {
      if (!organization?.id || !customerId) return { sales: [], collections: [], returns: [] };
      
      const [salesRes, collectionsRes, returnsRes] = await Promise.all([
        supabase
          .from('sales')
          .select('id, grand_total, paid_amount, remaining, created_at, payment_type, is_voided')
          .eq('organization_id', organization.id)
          .eq('customer_id', customerId)
          .order('created_at', { ascending: true })
          .limit(200),
        supabase
          .from('collections')
          .select('id, amount, created_at, is_reversed, sale_id')
          .eq('organization_id', organization.id)
          .in('sale_id', (await supabase
            .from('sales')
            .select('id')
            .eq('customer_id', customerId)
            .eq('organization_id', organization.id)
            .limit(200)).data?.map(s => s.id) || [])
          .order('created_at', { ascending: true })
          .limit(500),
        supabase
          .from('sales_returns')
          .select('id, total_amount, reason, created_at')
          .eq('organization_id', organization.id)
          .in('sale_id', (await supabase
            .from('sales')
            .select('id')
            .eq('customer_id', customerId)
            .eq('organization_id', organization.id)
            .limit(200)).data?.map(s => s.id) || [])
          .order('created_at', { ascending: true })
          .limit(200),
      ]);
      
      return {
        sales: salesRes.data || [],
        collections: collectionsRes.data || [],
        returns: returnsRes.data || [],
      };
    },
    enabled: !!customerId && !!organization?.id,
    staleTime: 2 * 60 * 1000,
  });
}
