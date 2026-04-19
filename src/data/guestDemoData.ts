/**
 * Guest Demo Data — comprehensive sample data for guest preview mode
 * Provides realistic data so potential users can see full dashboard details
 */

import { Product, Customer, Sale, Payment, PaymentType, UserRole, EmployeeType, User, Organization, LicenseStatus } from '@/types';
import { Purchase, Delivery, PendingEmployee, DistributorInventoryItem } from '@/hooks/useDataOperations';
import { PurchaseReturn } from '@/hooks/queries';

// ============================================
// Helper
// ============================================
const daysAgo = (d: number) => Date.now() - d * 86400000;
const id = (n: number) => `demo-${n.toString().padStart(4, '0')}`;

// ============================================
// Organization
// ============================================
export const DEMO_ORG: Organization = {
  id: 'demo-org-001',
  name: 'شركة النور للتوزيع',
  licenseStatus: LicenseStatus.ACTIVE,
  expiryDate: Date.now() + 90 * 86400000,
};

// ============================================
// Users (for different roles)
// ============================================
export const DEMO_USERS: Record<string, User> = {
  owner: {
    id: 'demo-user-owner',
    name: 'أحمد محمد النور',
    email: 'ahmed@alnour.com',
    phone: '0912345678',
    role: UserRole.OWNER,
  },
  accountant: {
    id: 'demo-user-acc',
    name: 'فاطمة حسن',
    email: 'fatima@alnour.com',
    phone: '0934567890',
    role: UserRole.EMPLOYEE,
    employeeType: EmployeeType.ACCOUNTANT,
  },
  warehouseKeeper: {
    id: 'demo-user-wh',
    name: 'عمر سعيد',
    email: 'omar@alnour.com',
    phone: '0945678901',
    role: UserRole.EMPLOYEE,
    employeeType: EmployeeType.WAREHOUSE_KEEPER,
  },
  fieldAgent: {
    id: 'demo-user-fa',
    name: 'محمد ياسر',
    email: 'mohamed@alnour.com',
    phone: '0956789012',
    role: UserRole.EMPLOYEE,
    employeeType: EmployeeType.FIELD_AGENT,
  },
  fieldAgent: {
    id: 'demo-user-fa',
    name: 'محمد ياسر',
    email: 'yasr@alnour.com',
    phone: '0956789012',
    role: UserRole.EMPLOYEE,
    employeeType: EmployeeType.FIELD_AGENT,
  },
};

