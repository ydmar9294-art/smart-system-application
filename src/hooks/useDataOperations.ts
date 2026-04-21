/**
 * Data Operations - Types and Transform utilities
 * Used by React Query hooks for data transformation
 * Cleaned up: removed unused fetchOrganizationData, fetchDeveloperData,
 * useRequestDeduplication, and useDebounce (replaced by React Query)
 */
import { UserRole, Product, Customer, Sale, Payment, License, EmployeeType } from '@/types';

// ============================================
// Types
// ============================================

export interface Purchase {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  supplier_name?: string;
  notes?: string;
  created_at: number;
}

export interface Delivery {
  id: string;
  distributor_name: string;
  status: string;
  notes?: string;
  created_at: number;
}

export interface DistributorInventoryItem {
  id: string;
  distributor_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  organization_id: string;
  updated_at: number;
}

export interface PendingEmployee {
  id: string;
  name: string;
  phone?: string;
  role: UserRole;
  employee_type: EmployeeType;
  activation_code: string;
  is_used: boolean;
  created_at: number;
  activated_at?: string | null;
  activated_by?: string | null;
}

export interface FetchedData {
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  payments: Payment[];
  purchases: Purchase[];
  deliveries: Delivery[];
  pendingEmployees: PendingEmployee[];
  users: any[];
  licenses: License[];
  distributorInventory: DistributorInventoryItem[];
}

// ============================================
// Data Transformation Utilities
// ============================================

export const transformProduct = (p: any): Product => ({
  id: p.id,
  organization_id: p.organization_id,
  name: p.name,
  category: p.category,
  costPrice: Number(p.cost_price ?? 0),
  basePrice: Number(p.base_price),
  consumerPrice: Number(p.consumer_price ?? 0),
  stock: p.stock,
  minStock: p.min_stock,
  unit: p.unit,
  isDeleted: p.is_deleted,
  pricingCurrency: (p.pricing_currency === 'USD' ? 'USD' : 'SYP'),
});

export const transformCustomer = (c: any): Customer => ({
  id: c.id,
  organization_id: c.organization_id,
  name: c.name,
  phone: c.phone,
  balance: Number(c.balance),
  created_at: c.created_at,
  created_by: c.created_by,
  location: c.location
});

export const transformSale = (s: any): Sale => ({
  id: s.id,
  organization_id: s.organization_id,
  customer_id: s.customer_id,
  customerName: s.customer_name,
  grandTotal: Number(s.grand_total),
  paidAmount: Number(s.paid_amount),
  remaining: Number(s.remaining),
  paymentType: s.payment_type,
  isVoided: s.is_voided,
  voidReason: s.void_reason,
  timestamp: new Date(s.created_at).getTime(),
  items: [],
  createdBy: s.created_by || undefined,
  discountType: s.discount_type || null,
  discountValue: Number(s.discount_value || 0),
  discountPercentage: Number(s.discount_percentage || 0),
});

export const transformPayment = (p: any): Payment => ({
  id: p.id,
  saleId: p.sale_id ?? null,
  customerId: p.customer_id ?? p.sales?.customer_id ?? null,
  amount: Number(p.amount),
  notes: p.notes,
  isReversed: p.is_reversed,
  reverseReason: p.reverse_reason,
  timestamp: new Date(p.created_at).getTime(),
  collectedBy: p.collected_by || undefined,
  customerName: p.customers?.name || p.sales?.customer_name || p.customer_name || undefined,
  direction: (p.direction === 'OUT' ? 'OUT' : 'IN'),
  currency: (p.currency === 'USD' ? 'USD' : 'SYP'),
  originalAmount: p.original_amount != null ? Number(p.original_amount) : Number(p.amount),
  exchangeRate: p.exchange_rate != null ? Number(p.exchange_rate) : 1,
});

export const transformPurchase = (p: any): Purchase => ({
  id: p.id,
  product_id: p.product_id,
  product_name: p.product_name,
  quantity: p.quantity,
  unit_price: Number(p.unit_price),
  total_price: Number(p.total_price),
  supplier_name: p.supplier_name,
  notes: p.notes,
  created_at: new Date(p.created_at).getTime()
});

export const transformDelivery = (d: any): Delivery => ({
  id: d.id,
  distributor_name: d.distributor_name,
  status: d.status,
  notes: d.notes,
  created_at: new Date(d.created_at).getTime()
});

export const transformDistributorInventory = (d: any): DistributorInventoryItem => ({
  id: d.id,
  distributor_id: d.distributor_id,
  product_id: d.product_id,
  product_name: d.product_name,
  quantity: d.quantity,
  organization_id: d.organization_id,
  updated_at: new Date(d.updated_at).getTime()
});

export const transformPendingEmployee = (e: any): PendingEmployee => ({
  id: e.id,
  name: e.name,
  phone: e.phone,
  role: e.role as UserRole,
  employee_type: e.employee_type as EmployeeType,
  activation_code: e.activation_code,
  is_used: e.is_used,
  created_at: new Date(e.created_at).getTime(),
  activated_at: e.activated_at || null,
  activated_by: e.activated_by || null,
});

export const transformLicense = (l: any): License => ({
  id: l.id,
  licenseKey: l.licenseKey,
  orgName: l.orgName,
  type: l.type,
  status: l.status,
  ownerId: l.ownerId,
  issuedAt: new Date(l.issuedAt).getTime(),
  expiryDate: l.expiryDate ? new Date(l.expiryDate).getTime() : undefined,
  daysValid: l.days_valid,
  maxEmployees: l.max_employees ?? 10,
  ownerPhone: l.owner_phone,
  monthlyPrice: l.monthly_price ?? 0,
  renewalAlertDays: l.renewal_alert_days ?? 3,
  organizationId: l.organization_id,
  ownerFullName: l.owner_full_name ?? undefined,
  distributorsCount: l.distributors_count ?? undefined,
  whatsappNumber: l.whatsapp_number ?? undefined,
  isSelfServiceTrial: l.is_self_service_trial ?? false,
});

export const transformUser = (u: any) => ({
  id: u.id,
  name: u.full_name,
  email: '',
  phone: u.phone || '',
  role: u.role,
  employeeType: u.employee_type,
  licenseKey: u.license_key,
  isActive: u.is_active ?? true
});
