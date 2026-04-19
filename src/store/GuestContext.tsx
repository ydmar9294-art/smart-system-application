/**
 * GuestContext — manages guest preview mode state
 */
import React, { createContext, useContext, useState, useCallback } from 'react';
import { UserRole, EmployeeType } from '@/types';

export interface GuestRole {
  role: UserRole;
  employeeType?: EmployeeType;
  label: string;
  key: string;
}

interface GuestContextType {
  isGuest: boolean;
  guestRole: GuestRole | null;
  enterGuestMode: (role: GuestRole) => void;
  exitGuestMode: () => void;
}

const GuestContext = createContext<GuestContextType | null>(null);

// SALES_MANAGER role removed from guest preview (role no longer offered to new accounts)
export const GUEST_ROLES: GuestRole[] = [
  { role: UserRole.OWNER, label: 'المالك', key: 'owner' },
  { role: UserRole.EMPLOYEE, employeeType: EmployeeType.ACCOUNTANT, label: 'المحاسب', key: 'accountant' },
  { role: UserRole.EMPLOYEE, employeeType: EmployeeType.WAREHOUSE_KEEPER, label: 'أمين المستودع', key: 'warehouseKeeper' },
  { role: UserRole.EMPLOYEE, employeeType: EmployeeType.FIELD_AGENT, label: 'الموزع الميداني', key: 'fieldAgent' },
];

export const GuestProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [guestRole, setGuestRole] = useState<GuestRole | null>(null);
  const enterGuestMode = useCallback((role: GuestRole) => setGuestRole(role), []);
  const exitGuestMode = useCallback(() => setGuestRole(null), []);

  return (
    <GuestContext.Provider value={{ isGuest: !!guestRole, guestRole, enterGuestMode, exitGuestMode }}>
      {children}
    </GuestContext.Provider>
  );
};

export const useGuest = () => {
  const ctx = useContext(GuestContext);
  if (!ctx) throw new Error('useGuest must be used within GuestProvider');
  return ctx;
};
