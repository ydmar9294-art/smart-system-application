/**
 * Onboarding state — localStorage per (role + userId).
 * Semantics: auto-start every session unless permanently dismissed.
 */
import { useCallback, useEffect, useState } from 'react';
import type { HelpRole } from './helpContent';

const STORAGE_PREFIX = 'onboarding:v2';

interface OnboardingState {
  dismissed: boolean;
  dismissedAt?: number;
}

const keyFor = (role: HelpRole, userId?: string | null) =>
  `${STORAGE_PREFIX}:${role}:${userId || 'anon'}`;

const read = (role: HelpRole, userId?: string | null): OnboardingState => {
  try {
    const raw = localStorage.getItem(keyFor(role, userId));
    if (!raw) return { dismissed: false };
    return JSON.parse(raw) as OnboardingState;
  } catch {
    return { dismissed: false };
  }
};

const write = (role: HelpRole, userId: string | null | undefined, state: OnboardingState) => {
  try { localStorage.setItem(keyFor(role, userId), JSON.stringify(state)); } catch { /* ignore */ }
};

export const useOnboarding = (role: HelpRole | null, userId: string | null | undefined) => {
  const [state, setState] = useState<OnboardingState>({ dismissed: false });

  useEffect(() => {
    if (!role) return;
    setState(read(role, userId));
  }, [role, userId]);

  const dismissForever = useCallback(() => {
    if (!role) return;
    const next: OnboardingState = { dismissed: true, dismissedAt: Date.now() };
    write(role, userId, next);
    setState(next);
  }, [role, userId]);

  const reset = useCallback(() => {
    if (!role) return;
    try { localStorage.removeItem(keyFor(role, userId)); } catch { /* ignore */ }
    setState({ dismissed: false });
  }, [role, userId]);

  return { state, dismissForever, reset };
};
