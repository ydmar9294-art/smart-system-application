import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Search, Plus, Settings2, Trash2, AlertTriangle } from 'lucide-react';
import { VirtualList } from '@/components/ui/VirtualList';
import type { Product } from '@/types';

interface Props {
  products: Product[];
  filteredProducts: Product[];
  lowStockCount: number;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  onOpenProductModal: (p?: Product | null) => void;
  onDeleteProduct: (id: string) => void;
}

/**
 * Renders large product catalogs (up to 2,000+ items) using virtualization.
 * Falls back to a normal list for tiny catalogs (< 30 items) for simplicity.
 */
const ProductRow: React.FC<{
  p: Product;
  onEdit: (p: Product) => void;
  onDelete: (id: string) => void;
}> = React.memo(({ p, onEdit, onDelete }) => (
  <div className="bg-card p-4 rounded-2xl border shadow-sm flex justify-between items-center gap-2">
    <div className="min-w-0 flex-1">
      <p className="font-black text-foreground text-sm truncate">{p.name}</p>
      <p className="text-[10px] text-muted-foreground font-bold truncate">{p.category}</p>
    </div>
    <div className="flex items-center gap-1.5 shrink-0">
      <span className={`text-xs font-black px-2 py-1 rounded-lg whitespace-nowrap ${p.stock <= p.minStock ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
        {p.stock} {p.unit}
      </span>
      <button onClick={() => onEdit(p)} className="p-2 bg-muted rounded-xl text-muted-foreground hover:text-primary active:scale-95 transition-transform">
        <Settings2 size={16} />
      </button>
      <button onClick={() => onDelete(p.id)} className="p-2 bg-destructive/10 rounded-xl text-destructive active:scale-95 transition-transform">
        <Trash2 size={16} />
      </button>
    </div>
  </div>
));
ProductRow.displayName = 'ProductRow';

export const ProductsView: React.FC<Props> = ({
  filteredProducts,
  lowStockCount,
  searchTerm,
  setSearchTerm,
  onOpenProductModal,
  onDeleteProduct,
}) => {
  const { t } = useTranslation();
  const useVirtual = filteredProducts.length > 30;

  return (
    <div className="space-y-3">
      {lowStockCount > 0 && (
        <div className="bg-warning/10 p-4 rounded-2xl border border-warning/20 flex items-center gap-3">
          <AlertTriangle size={20} className="text-warning shrink-0" />
          <p className="text-xs font-bold text-warning">{lowStockCount} {t('ownerInventory.lowStockAlert')}</p>
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('ownerInventory.searchProduct')}
            className="input-field pr-10"
          />
        </div>
        <button onClick={() => onOpenProductModal(null)} className="px-4 bg-primary text-primary-foreground rounded-2xl flex items-center gap-1 shrink-0 active:scale-95 transition-transform">
          <Plus size={18} />
        </button>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="bg-card p-8 rounded-3xl border text-center">
          <Box size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground font-bold">{t('ownerInventory.noProducts')}</p>
        </div>
      ) : useVirtual ? (
        <div style={{ height: 'calc(100vh - 320px)', minHeight: 400 }}>
          <VirtualList
            items={filteredProducts}
            itemHeight={84}
            overscan={6}
            containerHeight="100%"
            renderItem={(p) => (
              <div className="pb-2">
                <ProductRow p={p} onEdit={onOpenProductModal} onDelete={onDeleteProduct} />
              </div>
            )}
          />
        </div>
      ) : (
        <div className="space-y-2">
          {filteredProducts.map(p => (
            <ProductRow key={p.id} p={p} onEdit={onOpenProductModal} onDelete={onDeleteProduct} />
          ))}
        </div>
      )}
    </div>
  );
};
