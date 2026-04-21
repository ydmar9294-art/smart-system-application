/**
 * Shared types for InventoryTab sub-components.
 * Extracted as part of Phase 5 split — no behavior changes.
 */
export interface DeliveryItem {
  product_id: string;
  product_name: string;
  quantity: number;
}

export interface PurchaseReturnItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export type InventorySubTab = 'products' | 'purchases' | 'purchase-returns' | 'deliveries';