// ============================================
// Products (15 items)
// ============================================
export const DEMO_PRODUCTS: Product[] = [
  { id: id(1), name: 'حليب طازج 1 لتر', category: 'ألبان', costPrice: 800, basePrice: 1200, consumerPrice: 1500, stock: 250, minStock: 50, unit: 'كرتونة', isDeleted: false, organization_id: DEMO_ORG.id },
  { id: id(2), name: 'جبنة بيضاء 500غ', category: 'ألبان', costPrice: 1500, basePrice: 2200, consumerPrice: 2800, stock: 180, minStock: 30, unit: 'قطعة', isDeleted: false, organization_id: DEMO_ORG.id },
  { id: id(3), name: 'زيت زيتون 1 لتر', category: 'زيوت', costPrice: 5000, basePrice: 7500, consumerPrice: 9000, stock: 120, minStock: 20, unit: 'عبوة', isDeleted: false, organization_id: DEMO_ORG.id },
  { id: id(4), name: 'أرز بسمتي 5 كغ', category: 'حبوب', costPrice: 3000, basePrice: 4500, consumerPrice: 5500, stock: 300, minStock: 40, unit: 'كيس', isDeleted: false, organization_id: DEMO_ORG.id },
  { id: id(5), name: 'سكر أبيض 1 كغ', category: 'حبوب', costPrice: 600, basePrice: 900, consumerPrice: 1100, stock: 500, minStock: 100, unit: 'كيس', isDeleted: false, organization_id: DEMO_ORG.id },
  { id: id(6), name: 'شاي أخضر 200غ', category: 'مشروبات', costPrice: 400, basePrice: 700, consumerPrice: 900, stock: 350, minStock: 60, unit: 'علبة', isDeleted: false, organization_id: DEMO_ORG.id },
  { id: id(7), name: 'قهوة تركية 250غ', category: 'مشروبات', costPrice: 1200, basePrice: 1800, consumerPrice: 2200, stock: 200, minStock: 30, unit: 'كيس', isDeleted: false, organization_id: DEMO_ORG.id },
  { id: id(8), name: 'معكرونة 500غ', category: 'معلبات', costPrice: 300, basePrice: 500, consumerPrice: 700, stock: 400, minStock: 80, unit: 'كيس', isDeleted: false, organization_id: DEMO_ORG.id },
  { id: id(9), name: 'صلصة طماطم 400غ', category: 'معلبات', costPrice: 250, basePrice: 450, consumerPrice: 600, stock: 280, minStock: 50, unit: 'علبة', isDeleted: false, organization_id: DEMO_ORG.id },
  { id: id(10), name: 'تونا معلبة 185غ', category: 'معلبات', costPrice: 900, basePrice: 1400, consumerPrice: 1700, stock: 150, minStock: 25, unit: 'علبة', isDeleted: false, organization_id: DEMO_ORG.id },
  { id: id(11), name: 'صابون غسيل 3 كغ', category: 'تنظيف', costPrice: 2000, basePrice: 3000, consumerPrice: 3800, stock: 100, minStock: 15, unit: 'عبوة', isDeleted: false, organization_id: DEMO_ORG.id },
  { id: id(12), name: 'مناديل ورقية', category: 'تنظيف', costPrice: 200, basePrice: 350, consumerPrice: 450, stock: 600, minStock: 100, unit: 'حزمة', isDeleted: false, organization_id: DEMO_ORG.id },
  { id: id(13), name: 'عصير برتقال 1 لتر', category: 'مشروبات', costPrice: 700, basePrice: 1100, consumerPrice: 1400, stock: 220, minStock: 40, unit: 'عبوة', isDeleted: false, organization_id: DEMO_ORG.id },
  { id: id(14), name: 'بسكويت شوكولاتة', category: 'حلويات', costPrice: 350, basePrice: 550, consumerPrice: 700, stock: 8, minStock: 30, unit: 'علبة', isDeleted: false, organization_id: DEMO_ORG.id },
  { id: id(15), name: 'مياه معدنية 6×1.5ل', category: 'مشروبات', costPrice: 500, basePrice: 800, consumerPrice: 1000, stock: 180, minStock: 40, unit: 'شرنكة', isDeleted: false, organization_id: DEMO_ORG.id },
];

// ============================================
// Customers (12 customers)
// ============================================
export const DEMO_CUSTOMERS: Customer[] = [
  { id: id(101), name: 'سوبر ماركت الأمل', phone: '0911111111', balance: 450000, created_at: new Date(daysAgo(90)).toISOString(), location: 'شارع الجلاء', organization_id: DEMO_ORG.id },
  { id: id(102), name: 'ميني ماركت النجمة', phone: '0922222222', balance: 120000, created_at: new Date(daysAgo(80)).toISOString(), location: 'شارع بغداد', organization_id: DEMO_ORG.id },
  { id: id(103), name: 'بقالة أبو خالد', phone: '0933333333', balance: 85000, created_at: new Date(daysAgo(60)).toISOString(), location: 'حي الميدان', organization_id: DEMO_ORG.id },
  { id: id(104), name: 'تموينات الشام', phone: '0944444444', balance: 0, created_at: new Date(daysAgo(45)).toISOString(), location: 'المزة', organization_id: DEMO_ORG.id },
  { id: id(105), name: 'سوبر ماركت الوفاء', phone: '0955555555', balance: 320000, created_at: new Date(daysAgo(30)).toISOString(), location: 'جرمانا', organization_id: DEMO_ORG.id },
  { id: id(106), name: 'بقالة الحي', phone: '0966666666', balance: 15000, created_at: new Date(daysAgo(25)).toISOString(), location: 'الدويلعة', organization_id: DEMO_ORG.id },
  { id: id(107), name: 'ماركت الربيع', phone: '0977777777', balance: 200000, created_at: new Date(daysAgo(20)).toISOString(), location: 'المالكي', organization_id: DEMO_ORG.id },
  { id: id(108), name: 'تموينات البركة', phone: '0988888888', balance: 55000, created_at: new Date(daysAgo(15)).toISOString(), location: 'كفرسوسة', organization_id: DEMO_ORG.id },
  { id: id(109), name: 'سوبر ماركت الفرات', phone: '0999999999', balance: 180000, created_at: new Date(daysAgo(10)).toISOString(), location: 'القابون', organization_id: DEMO_ORG.id },
  { id: id(110), name: 'بقالة الزهراء', phone: '0911234567', balance: 0, created_at: new Date(daysAgo(5)).toISOString(), location: 'الشعلان', organization_id: DEMO_ORG.id },
  { id: id(111), name: 'ماركت أبو عمر', phone: '0922345678', balance: 95000, created_at: new Date(daysAgo(3)).toISOString(), location: 'ركن الدين', organization_id: DEMO_ORG.id },
  { id: id(112), name: 'هايبر ماركت المدينة', phone: '0933456789', balance: 750000, created_at: new Date(daysAgo(1)).toISOString(), location: 'صحنايا', organization_id: DEMO_ORG.id },
];

