/**
 * Stock Movements Tab - Shows all stock movements including distributor returns
 * Part 2: Visible in Warehouse Keeper interface
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/store/AuthContext';
import { ArrowUpDown, Package, Calendar, User, Loader2, Filter } from 'lucide-react';
import { CURRENCY } from '@/constants';

interface StockMovement {
  id: string;
  product_id: string;
  quantity: number;
  movement_type: string;
  source_type: string;
  destination_type: string;
  source_id: string | null;
  destination_id: string | null;
  notes: string | null;
  created_at: string;
  reference_id: string | null;
  product_name?: string;
}

const MOVEMENT_LABELS: Record<string, string> = {
  'TRANSFER': 'تحويل',
  'SALE': 'بيع',
  'RETURN': 'مرتجع مبيعات',
  'PURCHASE': 'شراء',
  'ADJUSTMENT': 'تعديل',
  'DELIVERY': 'تسليم',
};

const MOVEMENT_COLORS: Record<string, string> = {
  'TRANSFER': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'SALE': 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  'RETURN': 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  'PURCHASE': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  'ADJUSTMENT': 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  'DELIVERY': 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
};

const StockMovementsTab: React.FC = () => {
  const { organization } = useAuth();
  const [filterType, setFilterType] = useState<string>('all');
  const orgId = organization?.id;

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ['stockMovements', orgId],
    queryFn: async (): Promise<StockMovement[]> => {
      if (!orgId) return [];
      
      const { data, error } = await supabase
        .from('stock_movements')
        .select('id,product_id,quantity,movement_type,source_type,destination_type,source_id,destination_id,notes,created_at,reference_id')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .range(0, 99);

      if (error) throw error;

      // Fetch product names
      const productIds = [...new Set((data || []).map(m => m.product_id))];
      const { data: products } = await supabase
        .from('products')
        .select('id,name')
        .in('id', productIds);

      const productMap = new Map((products || []).map(p => [p.id, p.name]));

      return (data || []).map(m => ({
        ...m,
        product_name: productMap.get(m.product_id) || 'منتج غير معروف',
      }));
    },
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000,
  });

  const filteredMovements = filterType === 'all' 
    ? movements 
    : movements.filter(m => m.movement_type === filterType);

  const movementTypes = [...new Set(movements.map(m => m.movement_type))];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
            filterType === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          الكل ({movements.length})
        </button>
        {movementTypes.map(type => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
              filterType === type ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {MOVEMENT_LABELS[type] || type} ({movements.filter(m => m.movement_type === type).length})
          </button>
        ))}
      </div>

      {/* Movements List */}
      {filteredMovements.length === 0 ? (
        <div className="bg-card p-8 rounded-2xl text-center">
          <ArrowUpDown className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-bold">لا توجد حركات مخزنية</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMovements.map(movement => (
            <div key={movement.id} className="bg-card p-4 rounded-2xl shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${MOVEMENT_COLORS[movement.movement_type] || 'bg-muted'}`}>
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm">{movement.product_name}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(movement.created_at).toLocaleDateString('ar-EG')} - {new Date(movement.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="text-left">
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold ${MOVEMENT_COLORS[movement.movement_type] || 'bg-muted text-muted-foreground'}`}>
                    {MOVEMENT_LABELS[movement.movement_type] || movement.movement_type}
                  </span>
                  <p className="text-lg font-black text-foreground mt-1">{movement.quantity}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
                <span>من: {movement.source_type === 'central' ? 'المستودع الرئيسي' : movement.source_type === 'distributor' ? 'مخزن الموزع' : movement.source_type}</span>
                <span>←</span>
                <span>إلى: {movement.destination_type === 'central' ? 'المستودع الرئيسي' : movement.destination_type === 'distributor' ? 'مخزن الموزع' : movement.destination_type === 'customer' ? 'العميل' : movement.destination_type}</span>
              </div>
              
              {movement.notes && (
                <p className="text-xs text-muted-foreground mt-2 bg-muted p-2 rounded-lg">{movement.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StockMovementsTab;
