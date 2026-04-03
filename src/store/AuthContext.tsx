/**
 * AuthContext - Thin composition layer (v3.1)
 * 
 * All logic is delegated to dedicated hooks:
 *   useAuthState       → state management & transitions
 *   useProfileResolver → profile resolution & deduplication
 *   useSession         → initialization, cache boot, event handling
 *   useAuthActions     → logout & refresh
 * 
 * This file only wires them together and provides the context.
 */
import React, { createContext, useContext, useMemo } from 'react';
import { UserRole, User, Organization } from '@/types';
import { useAuthState } from '@/hooks/auth/useAuthState';
import { useProfileResolver } from '@/hooks/auth/useProfileResolver';
import { useSession } from '@/hooks/auth/useSession';
import { useAuthActions } from '@/hooks/auth/useAuthActions';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  organization: Organization | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  needsActivation: boolean;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. State management
  const state = useAuthState();

  // 2. Profile resolution (depends on state transitions)
  const { resolveProfile } = useProfileResolver({
    setAuthenticatedState: state.setAuthenticatedState,
    resetToLogin: state.resetToLogin,
    setActivationRequired: state.setActivationRequired,
    inflightResolve: state.inflightResolve,
    lastResolvedUid: state.lastResolvedUid,
    bootedFromCache: state.bootedFromCache,
  });

  // 3. Session initialization & auth events (depends on state + resolver)
  useSession({
    setUser: state.setUser,
    setRole: state.setRole,
    setOrganization: state.setOrganization,
    setIsAuthenticated: state.setIsAuthenticated,
    setIsLoading: state.setIsLoading,
    resetToLogin: state.resetToLogin,
    setAuthenticatedState: state.setAuthenticatedState,
    resolveProfile,
    initializingAuth: state.initializingAuth,
    isInternalAuthOp: state.isInternalAuthOp,
    isPasswordRecoveryFlow: state.isPasswordRecoveryFlow,
    lastResolvedUid: state.lastResolvedUid,
    bootedFromCache: state.bootedFromCache,
  });

  // 4. Actions (depends on state + resolver)
  const { logout, refreshAuth } = useAuthActions({
    resetToLogin: state.resetToLogin,
    setAuthenticatedState: state.setAuthenticatedState,
    setIsLoading: state.setIsLoading,
    resolveProfile,
    isInternalAuthOp: state.isInternalAuthOp,
    bootedFromCache: state.bootedFromCache,
    lastResolvedUid: state.lastResolvedUid,
    inflightResolve: state.inflightResolve,
  });

  // Memoize context value to prevent re-renders when nothing changed
  const value = useMemo(() => ({
    user: state.user,
    role: state.role,
    organization: state.organization,
    isLoading: state.isLoading,
    isAuthenticated: state.isAuthenticated,
    needsActivation: state.needsActivation,
    logout,
    refreshAuth,
  }), [
    state.user, state.role, state.organization,
    state.isLoading, state.isAuthenticated, state.needsActivation,
    logout, refreshAuth,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
