/**
 * Product Service - All product-related Supabase operations
 */
import { supabase } from '@/integrations/supabase/client';
import { safeQuery, validateUUID, validateRequiredString, validatePositiveNumber } from '@/lib/safeQuery';
import { Product } from '@/types';
import { transformProduct } from '@/hooks/useDataOperations';
import { performanceMonitor } from '@/utils/monitoring/performanceMonitor';

export const productService = {
  async fetchProducts(orgId: string, isDeveloper: boolean, cursor?: string, limit = 50): Promise<{ data: Product[]; nextCursor: string | null }> {
    const end = performanceMonitor.startTimer('productService.fetchProducts');
    try {
      let query = supabase
        .from('products')
        .select('id,name,category,cost_price,base_price,consumer_price,pricing_currency,stock,min_stock,unit,is_deleted,organization_id,created_at')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(limit + 1);

      if (!isDeveloper) {
        query = query.eq('organization_id', orgId);
      }
      if (cursor) {
        query = query.lt('created_at', cursor);
      }

      const data = await safeQuery(() => query, { label: 'products' });
      const rows = data || [];
      const hasMore = rows.length > limit;
      const pageData = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? pageData[pageData.length - 1].created_at : null;

      return { data: pageData.map(transformProduct), nextCursor };
    } finally {
      end();
    }
  },

  async addProduct(product: Omit<Product, 'id' | 'organization_id'>, orgId: string): Promise<void> {
    validateRequiredString(product.name, 'اسم المنتج');
    validatePositiveNumber(product.basePrice, 'سعر البيع');

    const { error } = await supabase.from('products').insert({
      name: product.name, category: product.category,
      cost_price: 0, // unused — system no longer tracks cost
      base_price: product.basePrice,
      consumer_price: product.consumerPrice ?? 0,
      pricing_currency: product.pricingCurrency === 'USD' ? 'USD' : 'SYP',
      stock: product.stock, min_stock: product.minStock,
      unit: product.unit, organization_id: orgId,
    });
    if (error) throw error;
  },

  async updateProduct(product: Product): Promise<void> {
    validateUUID(product.id, 'معرف المنتج');
    validateRequiredString(product.name, 'اسم المنتج');

    const { error } = await supabase.from('products').update({
      name: product.name, category: product.category,
      cost_price: 0, // unused
      base_price: product.basePrice,
      consumer_price: product.consumerPrice ?? 0,
      pricing_currency: product.pricingCurrency === 'USD' ? 'USD' : 'SYP',
      stock: product.stock, min_stock: product.minStock,
      unit: product.unit,
    }).eq('id', product.id);
    if (error) throw error;
  },

  async deleteProduct(id: string): Promise<void> {
    validateUUID(id, 'معرف المنتج');
    const { error } = await supabase.from('products').update({ is_deleted: true }).eq('id', id);
    if (error) throw error;
  },

  async logPriceChanges(
    oldProduct: Product, newProduct: Product, orgId: string, userId: string, changerName: string
  ): Promise<void> {
    // cost_price tracking removed — only sales/consumer prices are user-editable now.
    const priceFields = [
      { field: 'base_price', old: oldProduct.basePrice, new: newProduct.basePrice },
      { field: 'consumer_price', old: oldProduct.consumerPrice, new: newProduct.consumerPrice ?? 0 },
    ];
    const changes = priceFields.filter(f => f.old !== f.new);
    if (changes.length > 0) {
      await Promise.all(changes.map(c =>
        supabase.from('price_change_history').insert({
          product_id: newProduct.id, product_name: newProduct.name,
          field_changed: c.field, old_value: c.old, new_value: c.new,
          changed_by: userId, changed_by_name: changerName, organization_id: orgId,
        })
      ));
    }
  },
};
