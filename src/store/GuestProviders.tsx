/**
 * GuestProviders — Provides mock Auth, Data, and Notification contexts
 * for guest preview mode so dashboards render with demo data.
 * 
 * Wraps the dashboard component with the same context shape as AppContext
 * but uses static demo data instead of Supabase queries.
 */
import React, { createContext, useContext, useCallback, useMemo, useState } from 'react';
import { UserRole, User, Organization, Product, Customer, Sale, Payment, License, LicenseStatus, EmployeeType, Notification, OrgStats } from '@/types';
import { Purchase, Delivery, PendingEmployee, DistributorInventoryItem } from '@/hooks/useDataOperations';
import { PurchaseReturn } from '@/hooks/queries';
import { GuestRole, useGuest } from '@/store/GuestContext';
import {
  DEMO_ORG, DEMO_USERS, DEMO_PRODUCTS, DEMO_CUSTOMERS, DEMO_SALES,
  DEMO_PAYMENTS, DEMO_PURCHASES, DEMO_DELIVERIES, DEMO_PENDING_EMPLOYEES,
  DEMO_DISTRIBUTOR_INVENTORY, DEMO_PURCHASE_RETURNS, DEMO_TEAM_USERS,
} from '@/data/guestDemoData';

// ============================================
// Re-use the same context types from the real providers
// We import the actual contexts to override them
// ============================================

// We need to access the raw contexts to provide overrides
// Import them from their source modules
const AuthContext = React.createContext<any>(null);
const DataContext = React.createContext<any>(null);
const NotificationContext = React.createContext<any>(null);

// We'll override useAuth, useData, useNotifications by providing
// the contexts that these hooks read from.
// Since those hooks use their own createContext, we need to
// re-export providers from the actual context files.

// Actually, the cleanest approach: override the AppContext's useApp hook
// by providing the three sub-contexts that AppContext reads from.

// Let me re-think: The dashboards call useApp() which calls useAuth() + useData() + useNotifications()
// These each read from their own React contexts. To override, we need to provide
// the SAME context objects.

// The simplest backward-compatible approach: wrap the dashboard in a component
// that provides mock data through the REAL context providers' context objects.

// Since we can't easily access the private context objects, let's use a different approach:
// Create a "GuestAppContext" that mimics useApp() return value and provide it through
// a new mechanism.

// ============================================
// Guest Override Context
// ============================================

interface GuestOverride {
  isGuestPreview: true;
  user: User;
  role: UserRole;
  organization: Organization;
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  payments: Payment[];
  purchases: Purchase[];
  deliveries: Delivery[];
  pendingEmployees: PendingEmployee[];
  distributorInventory: DistributorInventoryItem[];
  purchaseReturns: PurchaseReturn[];
  users: any[];
  licenses: License[];
  orgStats: OrgStats[];
  notifications: Notification[];
}

const GuestOverrideContext = createContext<GuestOverride | null>(null);

/**
 * Hook to check if we're in guest mode and get override data
 */
export function useGuestOverride(): GuestOverride | null {
  return useContext(GuestOverrideContext);
}

/**
 * Provider that wraps dashboards in guest mode
 */
export const GuestDataProviders: React.FC<{ guestRole: GuestRole; children: React.ReactNode }> = ({ guestRole, children }) => {
  const demoUser = DEMO_USERS[guestRole.key] || DEMO_USERS.owner;

  const value = useMemo<GuestOverride>(() => ({
    isGuestPreview: true,
    user: demoUser,
    role: guestRole.role,
    organization: DEMO_ORG,
    products: DEMO_PRODUCTS,
    customers: DEMO_CUSTOMERS,
    sales: DEMO_SALES,
    payments: DEMO_PAYMENTS,
    purchases: DEMO_PURCHASES,
    deliveries: DEMO_DELIVERIES,
    pendingEmployees: DEMO_PENDING_EMPLOYEES,
    distributorInventory: DEMO_DISTRIBUTOR_INVENTORY,
    purchaseReturns: DEMO_PURCHASE_RETURNS,
    users: DEMO_TEAM_USERS,
    licenses: [],
    orgStats: [],
    notifications: [],
  }), [demoUser, guestRole]);

  return (
    <GuestOverrideContext.Provider value={value}>
      {children}
    </GuestOverrideContext.Provider>
  );
};