// ============================================
// Sales (20 sales)
// ============================================
export const DEMO_SALES: Sale[] = [
  { id: id(201), customer_id: id(101), customerName: 'سوبر ماركت الأمل', grandTotal: 125000, paidAmount: 100000, remaining: 25000, paymentType: PaymentType.CREDIT, isVoided: false, timestamp: daysAgo(0), items: [], createdBy: 'demo-user-fa', organization_id: DEMO_ORG.id },
  { id: id(202), customer_id: id(102), customerName: 'ميني ماركت النجمة', grandTotal: 45000, paidAmount: 45000, remaining: 0, paymentType: PaymentType.CASH, isVoided: false, timestamp: daysAgo(0), items: [], createdBy: 'demo-user-fa', organization_id: DEMO_ORG.id },
  { id: id(203), customer_id: id(103), customerName: 'بقالة أبو خالد', grandTotal: 78000, paidAmount: 50000, remaining: 28000, paymentType: PaymentType.CREDIT, isVoided: false, timestamp: daysAgo(1), items: [], createdBy: 'demo-user-fa', organization_id: DEMO_ORG.id },
  { id: id(204), customer_id: id(104), customerName: 'تموينات الشام', grandTotal: 32000, paidAmount: 32000, remaining: 0, paymentType: PaymentType.CASH, isVoided: false, timestamp: daysAgo(1), items: [], createdBy: 'demo-user-fa', organization_id: DEMO_ORG.id },
  { id: id(205), customer_id: id(105), customerName: 'سوبر ماركت الوفاء', grandTotal: 250000, paidAmount: 200000, remaining: 50000, paymentType: PaymentType.CREDIT, isVoided: false, timestamp: daysAgo(2), items: [], createdBy: 'demo-user-fa', organization_id: DEMO_ORG.id },
  { id: id(206), customer_id: id(106), customerName: 'بقالة الحي', grandTotal: 18000, paidAmount: 18000, remaining: 0, paymentType: PaymentType.CASH, isVoided: false, timestamp: daysAgo(2), items: [], createdBy: 'demo-user-fa', organization_id: DEMO_ORG.id },
  { id: id(207), customer_id: id(107), customerName: 'ماركت الربيع', grandTotal: 95000, paidAmount: 60000, remaining: 35000, paymentType: PaymentType.CREDIT, isVoided: false, timestamp: daysAgo(3), items: [], createdBy: 'demo-user-fa', organization_id: DEMO_ORG.id },
  { id: id(208), customer_id: id(108), customerName: 'تموينات البركة', grandTotal: 42000, paidAmount: 42000, remaining: 0, paymentType: PaymentType.CASH, isVoided: false, timestamp: daysAgo(3), items: [], createdBy: 'demo-user-fa', organization_id: DEMO_ORG.id },
  { id: id(209), customer_id: id(109), customerName: 'سوبر ماركت الفرات', grandTotal: 180000, paidAmount: 100000, remaining: 80000, paymentType: PaymentType.CREDIT, isVoided: false, timestamp: daysAgo(4), items: [], createdBy: 'demo-user-fa', organization_id: DEMO_ORG.id },
  { id: id(210), customer_id: id(112), customerName: 'هايبر ماركت المدينة', grandTotal: 350000, paidAmount: 200000, remaining: 150000, paymentType: PaymentType.CREDIT, isVoided: false, timestamp: daysAgo(4), items: [], createdBy: 'demo-user-fa', organization_id: DEMO_ORG.id },
  { id: id(211), customer_id: id(101), customerName: 'سوبر ماركت الأمل', grandTotal: 67000, paidAmount: 67000, remaining: 0, paymentType: PaymentType.CASH, isVoided: false, timestamp: daysAgo(5), items: [], createdBy: 'demo-user-fa', organization_id: DEMO_ORG.id },
  { id: id(212), customer_id: id(111), customerName: 'ماركت أبو عمر', grandTotal: 55000, paidAmount: 30000, remaining: 25000, paymentType: PaymentType.CREDIT, isVoided: false, timestamp: daysAgo(5), items: [], createdBy: 'demo-user-fa', organization_id: DEMO_ORG.id },
  { id: id(213), customer_id: id(102), customerName: 'ميني ماركت النجمة', grandTotal: 89000, paidAmount: 89000, remaining: 0, paymentType: PaymentType.CASH, isVoided: false, timestamp: daysAgo(6), items: [], createdBy: 'demo-user-fa', organization_id: DEMO_ORG.id },
  { id: id(214), customer_id: id(105), customerName: 'سوبر ماركت الوفاء', grandTotal: 145000, paidAmount: 100000, remaining: 45000, paymentType: PaymentType.CREDIT, isVoided: false, timestamp: daysAgo(7), items: [], createdBy: 'demo-user-fa', organization_id: DEMO_ORG.id },
  { id: id(215), customer_id: id(103), customerName: 'بقالة أبو خالد', grandTotal: 38000, paidAmount: 38000, remaining: 0, paymentType: PaymentType.CASH, isVoided: true, voidReason: 'إرجاع كامل', timestamp: daysAgo(8), items: [], createdBy: 'demo-user-fa', organization_id: DEMO_ORG.id },
  { id: id(216), customer_id: id(107), customerName: 'ماركت الربيع', grandTotal: 72000, paidAmount: 72000, remaining: 0, paymentType: PaymentType.CASH, isVoided: false, timestamp: daysAgo(9), items: [], createdBy: 'demo-user-fa', organization_id: DEMO_ORG.id },
  { id: id(217), customer_id: id(112), customerName: 'هايبر ماركت المدينة', grandTotal: 420000, paidAmount: 300000, remaining: 120000, paymentType: PaymentType.CREDIT, isVoided: false, timestamp: daysAgo(10), items: [], createdBy: 'demo-user-fa', organization_id: DEMO_ORG.id },
  { id: id(218), customer_id: id(104), customerName: 'تموينات الشام', grandTotal: 56000, paidAmount: 56000, remaining: 0, paymentType: PaymentType.CASH, isVoided: false, timestamp: daysAgo(12), items: [], createdBy: 'demo-user-fa', organization_id: DEMO_ORG.id },
  { id: id(219), customer_id: id(109), customerName: 'سوبر ماركت الفرات', grandTotal: 165000, paidAmount: 80000, remaining: 85000, paymentType: PaymentType.CREDIT, isVoided: false, timestamp: daysAgo(14), items: [], createdBy: 'demo-user-fa', organization_id: DEMO_ORG.id },
  { id: id(220), customer_id: id(110), customerName: 'بقالة الزهراء', grandTotal: 28000, paidAmount: 28000, remaining: 0, paymentType: PaymentType.CASH, isVoided: false, timestamp: daysAgo(15), items: [], createdBy: 'demo-user-fa', organization_id: DEMO_ORG.id },
];

