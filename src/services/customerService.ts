/**
 * Customer Service - All customer-related Supabase operations
 */
import { supabase } from '@/integrations/supabase/client';
import { safeQuery, validateRequiredString, QueryError } from '@/lib/safeQuery';
import { Customer } from '@/types';
import { transformCustomer } from '@/hooks/useDataOperations';
import { performanceMonitor } from '@/utils/monitoring/performanceMonitor';

export const customerService = {
  async fetchCustomers(orgId: string, isDeveloper: boolean, cursor?: string, limit = 50): Promise<{ data: Customer[]; nextCursor: string | null }> {
    const end = performanceMonitor.startTimer('customerService.fetchCustomers');
    try {
      let query = supabase
        .from('customers')
        .select('id,name,phone,balance,organization_id,created_at,created_by,location')
        .order('created_at', { ascending: false })
        .limit(limit + 1);

      if (!isDeveloper) {
        query = query.eq('organization_id', orgId);
      }
      if (cursor) {
        query = query.lt('created_at', cursor);
      }

      const data = await safeQuery(() => query, { label: 'customers' });
      const rows = data || [];
      const hasMore = rows.length > limit;
      const pageData = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? pageData[pageData.length - 1].created_at : null;

      return { data: pageData.map(transformCustomer), nextCursor };
    } finally {
      end();
    }
  },

  async addCustomer(name: string, phone: string, orgId: string, userId: string, location?: string): Promise<void> {
    validateRequiredString(name, 'اسم العميل');

    const { error } = await supabase.from('customers').insert({
      name, phone, location, organization_id: orgId, created_by: userId,
    });
    if (error) throw error;
  },
};
