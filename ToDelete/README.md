# ToDelete — Quarantine Folder

This folder contains **safely-quarantined dead code** moved out of `src/` as part of the
**Final System Rebuild** refactor (3 roles only: OWNER / ACCOUNTANT / FIELD_AGENT).

## ⚠️ Rules

1. **Nothing here is imported** by the live application. The build succeeds without it.
2. **Do NOT restore** any file from here without re-verifying with `grep` first.
3. After **24-48 hours of stable production** with no runtime errors, the entire
   `ToDelete/` folder + listed dependencies can be permanently removed.

## Contents

### `features/`
- `salesmanager/` — full SALES_MANAGER dashboard (role removed; legacy accounts → AccountantDashboard via ViewManager)
- `analytics/` — `DistributorWarehouseKPIs` (only consumer was SalesManagerDashboard)

### `components/ui/`
12 shadcn primitives with **zero imports** in `src/`:
- `carousel`, `menubar`, `navigation-menu`, `resizable`, `sidebar`, `breadcrumb`
- `aspect-ratio`, `hover-card`, `context-menu`, `input-otp`, `toggle-group`, `pagination`

### `tests/`
- `example.test.ts` — vitest demo placeholder

### `docs/`
- `android-security-plugin.md` — informational only

## Files NOT moved (still in active use — do NOT remove):

These were originally proposed for deletion but **grep confirmed they are imported by the live app**:

| File | Used by |
|------|---------|
| `src/components/ui/VirtualList.tsx` | 7 tabs (Owner/Accountant/Distributor) |
| `src/components/ui/MemoizedListItems.tsx` | Customers, Sales, Collections, Invoices |
| `src/hooks/useDataOperations.ts` | `queries.ts`, `GuestProviders`, `useTabPrefetch`, `useInventoryMutations` |
| `src/hooks/useAuthOperations.ts` | `AuthFlow`, `useProfileResolver` |
| `src/hooks/data/useCursorPagination.ts` | 5 paginated queries |
| `src/hooks/useTabPrefetch.ts` | All 3 dashboards |

## DB Backward Compatibility (guaranteed)

- `EmployeeType.SALES_MANAGER` and `WAREHOUSE_KEEPER` enums remain in DB.
- RLS policies referencing `SALES_MANAGER` (deletion approvals, route management) remain intact.
- Edge Functions remain deployed.
- `ViewManager` already routes legacy roles → `AccountantDashboard` (safe read-only fallback).
