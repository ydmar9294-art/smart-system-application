/**
 * Platform Layer
 * Capacitor/native platform integrations.
 * All hooks in this module depend on Capacitor and are no-ops on web.
 */
export { useStatusBar } from './hooks/useStatusBar';
export { useHaptics } from './hooks/useHaptics';
export { useKeyboard } from './hooks/useKeyboard';
export { useBiometricAuth } from './hooks/useBiometricAuth';
export { useSwipeGesture } from './hooks/useSwipeGesture';
export { useAppShortcuts } from './hooks/useAppShortcuts';
export { useNativeShare } from './hooks/useNativeShare';
export { usePlatform } from './hooks/usePlatform';
export { useNativePerformance } from './hooks/useNativePerformance';
export { usePushNotifications } from './hooks/usePushNotifications';
