import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Search, Plus, Settings2, Trash2, AlertTriangle } from 'lucide-react';
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

export const ProductsView: React.FC<Props> = ({
  filteredProducts,
  lowStockCount,
  searchTerm,
  setSearchTerm,
  onOpenProductModal,
  onDeleteProduct,
}) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      {lowStockCount > 0 && (
        <div className="bg-warning/10 p-4 rounded-2xl border border-warning/20 flex items-center gap-3">
          <AlertTriangle size={20} className="text-warning shrink-0" />
          <p className="text-xs font-bold text-warning">{lowStockCount} {t('ownerInventory.lowStockAlert')}</p>
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('ownerInventory.searchProduct')}
            className="input-field pr-10"
          />
        </div>
        <button onClick={() => onOpenProductModal(null)} className="px-4 bg-primary text-primary-foreground rounded-2xl flex items-center gap-1">
          <Plus size={18} />
        </button>
      </div>

      <div className="space-y-2">
        {filteredProducts.length === 0 ? (
          <div className="bg-card p-8 rounded-[2.5rem] border text-center">
            <Box size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground font-bold">{t('ownerInventory.noProducts')}</p>
          </div>
        ) : (
          filteredProducts.map(p => (
            <div key={p.id} className="bg-card p-4 rounded-[1.8rem] border shadow-sm flex justify-between items-center">
              <div>
                <p className="font-black text-foreground text-sm">{p.name}</p>
                <p className="text-[9px] text-muted-foreground font-bold">{p.category}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-black px-2 py-1 rounded-lg ${p.stock <= p.minStock ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                  {p.stock} {p.unit}
                </span>
                <button onClick={() => onOpenProductModal(p)} className="p-2 bg-muted rounded-xl text-muted-foreground hover:text-primary">
                  <Settings2 size={16} />
                </button>
                <button onClick={() => onDeleteProduct(p.id)} className="p-2 bg-destructive/10 rounded-xl text-destructive">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
