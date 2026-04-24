/**
 * useBackButton — register a handler for Capacitor's hardware back button.
 * Multiple handlers stack like a LIFO; the most recently registered handler
 * runs first. Returning `true` from a handler signals the back press was
 * consumed; otherwise the next handler in the stack runs.
 */
import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';

type BackHandler = () => boolean | void;

const stack: BackHandler[] = [];
let listenerInstalled = false;

function installListener() {
  if (listenerInstalled) return;
  listenerInstalled = true;
  CapacitorApp.addListener('backButton', () => {
    // Iterate top-down; consume on first true
    for (let i = stack.length - 1; i >= 0; i--) {
      try {
        const consumed = stack[i]();
        if (consumed === true) return;
      } catch {
        // ignore handler errors
      }
    }
    // Nothing consumed → no-op (App.tsx has its own root handler for exit)
  });
}

export function useBackButton(handler: BackHandler, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;
    installListener();
    stack.push(handler);
    return () => {
      const idx = stack.lastIndexOf(handler);
      if (idx >= 0) stack.splice(idx, 1);
    };
  }, [handler, enabled]);
}

export default useBackButton;
