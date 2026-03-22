

# Fix Owner Dashboard — Secondary Tabs Overflow on Mobile

## Problem
The secondary tabs row has 5 tabs (`flex-1` each) crammed into a single row. On mobile screens (especially Arabic with longer labels like "النسخ الاحتياطي" and "الاشتراك"), they overflow, text gets truncated, and buttons become too small to tap.

## Solution
Make the secondary tabs row horizontally scrollable instead of forcing all 5 into one row.

### Changes

**File: `src/features/owner/components/OwnerDashboard.tsx`** (lines 220-235)

Replace the secondary tabs container:
- Change from `flex gap-2` (forces all in one row) to a horizontal scroll container with `overflow-x-auto` and `flex-nowrap`
- Remove `flex-1` from individual buttons so they size naturally based on content
- Add `min-w-fit` / `whitespace-nowrap` to prevent text wrapping
- Add `scrollbar-hide` styling and `pb-1` for touch scrolling comfort
- Keep the same visual style (rounded pills, active highlight)

This is a single-file, targeted fix. No database or logic changes needed.

