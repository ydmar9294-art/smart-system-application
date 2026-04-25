/**
 * Offline Cache Service
 * 
 * Manages cached data for inventory, customers, sales, invoices, and org info.
 * All data is encrypted at rest using AES-256-GCM.
 */

import { encryptData, decryptData, isEncrypted } from '@/lib/indexedDbEncryption';
import { logger } from '@/lib/logger';
import {
  STORES,
  openDB,
  withWriteLock,
  putEncryptedItem,
  getAllEncryptedItems,
  getEncryptedItem,
  getItem,
  putItem,
  atomicReplaceStore,
  prepareEncryptedRecord,
} from './offlineDb';
import { getSaleIdMap } from './offlineIdMap';

// ============================================
// Inventory Cache
// ============================================

export interface CachedInventoryItem {
  product_id: string;
  product_name: string;
  /** Total quantity in PIECES (always pieces internally) */
  quantity: number;
  /** Price per single PIECE (already converted to SYP if pricing was in USD) */
  base_price: number;
  consumer_price: number;
  unit: string;
  /** Pieces inside one pack/box (default 1) */
  units_per_pack?: number;
  /** Price per full PACK (already converted to SYP) */
  pack_price?: number;
  pack_consumer_price?: number;
  /** Allow selling by full pack */
  allow_pack_sales?: boolean;
  /** Allow selling by individual piece */
  allow_piece_sales?: boolean;
  /** How to display stock: PIECE | PACK | BOTH */
  stock_display_unit?: 'PIECE' | 'PACK' | 'BOTH';
  updated_at: number;
}

export async function cacheInventory(items: CachedInventoryItem[]): Promise<void> {
  return withWriteLock(STORES.INVENTORY_CACHE, async () => {
    const records: Array<{ key: string; value: any }> = [];
    for (const item of items) {
      const record = await prepareEncryptedRecord(
        { ...item, updated_at: Date.now() },
        'product_id'
      );
      records.push({ key: item.product_id, value: record });
    }
    await atomicReplaceStore(STORES.INVENTORY_CACHE, records);
  });
}

export async function getCachedInventory(): Promise<CachedInventoryItem[]> {
  return getAllEncryptedItems<CachedInventoryItem>(STORES.INVENTORY_CACHE);
}

export async function updateCachedInventoryQuantity(
  productId: string,
  quantityDelta: number
): Promise<void> {
  const existing = await getEncryptedItem<CachedInventoryItem>(STORES.INVENTORY_CACHE, productId);
  if (existing) {
    existing.quantity = Math.max(0, existing.quantity + quantityDelta);
    existing.updated_at = Date.now();
    await putEncryptedItem(STORES.INVENTORY_CACHE, existing, 'product_id');
  }
}

// ============================================
// Customer Cache
// ============================================

export interface CachedCustomer {
  id: string;
  name: string;
  phone: string | null;
  location: string | null;
  balance: number;
  organization_id: string;
  created_by: string | null;
  isLocal?: boolean;
  syncStatus?: 'pending' | 'synced' | 'failed';
  updated_at: number;
}

export async function cacheCustomers(customers: CachedCustomer[]): Promise<void> {
  return withWriteLock(STORES.CUSTOMERS_CACHE, async () => {
    const existing = await getAllEncryptedItems<CachedCustomer>(STORES.CUSTOMERS_CACHE);
    const localCustomers = existing.filter(c => c.isLocal && c.syncStatus !== 'synced');

    const serverIds = new Set(customers.map(c => c.id));
    const records: Array<{ key: string; value: any }> = [];

    for (const c of customers) {
      const record = await prepareEncryptedRecord({ ...c, updated_at: Date.now() });
      records.push({ key: c.id, value: record });
    }

    for (const c of localCustomers) {
      if (!serverIds.has(c.id)) {
        const record = await prepareEncryptedRecord(c);
        records.push({ key: c.id, value: record });
      }
    }

    await atomicReplaceStore(STORES.CUSTOMERS_CACHE, records);
  });
}

export async function getCachedCustomers(): Promise<CachedCustomer[]> {
  return getAllEncryptedItems<CachedCustomer>(STORES.CUSTOMERS_CACHE);
}

export async function addLocalCustomer(customer: CachedCustomer): Promise<void> {
  await putEncryptedItem(STORES.CUSTOMERS_CACHE, customer);
}

