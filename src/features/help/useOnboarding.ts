/**
 * Onboarding state — localStorage per (role + userId).
 */
import { useCallback, useEffect, useState } from 'react';
import type { HelpRole } from './helpContent';

const STORAGE_PREFIX = 'onboarding:v1';

interface OnboardingState {
  completed: boolean;
  skippedAt?: number;
  completedAt?: number;
}

const keyFor = (role: HelpRole, userId?: string | null) =>
  `${STORAGE_PREFIX}:${role}:${userId || 'anon'}`;

const read = (role: HelpRole, userId?: string | null): OnboardingState => {
  try {
    const raw = localStorage.getItem(keyFor(role, userId));
    if (!raw) return { completed: false };
    return JSON.parse(raw) as OnboardingState;
  } catch {
    return { completed: false };
  }
};

const write = (role: HelpRole, userId: string | null | undefined, state: OnboardingState) => {
  try {
    localStorage.setItem(keyFor(role, userId), JSON.stringify(state));
  } catch {
    /* quota / private mode — ignore */
  }
};

export const useOnboarding = (role: HelpRole | null, userId: string | null | undefined) => {
  const [state, setState] = useState<OnboardingState>({ completed: false });

  useEffect(() => {
    if (!role) return;
    setState(read(role, userId));
  }, [role, userId]);

  const markCompleted = useCallback(() => {
    if (!role) return;
    const next: OnboardingState = { completed: true, completedAt: Date.now() };
    write(role, userId, next);
    setState(next);
  }, [role, userId]);

  const markSkipped = useCallback(() => {
    if (!role) return;
    const next: OnboardingState = { completed: true, skippedAt: Date.now() };
    write(role, userId, next);
    setState(next);
  }, [role, userId]);

  const reset = useCallback(() => {
    if (!role) return;
    try {
      localStorage.removeItem(keyFor(role, userId));
    } catch {
      /* ignore */
    }
    setState({ completed: false });
  }, [role, userId]);

  return { state, markCompleted, markSkipped, reset };
};
