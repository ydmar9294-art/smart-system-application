/**
 * GuestContext - Manages guest preview mode
 * Provides readonly state, selected role, and 2-minute promo overlay timer
 */
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { UserRole, EmployeeType } from '@/types';

export interface GuestRole {
  role: UserRole;
  employeeType?: EmployeeType;
  label: string;
}

export const GUEST_ROLES: GuestRole[] = [
  { role: UserRole.OWNER, label: 'owner' },
  { role: UserRole.EMPLOYEE, employeeType: EmployeeType.SALES_MANAGER, label: 'salesManager' },
  { role: UserRole.EMPLOYEE, employeeType: EmployeeType.ACCOUNTANT, label: 'accountant' },
  { role: UserRole.EMPLOYEE, employeeType: EmployeeType.WAREHOUSE_KEEPER, label: 'warehouseKeeper' },
  { role: UserRole.EMPLOYEE, employeeType: EmployeeType.FIELD_AGENT, label: 'distributor' },
];

interface GuestContextValue {
  isGuest: boolean;
  guestRole: GuestRole | null;
  showPromo: boolean;
  enterGuest: (role: GuestRole) => void;
  exitGuest: () => void;
  dismissPromo: () => void;
}

const GuestContext = createContext<GuestContextValue>({
  isGuest: false,
  guestRole: null,
  showPromo: false,
  enterGuest: () => {},
  exitGuest: () => {},
  dismissPromo: () => {},
});

const PROMO_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

export const GuestProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [guestRole, setGuestRole] = useState<GuestRole | null>(null);
  const [showPromo, setShowPromo] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setShowPromo(true), PROMO_INTERVAL_MS);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setShowPromo(false);
  }, []);

  const enterGuest = useCallback((role: GuestRole) => {
    setGuestRole(role);
    setShowPromo(false);
    startTimer();
  }, [startTimer]);

  const exitGuest = useCallback(() => {
    setGuestRole(null);
    stopTimer();
  }, [stopTimer]);

  const dismissPromo = useCallback(() => {
    setShowPromo(false);
  }, []);

  useEffect(() => () => stopTimer(), [stopTimer]);

  return (
    <GuestContext.Provider value={{
      isGuest: !!guestRole,
      guestRole,
      showPromo,
      enterGuest,
      exitGuest,
      dismissPromo,
    }}>
      {children}
    </GuestContext.Provider>
  );
};

export const useGuest = () => useContext(GuestContext);