// ============================================
// Payments / Collections (15 entries)
// ============================================
export const DEMO_PAYMENTS: Payment[] = [
  { id: id(301), saleId: id(201), amount: 100000, notes: 'دفعة أولى', isReversed: false, timestamp: daysAgo(0), collectedBy: 'demo-user-fa', customerName: 'سوبر ماركت الأمل' },
  { id: id(302), saleId: id(202), amount: 45000, isReversed: false, timestamp: daysAgo(0), collectedBy: 'demo-user-fa', customerName: 'ميني ماركت النجمة' },
  { id: id(303), saleId: id(203), amount: 50000, isReversed: false, timestamp: daysAgo(1), collectedBy: 'demo-user-fa', customerName: 'بقالة أبو خالد' },
  { id: id(304), saleId: id(205), amount: 200000, notes: 'تحصيل جزئي', isReversed: false, timestamp: daysAgo(2), collectedBy: 'demo-user-fa', customerName: 'سوبر ماركت الوفاء' },
  { id: id(305), saleId: id(207), amount: 60000, isReversed: false, timestamp: daysAgo(3), collectedBy: 'demo-user-fa', customerName: 'ماركت الربيع' },
  { id: id(306), saleId: id(209), amount: 100000, isReversed: false, timestamp: daysAgo(4), collectedBy: 'demo-user-fa', customerName: 'سوبر ماركت الفرات' },
  { id: id(307), saleId: id(210), amount: 200000, isReversed: false, timestamp: daysAgo(4), collectedBy: 'demo-user-fa', customerName: 'هايبر ماركت المدينة' },
  { id: id(308), saleId: id(214), amount: 100000, isReversed: false, timestamp: daysAgo(7), collectedBy: 'demo-user-fa', customerName: 'سوبر ماركت الوفاء' },
  { id: id(309), saleId: id(217), amount: 300000, notes: 'دفعة كبيرة', isReversed: false, timestamp: daysAgo(10), collectedBy: 'demo-user-fa', customerName: 'هايبر ماركت المدينة' },
  { id: id(310), saleId: id(219), amount: 80000, isReversed: false, timestamp: daysAgo(14), collectedBy: 'demo-user-fa', customerName: 'سوبر ماركت الفرات' },
  { id: id(311), saleId: id(205), amount: 50000, notes: 'دفعة ثانية', isReversed: true, reverseReason: 'خطأ في المبلغ', timestamp: daysAgo(3), collectedBy: 'demo-user-fa', customerName: 'سوبر ماركت الوفاء' },
  { id: id(312), saleId: id(212), amount: 30000, isReversed: false, timestamp: daysAgo(5), collectedBy: 'demo-user-fa', customerName: 'ماركت أبو عمر' },
  { id: id(313), saleId: id(211), amount: 67000, isReversed: false, timestamp: daysAgo(5), collectedBy: 'demo-user-fa', customerName: 'سوبر ماركت الأمل' },
  { id: id(314), saleId: id(204), amount: 32000, isReversed: false, timestamp: daysAgo(1), collectedBy: 'demo-user-fa', customerName: 'تموينات الشام' },
  { id: id(315), saleId: id(206), amount: 18000, isReversed: false, timestamp: daysAgo(2), collectedBy: 'demo-user-fa', customerName: 'بقالة الحي' },
];

