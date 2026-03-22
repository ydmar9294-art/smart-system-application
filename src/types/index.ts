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
  ACCOUNTANT = 'ACCOUNTANT',
  SALES_MANAGER = 'SALES_MANAGER',
  WAREHOUSE_KEEPER = 'WAREHOUSE_KEEPER'
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

export interface Product {
  id: string;
  organization_id?: string;
  name: string;
  category: string;
  costPrice: number;
  basePrice: number;
  consumerPrice: number;
  stock: number;
  minStock: number;
  unit: string;
  isDeleted: boolean;
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
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Payment {
  id: string;
  saleId: string;
  amount: number;
  notes?: string;
  isReversed: boolean;
  reverseReason?: string;
  timestamp: number;
  collectedBy?: string;
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
