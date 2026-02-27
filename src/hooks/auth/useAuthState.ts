/**
 * useAuthState - Centralized auth state management
 * Holds all auth-related state and provides state transition helpers.
 */
import { useState, useCallback, useRef } from 'react';
import { UserRole, User, Organization } from '@/types';
import { logger } from '@/lib/logger';

export interface AuthState {
  user: User | null;
  role: UserRole | null;
  organization: Organization | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  needsActivation: boolean;
}

export const useAuthState = () => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [needsActivation, setNeedsActivation] = useState(false);

  // Refs shared across auth operations
  const initializingAuth = useRef(false);
  const isInternalAuthOp = useRef(false);
  const isPasswordRecoveryFlow = useRef(false);
  const inflightResolve = useRef<Promise<boolean> | null>(null);
  const lastResolvedUid = useRef<string | null>(null);
  const bootedFromCache = useRef(false);

  /** Transition to authenticated state */
  const setAuthenticatedState = useCallback(
    (result: { user: User | null; role: UserRole | null; organization: Organization | null }) => {
      setUser(result.user);
      setRole(result.role);
      setOrganization(result.organization);
      setIsAuthenticated(true);
      setNeedsActivation(false);
      setIsLoading(false);
      logger.setUser(result.user?.id);
    },
    []
  );

  /** Transition to unauthenticated — shows login screen, NEVER an error */
  const resetToLogin = useCallback(() => {
    setUser(null);
    setRole(null);
    setOrganization(null);
    setIsAuthenticated(false);
    setNeedsActivation(false);
    setIsLoading(false);
    logger.setUser(undefined);
  }, []);

  /** Mark as needs activation (no profile yet) */
  const setActivationRequired = useCallback(() => {
    setNeedsActivation(true);
    setIsAuthenticated(true);
    setIsLoading(false);
  }, []);

  return {
    // State values
    user,
    role,
    organization,
    isLoading,
    isAuthenticated,
    needsActivation,
    // State setters
    setUser,
    setRole,
    setOrganization,
    setIsLoading,
    setIsAuthenticated,
    // Transition helpers
    setAuthenticatedState,
    resetToLogin,
    setActivationRequired,
    // Refs
    initializingAuth,
    isInternalAuthOp,
    isPasswordRecoveryFlow,
    inflightResolve,
    lastResolvedUid,
    bootedFromCache,
  };
};
