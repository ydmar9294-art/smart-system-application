

# Plan: Fix Distributor Route & Agent Map Visibility Issues

## Root Cause Analysis

### Issue 1: Owner sees "no distributors" in AgentMapView
The `AgentMapView` component only shows agents who have **GPS location data for today** (`distributor_locations`). Since GPS tracking was just implemented and no location data has been recorded yet, the agent list appears empty. The component should **always show all field agents**, regardless of GPS data.

### Issue 2: Distributor sees no route
The `MyRouteTab` queries `route_stops` for `planned_date = today`. If no Sales Manager has created routes via RoutePlanner yet, nothing appears. This is expected behavior, BUT there's also a potential query issue — the join filter `s.routes?.distributor_id === session.user.id` happens client-side after fetching ALL org route_stops, which is inefficient and may fail if the nested join returns differently than expected.

---

## Changes

### 1. Fix `AgentMapView.tsx` — Show all field agents, not just those with GPS data

**Current**: Only shows agents found in `distributor_locations` today.
**Fix**: Always render the full list of field agents from `profiles`. GPS locations are optional overlay data.

- Show all active FIELD_AGENT profiles in the agent list sidebar
- Mark agents with recent GPS data as "active/online" (green dot)
- Mark agents without GPS data as "offline" (gray dot)
- Map markers only for agents with location data (unchanged)

### 2. Fix `MyRouteTab.tsx` — Server-side filter for distributor's routes

**Current**: Fetches all org route_stops, then filters client-side by `distributor_id`.
**Fix**: Add server-side filter using `.eq('routes.distributor_id', session.user.id)` in the Supabase query to be more reliable. Also add a fallback to check `visit_plans` table if no `route_stops` exist (since the system already has visit_plans).

### 3. Minor: Add empty state guidance

For MyRouteTab, when no route exists, show a more helpful message telling the distributor that routes are assigned by the Sales Manager.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/features/tracking/components/AgentMapView.tsx` | Show all field agents in list; GPS data as optional overlay |
| `src/features/distributor/components/MyRouteTab.tsx` | Fix query to use server-side distributor filter; improve empty state |

## Technical Details

### AgentMapView changes:
- The `agents` query already fetches all FIELD_AGENT profiles — use this as the primary data source for the agent list
- Merge with `latestLocations` to show online/offline status
- Agent without GPS → show in list with gray dot, no map marker

### MyRouteTab changes:
- Replace client-side `.filter()` with proper Supabase inner join filter
- Query: `.eq('routes.distributor_id', userId)` to push filter to server
- Better empty state text

