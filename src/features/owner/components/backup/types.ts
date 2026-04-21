/**
 * Shared types for BackupTab sub-components.
 */
export interface BackupCustomer {
  id: string;
  name: string;
  phone: string | null;
  location: string | null;
  balance: number;
  created_by: string | null;
  distributor_name?: string;
}

export interface BackupInvoiceItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface BackupInvoice {
  id: string;
  customer_name: string;
  customer_id: string;
  grand_total: number;
  paid_amount: number;
  remaining: number;
  payment_type: string;
  is_voided: boolean;
  void_reason: string | null;
  created_at: string;
  created_by: string | null;
  discount_type: string | null;
  discount_percentage: number | null;
  discount_value: number | null;
  distributor_name?: string;
  items: BackupInvoiceItem[];
}

export interface BackupCollection {
  id: string;
  sale_id: string;
  amount: number;
  notes: string | null;
  is_reversed: boolean;
  reverse_reason: string | null;
  created_at: string;
  collected_by: string | null;
  customer_name?: string;
  collector_name?: string;
}

export interface BackupLogEntry {
  type: string;
  user_name: string;
  date: string;
  details: string;
}

export interface BackupPurchase {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  supplier_name: string | null;
  created_at: string;
  created_by: string | null;
  notes: string | null;
  creator_name?: string;
}

export interface BackupSalesReturn {
  id: string;
  customer_name: string;
  sale_id: string | null;
  reason: string | null;
  total_amount: number;
  created_at: string;
  created_by: string | null;
  creator_name?: string;
  items: { product_name: string; quantity: number; unit_price: number; total_price: number }[];
}

export interface BackupPurchaseReturn {
  id: string;
  supplier_name: string | null;
  reason: string | null;
  total_amount: number;
  created_at: string;
  created_by: string | null;
  creator_name?: string;
  items: { product_name: string; quantity: number; unit_price: number; total_price: number }[];
}

export interface BackupData {
  orgName: string;
  exportDate: string;
  customers: BackupCustomer[];
  invoices: BackupInvoice[];
  collections: BackupCollection[];
  purchases: BackupPurchase[];
  salesReturns: BackupSalesReturn[];
  purchaseReturns: BackupPurchaseReturn[];
  logs: BackupLogEntry[];
}

export type BackupPreviewSection =
  | 'customers'
  | 'invoices'
  | 'collections'
  | 'purchases'
  | 'salesReturns'
  | 'purchaseReturns'
  | 'logs';
