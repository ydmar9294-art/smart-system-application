import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import "./lib/i18n"; // Initialize i18n before anything else
import "./index.css";
import { AppProvider } from "@/store/AppContext";
import { GuestProvider } from "@/store/GuestContext";
import { queryClient } from "@/lib/queryClient";
import { Capacitor } from "@capacitor/core";

// Defer non-critical initialization to after first paint
const deferInit = (fn: () => void) => {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(fn, { timeout: 2000 });
  } else {
    setTimeout(fn, 100);
  }
};

// Session guard, OAuth, device name — deferred for faster TTI
deferInit(() => {
  import('@/lib/sessionGuard').then(m => m.initSessionGuard());
});
deferInit(() => {
  import('@/lib/capacitorOAuth').then(m => m.initCapacitorOAuth());
});
deferInit(() => {
  import('@/lib/deviceId').then(m => m.resolveNativeDeviceName());
});

// Hide splash screen ASAP — don't wait for full page load
if (Capacitor.isNativePlatform()) {
  // Hide immediately after mount instead of waiting for window.load
  import('@capacitor/splash-screen').then(({ SplashScreen }) => {
    SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {});
  });
}

// QueryClientProvider wraps everything to enable React Query caching
// HashRouter is used for Capacitor/WebView compatibility
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <HashRouter>
      <GuestProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </GuestProvider>
    </HashRouter>
  </QueryClientProvider>
);
