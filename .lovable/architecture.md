# Smart System — Architecture Guide

## Overview

This project uses a **pragmatic feature-first architecture** optimized for a multi-tenant SaaS application built with React, Vite, Tailwind CSS, and Capacitor.

## Directory Structure

```
src/
├── features/              # Business domain modules (bounded contexts)
│   ├── auth/              # Authentication & license activation
│   ├── owner/             # Organization owner dashboard
│   ├── distributor/       # Field agent / distributor operations
│   ├── accountant/        # Financial operations
│   ├── salesmanager/      # Sales team management
│   ├── warehouse/         # Warehouse keeper operations
│   ├── developer/         # System admin / developer tools
│   ├── ai/                # AI assistant
│   ├── notifications/     # User notification system
│   └── analytics/         # KPIs and performance tracking
│
├── platform/              # Native platform layer (Capacitor)
│   └── hooks/             # Platform-specific hooks (haptics, status bar, etc.)
│
├── components/            # Shared UI components
│   ├── ui/                # shadcn/ui component library
│   ├── Layout.tsx         # App shell layout
│   ├── ErrorBoundary.tsx  # Error boundary wrapper
│   └── ...
│
├── hooks/                 # Shared application hooks
├── store/                 # Global state (Auth, Data, Notification contexts)
├── lib/                   # Shared utilities and services
├── types/                 # Shared TypeScript types
├── constants/             # App-wide constants
├── integrations/          # External service clients (Supabase)
├── services/              # Background services
└── pages/                 # Route-level pages
```

## Architecture Principles

### 1. Feature-First Organization
Each feature module in `src/features/` represents a **bounded context** — a self-contained business domain. Features are organized by user role and responsibility, not by technical layer.

### 2. Module Boundaries
Every feature module:
- Has a `components/` directory for its UI components
- Exposes a single `index.ts` barrel export (public API)
- Internal components use relative imports (`./SalesTab`)
- Cross-feature imports use absolute paths (`@/features/ai/components/AIAssistant`)

### 3. Platform Layer Separation
All Capacitor/native-specific code lives in `src/platform/`. This ensures:
- Web functionality works without any native dependencies
- Platform hooks are no-ops when running on web
- Native features are discoverable in one location

### 4. Shared Infrastructure
- `src/store/` — Global state management (AuthContext, DataContext)
- `src/hooks/` — Shared, non-platform hooks (usePageTheme, useRealtimeSync, etc.)
- `src/lib/` — Pure utilities (validation, error handling, query helpers)
- `src/components/ui/` — shadcn/ui design system components

## How to Work Within This Architecture

### Adding a new feature
1. Create `src/features/{name}/components/` with your components
2. Create `src/features/{name}/index.ts` barrel export
3. Add lazy import in `src/App.tsx` if it's a dashboard

### Adding a native capability
1. Create a hook in `src/platform/hooks/`
2. Always guard with `Capacitor.isNativePlatform()`
3. Export from `src/platform/index.ts`

### Cross-feature dependencies
- Prefer importing from barrel exports: `import { X } from '@/features/auth'`
- Shared components stay in `src/components/ui/`
- Never import internal implementation details from another feature

## Scalability

This structure supports:
- **Multi-tenant isolation**: RLS at database level, org context in AuthContext
- **Team scaling**: Each feature module can be owned by a different team
- **Feature extraction**: Modules can be extracted into separate packages/services
- **Platform expansion**: iOS, Android, and web share the same feature code