// ============================================
// Purchases (10 entries)
// ============================================
export const DEMO_PURCHASES: Purchase[] = [
  { id: id(401), product_id: id(1), product_name: 'حليب طازج 1 لتر', quantity: 100, unit_price: 800, total_price: 80000, supplier_name: 'مصنع الألبان', created_at: daysAgo(1) },
  { id: id(402), product_id: id(3), product_name: 'زيت زيتون 1 لتر', quantity: 50, unit_price: 5000, total_price: 250000, supplier_name: 'شركة الزيوت', created_at: daysAgo(2) },
  { id: id(403), product_id: id(4), product_name: 'أرز بسمتي 5 كغ', quantity: 200, unit_price: 3000, total_price: 600000, supplier_name: 'وكالة الحبوب', created_at: daysAgo(3) },
  { id: id(404), product_id: id(5), product_name: 'سكر أبيض 1 كغ', quantity: 300, unit_price: 600, total_price: 180000, supplier_name: 'معمل السكر', created_at: daysAgo(5) },
  { id: id(405), product_id: id(7), product_name: 'قهوة تركية 250غ', quantity: 80, unit_price: 1200, total_price: 96000, supplier_name: 'شركة البن', created_at: daysAgo(7) },
  { id: id(406), product_id: id(8), product_name: 'معكرونة 500غ', quantity: 150, unit_price: 300, total_price: 45000, supplier_name: 'مصنع المعكرونة', created_at: daysAgo(8) },
  { id: id(407), product_id: id(10), product_name: 'تونا معلبة 185غ', quantity: 100, unit_price: 900, total_price: 90000, supplier_name: 'وكالة الأغذية', created_at: daysAgo(10) },
  { id: id(408), product_id: id(11), product_name: 'صابون غسيل 3 كغ', quantity: 60, unit_price: 2000, total_price: 120000, supplier_name: 'مصنع المنظفات', created_at: daysAgo(12) },
  { id: id(409), product_id: id(13), product_name: 'عصير برتقال 1 لتر', quantity: 120, unit_price: 700, total_price: 84000, supplier_name: 'مصنع العصائر', created_at: daysAgo(14) },
  { id: id(410), product_id: id(15), product_name: 'مياه معدنية 6×1.5ل', quantity: 200, unit_price: 500, total_price: 100000, supplier_name: 'شركة المياه', created_at: daysAgo(15) },
];

