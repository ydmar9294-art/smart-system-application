

# Plan: Fix GPS Tracking & Route Management Issues

## Issues Found

### 1. Critical Bug: `userId` not in scope in `processOperation` (bulk-sync)
The `processOperation` function is defined **outside** the `Deno.serve` handler, so `userId` (line 308) is not accessible. The `GPS_LOG` case will throw `ReferenceError: userId is not defined` at runtime.

**Fix**: Add `userId: string` as a 5th parameter to `processOperation`, pass it from the call site (line 165).

### 2. GPS_LOG uses `user_id: userId` but should use payload
For consistency and security, the GPS_LOG handler should use the authenticated `userId` passed as parameter (not from payload), which is already the intent but broken due to scoping.

**Fix**: Pass `userId` to `processOperation` and use it in GPS_LOG.

---

## Files to Change

### `supabase/functions/bulk-sync/index.ts`
1. **Line 165**: Change call to `processOperation(supabase, op, customerIdMap, saleIdMap, userId)`
2. **Line 212-216**: Add `userId: string` as 5th parameter to function signature
3. This fixes the GPS_LOG runtime crash

### No other files need changes
- Database tables `routes` and `route_stops` already exist with correct RLS
- `offlineQueue.ts` already has `GPS_LOG` and `ROUTE_VISIT` types
- `offlineSync.ts` already has correct priority ordering
- `useGpsTracker.ts` is correctly implemented
- `MyRouteTab.tsx`, `AgentMapView.tsx`, `RoutePlanner.tsx`, `RouteKPIs.tsx` all exist
- All three dashboards (Distributor, Owner, SalesManager) have the new tabs integrated
- Localization keys are present in both `ar.ts` and `en.ts`
- `react-leaflet@3.2.5` + `@react-leaflet/core@1.1.1` are correctly pinned for React 18

## Summary
Only 1 file needs fixing — a single parameter addition to the bulk-sync edge function to prevent GPS_LOG sync failures.