export async function updateCachedCustomerBalance(customerId: string, balanceDelta: number): Promise<void> {
  const existing = await getEncryptedItem<CachedCustomer>(STORES.CUSTOMERS_CACHE, customerId);
  if (existing) {
    existing.balance = Math.max(0, existing.balance - balanceDelta);
    existing.updated_at = Date.now();
    await putEncryptedItem(STORES.CUSTOMERS_CACHE, existing);
  }
}

export async function updateCustomerSyncStatus(
  localId: string,
  status: 'synced' | 'failed',
  serverId?: string
): Promise<void> {
  const raw = await getItem<any>(STORES.CUSTOMERS_CACHE, localId);
  if (!raw) return;

  let c: CachedCustomer;
  try {
    if (raw._enc && isEncrypted(raw._enc)) {
      c = await decryptData<CachedCustomer>(raw._enc);
    } else {
      c = raw;
    }
  } catch {
    logger.warn(`[CustomerSync] Failed to decrypt customer ${localId}`, 'DistributorOffline');
    return;
  }

  c.syncStatus = status;
  let deleteKey: string | null = null;
  let writeRecord: Record<string, any>;

  if (status === 'synced' && serverId) {
    deleteKey = localId;
    c.id = serverId;
    c.isLocal = false;
    const encrypted = await encryptData(c);
    if (encrypted && (encrypted as any).__encrypted) {
      writeRecord = { id: serverId, _enc: encrypted };
    } else {
      writeRecord = { ...c, id: serverId };
    }
  } else {
    const encrypted = await encryptData(c);
    if (encrypted && (encrypted as any).__encrypted) {
      writeRecord = { id: c.id, _enc: encrypted };
    } else {
      writeRecord = { ...c };
    }
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CUSTOMERS_CACHE, 'readwrite');
    const store = tx.objectStore(STORES.CUSTOMERS_CACHE);
    if (deleteKey) {
      store.delete(deleteKey);
    }
    store.put(writeRecord);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================
// Sales Cache
// ============================================

export interface CachedSaleItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface CachedSale {
  id: string;
  customer_id: string;
  customerName: string;
  grandTotal: number;
  paidAmount: number;
  remaining: number;
  paymentType: string;
  isVoided: boolean;
  timestamp: number;
  items?: CachedSaleItem[];
  isLocal?: boolean;
}

export async function cacheSales(sales: CachedSale[]): Promise<void> {
  return withWriteLock(STORES.SALES_CACHE, async () => {
    const existing = await getAllEncryptedItems<CachedSale>(STORES.SALES_CACHE);
    const localSales = existing.filter(s => s.isLocal);
    const saleMap = getSaleIdMap();

    const records: Array<{ key: string; value: any }> = [];

    for (const s of sales) {
      const record = await prepareEncryptedRecord(s);
      records.push({ key: s.id, value: record });
    }

    const serverIds = new Set(sales.map(s => s.id));
    for (const s of localSales) {
      const mappedId = saleMap.get(s.id);
      if (mappedId && serverIds.has(mappedId)) continue;
      if (!serverIds.has(s.id)) {
        const record = await prepareEncryptedRecord(s);
        records.push({ key: s.id, value: record });
      }
    }

    await atomicReplaceStore(STORES.SALES_CACHE, records);
  });
}

export async function getCachedSales(): Promise<CachedSale[]> {
  return getAllEncryptedItems<CachedSale>(STORES.SALES_CACHE);
}

export async function addLocalSale(sale: CachedSale): Promise<void> {
  await putEncryptedItem(STORES.SALES_CACHE, sale);
}

export async function updateCachedSale(saleId: string, updates: Partial<CachedSale>): Promise<void> {
  const existing = await getEncryptedItem<CachedSale>(STORES.SALES_CACHE, saleId);
  if (existing) {
    await putEncryptedItem(STORES.SALES_CACHE, { ...existing, ...updates });
  }
}

// ============================================
// Invoices Cache
// ============================================

export interface CachedInvoice {
  id: string;
  invoice_type: 'sale' | 'return' | 'collection';
  invoice_number: string;
  reference_id: string;
  customer_id: string | null;
  customer_name: string;
  created_by: string | null;
  created_by_name: string | null;
  grand_total: number;
  paid_amount: number;
  remaining: number;
  payment_type: 'CASH' | 'CREDIT' | null;
  items: Array<{
    product_id?: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    consumer_price?: number;
    unit?: string;
  }>;
  notes: string | null;
  reason: string | null;
  org_name: string | null;
  legal_info: any | null;
  invoice_date: string;
  created_at: string;
  isLocal?: boolean;
  discount_type?: 'percentage' | 'fixed' | null;
  discount_percentage?: number;
  discount_value?: number;
  subtotal?: number;
}

export async function cacheInvoices(invoices: CachedInvoice[]): Promise<void> {
  return withWriteLock(STORES.INVOICES_CACHE, async () => {
    const existing = await getAllEncryptedItems<CachedInvoice>(STORES.INVOICES_CACHE);
    const localInvoices = existing.filter(inv => inv.isLocal);
    const saleMap = getSaleIdMap();

    const records: Array<{ key: string; value: any }> = [];

    for (const inv of invoices) {
      const record = await prepareEncryptedRecord(inv);
      records.push({ key: inv.id, value: record });
    }

    const serverIds = new Set(invoices.map(inv => inv.id));
    const serverRefIds = new Set(invoices.map(inv => inv.reference_id).filter(Boolean));

    for (const inv of localInvoices) {
      const mappedId = saleMap.get(inv.id);
      if (mappedId && serverIds.has(mappedId)) continue;

      const mappedRefId = inv.reference_id ? saleMap.get(inv.reference_id) : null;
      if (mappedRefId && serverRefIds.has(mappedRefId)) continue;

      if (inv.reference_id && inv.invoice_type !== 'sale') {
        const resolvedRefId = mappedRefId || inv.reference_id;
        const serverHasEquivalent = invoices.some(
          si => si.invoice_type === inv.invoice_type && si.reference_id === resolvedRefId
        );
        if (serverHasEquivalent) continue;
      }

      if (!serverIds.has(inv.id)) {
        const record = await prepareEncryptedRecord(inv);
        records.push({ key: inv.id, value: record });
      }
    }

    await atomicReplaceStore(STORES.INVOICES_CACHE, records);
  });
}

export async function getCachedInvoices(): Promise<CachedInvoice[]> {
  return getAllEncryptedItems<CachedInvoice>(STORES.INVOICES_CACHE);
}

export async function addLocalInvoice(invoice: CachedInvoice): Promise<void> {
  await putEncryptedItem(STORES.INVOICES_CACHE, invoice);
}

// ============================================
// Organization Info Cache
// ============================================

export interface CachedOrgInfo {
  key: string;
  orgName?: string;
  legalInfo?: {
    commercial_registration: string | null;
    industrial_registration: string | null;
    tax_identification: string | null;
    trademark_name: string | null;
    stamp_url?: string | null;
  } | null;
  organizationId?: string;
  distributorId?: string;
  updatedAt: number;
}

async function imageUrlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) return url;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