// ============================================
// Deliveries (6 entries)
// ============================================
export const DEMO_DELIVERIES: Delivery[] = [
  { id: id(501), distributor_name: 'محمد ياسر', status: 'delivered', notes: 'تسليم صباحي', created_at: daysAgo(0) },
  { id: id(502), distributor_name: 'محمد ياسر', status: 'pending', notes: 'بانتظار التحميل', created_at: daysAgo(1) },
  { id: id(503), distributor_name: 'أحمد علي', status: 'delivered', created_at: daysAgo(2) },
  { id: id(504), distributor_name: 'أحمد علي', status: 'delivered', created_at: daysAgo(4) },
  { id: id(505), distributor_name: 'محمد ياسر', status: 'delivered', notes: 'تسليم مسائي', created_at: daysAgo(5) },
  { id: id(506), distributor_name: 'سامر حسن', status: 'pending', created_at: daysAgo(0) },
];

// ============================================
// Pending Employees (4 entries)
// ============================================
export const DEMO_PENDING_EMPLOYEES: PendingEmployee[] = [
  { id: id(601), name: 'سامر حسن', phone: '0912345000', role: UserRole.EMPLOYEE, employee_type: EmployeeType.FIELD_AGENT, activation_code: 'DEMO-1234', is_used: false, created_at: daysAgo(2) },
  { id: id(602), name: 'ليلى أحمد', phone: '0923456000', role: UserRole.EMPLOYEE, employee_type: EmployeeType.ACCOUNTANT, activation_code: 'DEMO-5678', is_used: true, created_at: daysAgo(10), activated_at: new Date(daysAgo(9)).toISOString(), activated_by: 'demo-user-owner' },
  { id: id(603), name: 'علي كمال', phone: '0934567000', role: UserRole.EMPLOYEE, employee_type: EmployeeType.WAREHOUSE_KEEPER, activation_code: 'DEMO-9012', is_used: false, created_at: daysAgo(1) },
  { id: id(604), name: 'نور الدين', phone: '0945678000', role: UserRole.EMPLOYEE, employee_type: EmployeeType.FIELD_AGENT, activation_code: 'DEMO-3456', is_used: true, created_at: daysAgo(20), activated_at: new Date(daysAgo(18)).toISOString(), activated_by: 'demo-user-sm' },
];

