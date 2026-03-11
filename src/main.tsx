import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import "./lib/i18n"; // Initialize i18n before anything else
import "./index.css";
import { AppProvider } from "@/store/AppContext";
import { GuestProvider } from "@/store/GuestContext";
import { queryClient } from "@/lib/queryClient";
import { initSessionGuard } from "@/lib/sessionGuard";
import { initCapacitorOAuth } from "@/lib/capacitorOAuth";
import { resolveNativeDeviceName } from "@/lib/deviceId";
import { SplashScreen } from "@capacitor/splash-screen";
import { Capacitor } from "@capacitor/core";

// Initialize proactive token refresh with jitter
initSessionGuard();

// Initialize Capacitor OAuth deep link listeners (native only)
initCapacitorOAuth();

// Resolve native device model name for device tracking (Capacitor only)
resolveNativeDeviceName();

// Hide splash screen after app loads
if (Capacitor.isNativePlatform()) {
  window.addEventListener('load', async () => {
    try {
      await SplashScreen.hide();
    } catch (error) {
      console.error('Splash screen hide error:', error);
    }
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