export async function cacheOrgInfo(
  orgName: string,
  legalInfo: {
    commercial_registration: string | null;
    industrial_registration: string | null;
    tax_identification: string | null;
    trademark_name: string | null;
    stamp_url?: string | null;
  } | null,
  organizationId?: string,
  distributorId?: string,
): Promise<void> {
  let processedLegalInfo = legalInfo;
  if (legalInfo?.stamp_url && !legalInfo.stamp_url.startsWith('data:')) {
    try {
      const base64Stamp = await imageUrlToBase64(legalInfo.stamp_url);
      processedLegalInfo = { ...legalInfo, stamp_url: base64Stamp };
    } catch {
      // Keep original URL as fallback
    }
  }

  await putEncryptedItem(STORES.ORG_INFO_CACHE, {
    key: 'org_info',
    orgName,
    legalInfo: processedLegalInfo,
    organizationId,
    distributorId,
    updatedAt: Date.now(),
  }, 'key');
}

export async function getCachedOrgInfo(): Promise<CachedOrgInfo | null> {
  return getEncryptedItem<CachedOrgInfo>(STORES.ORG_INFO_CACHE, 'org_info');
}

export async function cacheOfflineOrgContext(organizationId: string, distributorId: string): Promise<void> {
  await putEncryptedItem(STORES.ORG_INFO_CACHE, {
    key: 'org_context',
    organizationId,
    distributorId,
    updatedAt: Date.now(),
  } as CachedOrgInfo, 'key');
}

export async function getOfflineOrgContext(): Promise<{ organizationId: string; distributorId: string } | null> {
  const ctx = await getEncryptedItem<CachedOrgInfo>(STORES.ORG_INFO_CACHE, 'org_context');
  if (!ctx?.organizationId || !ctx?.distributorId) return null;
  return {
    organizationId: ctx.organizationId,
    distributorId: ctx.distributorId,
  };
}