// ============================================
// Distributor Inventory (8 items for field agent)
// ============================================
export const DEMO_DISTRIBUTOR_INVENTORY: DistributorInventoryItem[] = [
  { id: id(701), distributor_id: 'demo-user-fa', product_id: id(1), product_name: 'حليب طازج 1 لتر', quantity: 30, organization_id: DEMO_ORG.id, updated_at: daysAgo(0) },
  { id: id(702), distributor_id: 'demo-user-fa', product_id: id(2), product_name: 'جبنة بيضاء 500غ', quantity: 20, organization_id: DEMO_ORG.id, updated_at: daysAgo(0) },
  { id: id(703), distributor_id: 'demo-user-fa', product_id: id(5), product_name: 'سكر أبيض 1 كغ', quantity: 50, organization_id: DEMO_ORG.id, updated_at: daysAgo(0) },
  { id: id(704), distributor_id: 'demo-user-fa', product_id: id(6), product_name: 'شاي أخضر 200غ', quantity: 40, organization_id: DEMO_ORG.id, updated_at: daysAgo(0) },
  { id: id(705), distributor_id: 'demo-user-fa', product_id: id(8), product_name: 'معكرونة 500غ', quantity: 35, organization_id: DEMO_ORG.id, updated_at: daysAgo(1) },
  { id: id(706), distributor_id: 'demo-user-fa', product_id: id(9), product_name: 'صلصة طماطم 400غ', quantity: 25, organization_id: DEMO_ORG.id, updated_at: daysAgo(1) },
  { id: id(707), distributor_id: 'demo-user-fa', product_id: id(12), product_name: 'مناديل ورقية', quantity: 60, organization_id: DEMO_ORG.id, updated_at: daysAgo(2) },
  { id: id(708), distributor_id: 'demo-user-fa', product_id: id(15), product_name: 'مياه معدنية 6×1.5ل', quantity: 15, organization_id: DEMO_ORG.id, updated_at: daysAgo(0) },
];

// ============================================
// Purchase Returns (3 entries)
// ============================================
export const DEMO_PURCHASE_RETURNS: PurchaseReturn[] = [
  { id: id(801), supplier_name: 'مصنع الألبان', total_amount: 16000, reason: 'منتجات منتهية الصلاحية', created_at: new Date(daysAgo(3)).toISOString(), created_by: 'demo-user-wh', organization_id: DEMO_ORG.id },
  { id: id(802), supplier_name: 'وكالة الأغذية', total_amount: 27000, reason: 'عبوات تالفة', created_at: new Date(daysAgo(8)).toISOString(), created_by: 'demo-user-wh', organization_id: DEMO_ORG.id },
  { id: id(803), supplier_name: 'مصنع المعكرونة', total_amount: 9000, reason: 'خطأ في الطلبية', created_at: new Date(daysAgo(12)).toISOString(), created_by: 'demo-user-wh', organization_id: DEMO_ORG.id },
];

// ============================================
// Team Users (for owner/sales manager view)
// ============================================
export const DEMO_TEAM_USERS = [
  { id: 'demo-user-sm', full_name: 'خالد عبدالله', phone: '0923456789', role: 'EMPLOYEE', employee_type: 'SALES_MANAGER', is_active: true, organization_id: DEMO_ORG.id },
  { id: 'demo-user-acc', full_name: 'فاطمة حسن', phone: '0934567890', role: 'EMPLOYEE', employee_type: 'ACCOUNTANT', is_active: true, organization_id: DEMO_ORG.id },
  { id: 'demo-user-wh', full_name: 'عمر سعيد', phone: '0945678901', role: 'EMPLOYEE', employee_type: 'WAREHOUSE_KEEPER', is_active: true, organization_id: DEMO_ORG.id },
  { id: 'demo-user-fa', full_name: 'محمد ياسر', phone: '0956789012', role: 'EMPLOYEE', employee_type: 'FIELD_AGENT', is_active: true, organization_id: DEMO_ORG.id },
  { id: 'demo-user-fa2', full_name: 'أحمد علي', phone: '0967890123', role: 'EMPLOYEE', employee_type: 'FIELD_AGENT', is_active: true, organization_id: DEMO_ORG.id },
  { id: 'demo-user-fa3', full_name: 'سامر حسن', phone: '0978901234', role: 'EMPLOYEE', employee_type: 'FIELD_AGENT', is_active: false, organization_id: DEMO_ORG.id },
];
