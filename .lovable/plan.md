

# GPS Tracking & Route Management System Plan

## Current State

The database already has:
- `distributor_locations` table (lat, lng, accuracy, visit_type, user_id, organization_id, customer_id, is_synced)
- `visit_plans` table (distributor_id, customer_id, customer_name, planned_date, status, completed_at, notes, location_id)

Missing: No frontend components, no GPS hooks, no route management UI, no map views, no bulk-sync support for GPS/route types.

---

## Architecture Overview

```text
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                          │
├──────────────┬──────────────┬────────────────────────┤
│  FIELD_AGENT │  SALES_MGR   │  OWNER                │
│              │              │                        │
│ GpsTracker   │ AgentMapView │ AgentMapView           │
│ MyRouteToday │ RoutePlanner │ RouteAnalytics         │
│ VisitLogger  │ RouteKPIs    │                        │
└──────┬───────┴──────┬───────┴────────────┬───────────┘
       │              │                    │
       ▼              ▼                    ▼
   offlineQueue   React Query         React Query
   (GPS_LOG,      (polling)            (polling)
    ROUTE_VISIT)
       │
       ▼
   bulk-sync Edge Function
       │
       ▼
   Supabase DB (distributor_locations, visit_plans, routes, route_stops)
```

---

## Phase 1: Database Schema (2 new tables + RLS)

### New Tables

**`routes`** — Weekly route assignments by Sales Manager
- `id` uuid PK
- `distributor_id` uuid NOT NULL (FK profiles)
- `organization_id` uuid NOT NULL (FK organizations)
- `week_start` date NOT NULL
- `name` text (optional label)
- `created_by` uuid
- `created_at` timestamptz DEFAULT now()

**`route_stops`** — Ordered customer stops within a route
- `id` uuid PK
- `route_id` uuid NOT NULL (FK routes)
- `customer_id` uuid NOT NULL (FK customers)
- `customer_name` text NOT NULL
- `sequence_order` integer NOT NULL
- `planned_date` date NOT NULL
- `status` text DEFAULT 'pending' (pending/visited/sold/skipped)
- `notes` text
- `visited_at` timestamptz
- `location_lat` double precision
- `location_lng` double precision
- `created_at` timestamptz DEFAULT now()

### RLS Policies

**`routes`**:
- SELECT: `organization_id = get_my_org_id()`
- INSERT: `organization_id = get_my_org_id()` (OWNER/SALES_MANAGER only via role check)
- UPDATE: same as INSERT

**`route_stops`**:
- SELECT: via join to routes where `organization_id = get_my_org_id()`
- INSERT: same join check
- UPDATE: same join check (distributors can update status of their own stops)

**`distributor_locations`** (existing — verify RLS is sufficient):
- Already has INSERT for own user, SELECT for org managers. Sufficient.

---

## Phase 2: GPS Tracking Hook — `useGpsTracker`

**File**: `src/platform/hooks/useGpsTracker.ts`

**Approach**: Use `@capacitor/geolocation` for native, `navigator.geolocation` for web fallback.

**Logic**:
1. On mount (FIELD_AGENT only), start interval-based tracking (configurable 2-5 min, default 3 min)
2. Each tick: get position → store to IndexedDB via offline queue as `GPS_LOG` type
3. When online: batch sync via bulk-sync
4. Battery optimization: pause when app backgrounded >10 min, resume on foreground
5. Cleanup interval on unmount

**Key decisions**:
- Use `@capacitor/geolocation` `watchPosition` with `enableHighAccuracy: false` to save battery
- Batch GPS logs: accumulate locally, sync every sync cycle (not per-point)
- No realtime channel for GPS — polling from viewer side is sufficient

---

## Phase 3: Offline Queue Extension

**File**: `src/features/distributor/services/offlineQueue.ts`

Add two new action types:
```typescript
export type OfflineActionType =
  | 'CREATE_SALE'
  | 'ADD_COLLECTION'
  | 'CREATE_RETURN'
  | 'TRANSFER_TO_WAREHOUSE'
  | 'ADD_CUSTOMER'
  | 'GPS_LOG'        // NEW
  | 'ROUTE_VISIT';   // NEW
```

**Sync priority** (in `offlineSync.ts`):
- GPS_LOG: priority 6 (lowest — non-blocking)
- ROUTE_VISIT: priority 5

**bulk-sync Edge Function** — add handlers:
- `GPS_LOG`: batch insert into `distributor_locations`
- `ROUTE_VISIT`: update `route_stops` status + visited_at

---

## Phase 4: Distributor Mobile UI — "My Route Today"

**File**: `src/features/distributor/components/MyRouteTab.tsx`

