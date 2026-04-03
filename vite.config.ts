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
        maximumFileSizeToCacheInBytes: 1.5 * 1024 * 1024, // 1.5 MiB — reduced for faster install on low-end devices
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Cache Supabase API responses (GET only)
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 30 },
              networkTimeoutSeconds: 5,
            },
          },
          {
            // Cache Google Fonts
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
        navigateFallbackDenylist: [/^\/auth\/callback/],
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
    // Production optimizations
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        // Strip console.log/warn in production (keep errors)
        drop_console: mode === 'production',
        drop_debugger: true,
        pure_funcs: mode === 'production' ? ['console.log', 'console.warn', 'console.info'] : [],
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-ui': ['lucide-react'],
          'vendor-charts': ['recharts'],
          'vendor-capacitor': [
            '@capacitor/core',
            '@capacitor/app',
            '@capacitor/browser',
            '@capacitor/device',
            '@capacitor/clipboard',
            '@capacitor/preferences',
            '@capacitor/filesystem',
            '@capacitor/share',
            '@capacitor/haptics',
            '@capacitor/keyboard',
            '@capacitor/status-bar',
            '@capacitor/splash-screen',
          ],
          'vendor-capacitor-push': [
            '@capacitor/push-notifications',
            '@capacitor/local-notifications',
          ],
          // PDF libs lazy-loaded via dynamic import — NOT in vendor chunk
          'vendor-i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          'vendor-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-tabs',
            '@radix-ui/react-select',
            '@radix-ui/react-popover',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-accordion',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-switch',
            '@radix-ui/react-label',
          ],
          'vendor-motion': ['framer-motion'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
    sourcemap: mode === 'production' ? false : 'inline',
  },
}));
