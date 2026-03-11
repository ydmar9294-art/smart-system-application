import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.png', 'placeholder.svg'],
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4 MiB
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 30 },
              networkTimeoutSeconds: 5,
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/auth\/callback/, /^\/~oauth/],
      },
      manifest: {
        name: 'Smart System',
        short_name: 'SmartSys',
        description: 'Smart System for Large Organizations',
        theme_color: '#1e40af',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/favicon.png', sizes: '192x192', type: 'image/png' },
          { src: '/favicon.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: true,
        pure_funcs: mode === 'production' ? ['console.log', 'console.warn', 'console.info'] : [],
        passes: 2,
      },
      mangle: {
        safari10: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          // ── Vendor: React core ──
          if (id.includes('node_modules/react-dom/')) return 'vendor-react';
          if (id.includes('node_modules/react/')) return 'vendor-react';
          if (id.includes('node_modules/scheduler/')) return 'vendor-react';

          // ── Vendor: Router ──
          if (id.includes('node_modules/react-router')) return 'vendor-router';

          // ── Vendor: Supabase ──
          if (id.includes('node_modules/@supabase/')) return 'vendor-supabase';

          // ── Vendor: React Query ──
          if (id.includes('node_modules/@tanstack/')) return 'vendor-query';

          // ── Vendor: Capacitor (all plugins in one chunk) ──
          if (id.includes('node_modules/@capacitor/')) return 'vendor-capacitor';
          if (id.includes('node_modules/capacitor-')) return 'vendor-capacitor';

          // ── Vendor: PDF (heavy, lazy-loaded via features) ──
          if (id.includes('node_modules/jspdf')) return 'vendor-pdf';
          if (id.includes('node_modules/html2canvas')) return 'vendor-pdf';

          // ── Vendor: Date utilities ──
          if (id.includes('node_modules/date-fns')) return 'vendor-date';

          // ── Vendor: i18n ──
          if (id.includes('node_modules/i18next') || id.includes('node_modules/react-i18next')) return 'vendor-i18n';

          // ── Vendor: Framer Motion ──
          if (id.includes('node_modules/framer-motion')) return 'vendor-motion';

          // ── Vendor: Radix UI (all primitives) ──
          if (id.includes('node_modules/@radix-ui/')) return 'vendor-radix';

          // ── Vendor: Icons ──
          if (id.includes('node_modules/lucide-react')) return 'vendor-icons';

          // ── Vendor: Form utilities ──
          if (id.includes('node_modules/zod') || id.includes('node_modules/react-hook-form') || id.includes('node_modules/@hookform/')) return 'vendor-forms';

          // ── Vendor: Sonner/Vaul/misc UI ──
          if (id.includes('node_modules/sonner') || id.includes('node_modules/vaul') || id.includes('node_modules/class-variance-authority') || id.includes('node_modules/clsx') || id.includes('node_modules/tailwind-merge')) return 'vendor-ui-utils';
        },
      },
    },
    chunkSizeWarningLimit: 700,
    sourcemap: mode === 'production' ? false : 'inline',
    // Ensure CSS is extracted to a single file for caching
    cssCodeSplit: true,
  },
  // Optimize dependency pre-bundling
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      '@tanstack/react-query',
      '@capacitor/core',
    ],
    exclude: [
      // Don't pre-bundle these — they are lazy-loaded
      'recharts',
    ],
  },
}));