**UI** (mobile-first, RTL):
- Header: "مسار اليوم" with date
- List of stops (cards) ordered by sequence_order
- Each card shows:
  - Customer name, location
  - Status badge (pending/visited/sold/skipped)
  - Action buttons: "تمت الزيارة والبيع" / "تمت الزيارة بدون بيع" / "تخطي"
  - Notes input (reason for skip)
- Bottom: progress bar (X/Y completed)

**Data flow**:
1. Fetch today's route_stops from Supabase (or offline cache)
2. Actions enqueued as `ROUTE_VISIT` in offline queue
3. Local state updated immediately (optimistic)

**Add new tab** to `DistributorDashboard.tsx`: `'route'` tab with MapPin icon.

---

## Phase 5: Agent Map View (Owner / Sales Manager)

**File**: `src/features/tracking/components/AgentMapView.tsx`

**UI**:
- Embedded map using Leaflet (free, no API key needed) with OpenStreetMap tiles
- Markers for each active FIELD_AGENT showing last known position
- Sidebar list of agents with:
  - Name, last seen time, today's visit count
  - Click → center map on agent
- Filters: active today, all agents

**Data**:
- React Query polling every 60s: `SELECT * FROM distributor_locations WHERE recorded_at > today ORDER BY recorded_at DESC` grouped by user_id (latest per agent)
- Click agent → fetch route history as polyline (optional, on-demand)

**Integration**:
- Add as new tab in `OwnerDashboard.tsx` and `SalesManagerDashboard.tsx`: `'tracking'` tab

---

## Phase 6: Route Planner (Sales Manager)

**File**: `src/features/tracking/components/RoutePlanner.tsx`

**UI**:
- Select distributor dropdown
- Select week (date picker)
- Show assigned customers
- Drag-and-drop list to order stops (use existing patterns, no new lib)
- Assign planned dates per stop
- Save button → insert into `routes` + `route_stops`

**Data flow**: Direct Supabase insert (online-only for manager operations).

---

## Phase 7: Route KPIs (Sales Manager Dashboard)

**File**: `src/features/tracking/components/RouteKPIs.tsx`

**Metrics** (all read-only, computed from route_stops):
- Visit completion rate: `(visited+sold) / total * 100`
- Sales conversion: `sold / (visited+sold) * 100`
- Missed customers count
- Top performers (agents ranked by completion %)

---

## Phase 8: Localization

Add to `src/locales/ar.ts` and `en.ts`:
- ~40 keys for GPS, routes, tracking, visit statuses, KPI labels

---

## Files Created/Modified

| File | Action |
|------|--------|
| Migration SQL | CREATE `routes`, `route_stops` + RLS |
| `src/platform/hooks/useGpsTracker.ts` | CREATE — GPS interval tracker |
| `src/features/tracking/components/AgentMapView.tsx` | CREATE — Map view |
| `src/features/tracking/components/RoutePlanner.tsx` | CREATE — Route builder |
| `src/features/tracking/components/RouteKPIs.tsx` | CREATE — KPI cards |
| `src/features/distributor/components/MyRouteTab.tsx` | CREATE — Today's route |
| `src/features/distributor/components/DistributorDashboard.tsx` | EDIT — add route tab |
| `src/features/owner/components/OwnerDashboard.tsx` | EDIT — add tracking tab |
| `src/features/salesmanager/components/SalesManagerDashboard.tsx` | EDIT — add tracking + route planner tabs |
| `src/features/distributor/services/offlineQueue.ts` | EDIT — add GPS_LOG, ROUTE_VISIT types |
| `src/features/distributor/services/offlineSync.ts` | EDIT — add sync priority for new types |
| `supabase/functions/bulk-sync/index.ts` | EDIT — handle GPS_LOG, ROUTE_VISIT |
| `src/locales/ar.ts` | EDIT — add tracking translations |
| `src/locales/en.ts` | EDIT — add tracking translations |
| `src/features/tracking/index.ts` | CREATE — module exports |

### Dependencies to Install
- `leaflet` + `react-leaflet` + `@types/leaflet` (free map library)
- `@capacitor/geolocation` (native GPS)

### Performance Considerations
- GPS logs batched locally, synced in bulk (not per-point)
- Map view uses polling (60s), not realtime channels
- Agent locations query uses index on `(organization_id, user_id, recorded_at DESC)`
- Route stops query scoped by route_id + planned_date

### Edge Cases Handled
- Offline for days → GPS logs queue up, sync in batches of 100
- GPS drift → accuracy field stored, UI can filter low-accuracy points
- Duplicate GPS logs → idempotencyKey per log entry
- No route assigned → "No route today" empty state
- App killed during tracking → interval restarts on next launch

