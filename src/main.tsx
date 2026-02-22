import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import "./index.css";
import { AppProvider } from "@/store/AppContext";
import { queryClient } from "@/lib/queryClient";
import { initSessionGuard } from "@/lib/sessionGuard";

// Phase 4: Initialize proactive token refresh with jitter
initSessionGuard();

// QueryClientProvider wraps everything to enable React Query caching
// HashRouter is used for Capacitor/WebView compatibility
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <HashRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </HashRouter>
  </QueryClientProvider>
);
