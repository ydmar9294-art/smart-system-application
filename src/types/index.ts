// ==========================================
// SMART SALES SYSTEM - TYPES
// ==========================================

export enum UserRole {
  DEVELOPER = 'DEVELOPER',
  OWNER = 'OWNER',
  EMPLOYEE = 'EMPLOYEE'
}

export enum EmployeeType {
  FIELD_AGENT = 'FIELD_AGENT',
  ACCOUNTANT = 'ACCOUNTANT'
}

export enum LicenseStatus {
  READY = 'READY',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  EXPIRED = 'EXPIRED'
}

export enum LicenseType {
  TRIAL = 'TRIAL',
  PERMANENT = 'PERMANENT',
  SUBSCRIPTION = 'SUBSCRIPTION'
}

export enum PaymentType {
  CASH = 'CASH',
  CREDIT = 'CREDIT'
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  employeeType?: EmployeeType;
  licenseKey?: string;
}

export interface Organization {
  id: string;
  name: string;
  licenseStatus?: LicenseStatus;
  expiryDate?: number;
}

export type PricingCurrency = 'SYP' | 'USD';

export type PricingUnit = 'PIECE' | 'PACK';
export type StockDisplayUnit = 'PIECE' | 'PACK' | 'BOTH';
export type SoldUnit = 'PIECE' | 'PACK' | 'MIXED';

export interface Product {
  id: string;
  organization_id?: string;
  name: string;
  category: string;
  /** @deprecated cost is no longer used by the UI; kept for DB compatibility */
  costPrice: number;
  /** Price per single PIECE (always derived/stored even if pricing_unit = PACK) */
  basePrice: number;
  consumerPrice: number;
  /** Price per full PACK (auto-synced from basePrice * unitsPerPack via DB trigger) */
  packPrice?: number;
  packConsumerPrice?: number;
  /** Number of pieces inside one pack/box */
  unitsPerPack?: number;
  /** Which unit the user enters the price in: PIECE or PACK */
  pricingUnit?: PricingUnit;
  /** How stock should be displayed: as pieces, as packs, or both */
  stockDisplayUnit?: StockDisplayUnit;
  /** Allow selling this product by full pack */
  allowPackSales?: boolean;
  /** Allow selling this product by individual piece */
  allowPieceSales?: boolean;
  stock: number;
  minStock: number;
  unit: string;
  isDeleted: boolean;
  pricingCurrency?: PricingCurrency;
}

export interface Customer {
  id: string;
  organization_id?: string;
  name: string;
  phone?: string;
  balance: number;
  created_at?: string;
  created_by?: string;
  location?: string;
}

export interface Sale {
  id: string;
  organization_id?: string;
  customer_id: string;
  customerName: string;
  grandTotal: number;
  paidAmount: number;
  remaining: number;
  paymentType: PaymentType;
  isVoided: boolean;
  voidReason?: string;
  timestamp: number;
  items: SaleItem[];
  createdBy?: string;
  discountType?: string | null;
  discountValue?: number;
  discountPercentage?: number;
}

export interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  /** Total pieces sold (= packQuantity * unitsPerPackSnapshot + pieceQuantity) */
  quantity: number;
  /** Price per single PIECE */
  unitPrice: number;
  totalPrice: number;
  /** Number of full packs sold (optional, defaults to 0) */
  packQuantity?: number;
  /** Number of loose pieces sold (optional, defaults to quantity for legacy data) */
  pieceQuantity?: number;
  /** Snapshot of unitsPerPack at sale time (for accurate display in history) */
  unitsPerPackSnapshot?: number;
  /** What unit the seller chose */
  soldUnit?: SoldUnit;
}

export type PaymentDirection = 'IN' | 'OUT';
export type PaymentCurrency = 'SYP' | 'USD';

export interface Payment {
  id: string;
  /** May be null for OUT (payment-out) entries that are not tied to an invoice. */
  saleId: string | null;
  /** Customer linked to the payment (always present for OUT, usually present for IN). */
  customerId?: string | null;
  amount: number;
  notes?: string;
  isReversed: boolean;
  reverseReason?: string;
  timestamp: number;
  collectedBy?: string;
  customerName?: string;
  /** 'IN' = receipt voucher (سند قبض), 'OUT' = payment voucher (سند دفع). Defaults to 'IN'. */
  direction?: PaymentDirection;
  /** Currency in which the user originally entered the amount. Defaults to 'SYP'. */
  currency?: PaymentCurrency;
  /** Amount as originally entered (in `currency` units). */
  originalAmount?: number;
  /** USD→SYP rate at the time of the transaction (for OUT/IN in USD). */
  exchangeRate?: number;
}

export interface License {
  id: string;
  licenseKey: string;
  orgName: string;
  type: LicenseType;
  status: LicenseStatus;
  ownerId?: string;
  issuedAt: number;
  expiryDate?: number;
  daysValid?: number;
  maxEmployees: number;
  ownerPhone?: string;
  monthlyPrice?: number;
  renewalAlertDays?: number;
  organizationId?: string;
  ownerFullName?: string;
  distributorsCount?: number;
  whatsappNumber?: string;
  isSelfServiceTrial?: boolean;
}

export interface SubscriptionPayment {
  id: string;
  organizationId: string;
  licenseId: string;
  amount: number;
  durationMonths: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedBy: string;
  submittedByRole: string;
  receiptUrl?: string;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  subscriptionStart?: string;
  subscriptionEnd?: string;
  isFirstSubscription?: boolean;
  deviceId?: string;
  createdAt: number;
}

export interface OrgStats {
  org_id: string;
  org_name: string;
  license_id: string | null;
  license_status: string | null;
  license_type: string | null;
  max_employees: number;
  expiry_date: string | null;
  employee_count: number;
  total_users: number;
  pending_employees: number;
  total_sales: number;
  total_products: number;
  total_customers: number;
  total_deliveries: number;
  total_purchases: number;
  total_revenue: number;
  total_collections: number;
  total_records: number;
}

export interface Notification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning';
}
