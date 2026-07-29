/**
 * Help feature root — provides:
 *  - Guided tour state (auto-start every session unless permanently dismissed).
 *  - Help Center sheet open state.
 *  - Optional tab/sub-page jump bridge (dashboards register handlers).
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/store/AuthContext';
import { UserRole, EmployeeType } from '@/types';
import type { HelpRole } from './helpContent';
import { ROLE_TOURS } from './helpContent';
import { useOnboarding } from './useOnboarding';
import GuidedTour from './components/GuidedTour';
import HelpCenterSheet from './components/HelpCenterSheet';

interface JumpHandlers {
  onJumpTab?: (tabId: string) => void;
  onJumpSub?: (subId: string) => void;
}

interface HelpContextValue {
  role: HelpRole | null;
  startTour: () => void;
  openHelpCenter: () => void;
  closeHelpCenter: () => void;
  registerJumpHandlers: (h: JumpHandlers) => void;
}

const HelpContext = createContext<HelpContextValue | null>(null);

export const useHelp = () => {
  const ctx = useContext(HelpContext);
  if (!ctx) throw new Error('useHelp must be used inside <HelpProvider>');
  return ctx;
};

const resolveRole = (
  role: UserRole | null,
  employeeType?: EmployeeType | null,
): HelpRole | null => {
  if (role === UserRole.OWNER) return 'owner';
  if (role === UserRole.EMPLOYEE) {
    if (employeeType === EmployeeType.ACCOUNTANT) return 'accountant';
    if (employeeType === EmployeeType.FIELD_AGENT) return 'distributor';
  }
  return null;
};

export const HelpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role: authRole } = useAuth();
  const helpRole = resolveRole(authRole, user?.employeeType);
  const { state, dismissForever, reset } = useOnboarding(helpRole, user?.id);

  const [tourActive, setTourActive] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [handlers, setHandlers] = useState<JumpHandlers>({});

  // Auto-start every session until user chooses "don't show again"
  useEffect(() => {
    if (!helpRole) { setTourActive(false); return; }
    if (!state.dismissed) {
      const t = setTimeout(() => setTourActive(true), 500);
      return () => clearTimeout(t);
    }
  }, [helpRole, state.dismissed]);

  const startTour = useCallback(() => {
    if (!helpRole) return;
    reset();               // clear "dismissed" so it truly restarts
    setHelpOpen(false);
    setTourActive(true);
  }, [helpRole, reset]);

  const openHelpCenter = useCallback(() => setHelpOpen(true), []);
  const closeHelpCenter = useCallback(() => setHelpOpen(false), []);

  const registerJumpHandlers = useCallback((h: JumpHandlers) => setHandlers(h), []);

  const finishTour = useCallback(() => { setTourActive(false); }, []);
  const skipTour = useCallback(() => { setTourActive(false); }, []);
  const dismissTourForever = useCallback(() => {
    setTourActive(false);
    dismissForever();
  }, [dismissForever]);

  const steps = useMemo(() => (helpRole ? ROLE_TOURS[helpRole] : []), [helpRole]);

  const value = useMemo<HelpContextValue>(() => ({
    role: helpRole, startTour, openHelpCenter, closeHelpCenter, registerJumpHandlers,
  }), [helpRole, startTour, openHelpCenter, closeHelpCenter, registerJumpHandlers]);

  return (
    <HelpContext.Provider value={value}>
      {children}
      {tourActive && helpRole && steps.length > 0 && (
        <GuidedTour
          steps={steps}
          onFinish={finishTour}
          onSkip={skipTour}
          onDismissForever={dismissTourForever}
          onJumpTab={handlers.onJumpTab}
          onJumpSub={handlers.onJumpSub}
        />
      )}
      {helpOpen && helpRole && (
        <HelpCenterSheet
          role={helpRole}
          onClose={closeHelpCenter}
          onStartTour={startTour}
        />
      )}
    </HelpContext.Provider>
  );
};
