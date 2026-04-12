# Board Redesign + Availability Filtering Plan

## Current State

The board is a single chronological feed mixing posts and offerings. Issues:
1. Offerings with no schedule or fully booked schedules still appear as bookable
2. Old but available offerings get buried under newer posts
3. No way to filter or browse offerings by category

---

## Board Redesign: Split Layout

The board tab gets a new layout with two distinct sections in one scrollable view:

```
┌─────────────────────────────────────┐
│  POST FEED (vertical)                │
│  ┌─────────────────────────────────┐│
│  │ Post card                       ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │ Post card                       ││
│  └─────────────────────────────────┘│
│                                      │
│─── Products ────────────────────── │
│  ┌────────┐ ┌────────┐ ┌────────┐  │
│  │Product │ │Product │ │Product │ → │
│  └────────┘ └────────┘ └────────┘  │
│                                      │
│─── Services ────────────────────── │
│  ┌────────┐ ┌────────┐ ┌────────┐  │
│  │Service │ │Service │ │Service │ → │
│  └────────┘ └────────┘ └────────┘  │
│                                      │
│─── Loans ───────────────────────── │
│  ┌────────┐ ┌────────┐             │
│  │ Loan   │ │ Loan   │ →           │
│  └────────┘ └────────┘             │
│                                      │
│─── Events ──────────────────────── │
│  ┌────────┐                         │
│  │ Event  │ →                       │
│  └────────┘                         │
└─────────────────────────────────────┘
```

### Design Decisions
- Posts on top (vertical scroll) — community updates, discussions, what people check first
- Offerings below, **grouped by category** — each category gets its own horizontal scrollable row
- Empty categories are hidden (only show rows that have offerings)
- Each row has a category header label ("Products", "Services", "Loans", "Events")
- Unavailable offerings show a "Sold out" badge with disabled "Add to Cart"
- Pinned items appear first in their respective category row

---

## Offering Card Design (compact, for horizontal row)

Card width ~140px:
- Small image or category icon
- Title (1 line, truncated)
- Price (or "Free" / "Borrow" / "Donation")
- Availability indicator (green dot = available, grey = sold out)
- Tap → navigate to offering detail

---

## Availability Filtering (API level)

### Modify `GET /api/communities/[communityId]/offerings`
- Join `availability_schedules` and `schedule_instances`
- Add a computed `is_available` flag per offering:
  - No schedules → available (always-on items like products)
  - Has schedules → check if any future instance has `slots_booked < slots_available`
  - All schedules inactive or fully booked → not available
- Add query params:
  - `?available=true` — filter only available offerings (default for member view)
  - `?category=product` — filter by category
  - `?status=all` — include paused/deleted (admin view only)

### Board Feed API Changes
- Current `GET /api/communities/[communityId]/board` returns mixed posts + offerings
- Change: either split into two endpoints or restructure the response:
  - Option A: Board endpoint returns posts only, offerings fetched separately per category
  - Option B: Board endpoint returns `{ posts: [...], offerings: { products: [...], services: [...], ... } }`
- Option A is simpler and works better with TanStack Query (separate cache entries)

---

## Admin Offerings Management

### Problem
Community owners/admins cannot manage offerings posted by other members. They can only pin/unpin.

### New Screen: `/community/[communityId]/manage-offerings`
- Accessible to owners and admins only (from Info tab)

### Admin Capabilities

| Action | Description |
|--------|-------------|
| View all offerings | List all offerings (active, paused, deleted) |
| Pause offering | Temporarily hide from board (`status: 'paused'`) |
| Unpause offering | Restore a paused offering (`status: 'active'`) |
| Remove offering | Soft-delete (`deleted_at`) |
| View offering detail | Navigate to offering detail |
| Filter/search | Filter by status, category, provider name |

### Admin UI
- Tab-based filtering: All / Active / Paused / Deleted
- Each card shows: title, provider name, category, status, price, created date
- Swipe or long-press actions: Pause / Unpause / Remove
- Confirmation dialogs for destructive actions

### API Changes
- `PATCH /api/offerings/[offeringId]` — add admin authorization (owner/admin of the community can update `status`)
- `DELETE /api/offerings/[offeringId]` — add admin authorization for soft-delete
- `GET /api/communities/[communityId]/offerings` — add `?status=all` param for admin view

### RLS / Authorization
- If requester is owner/admin of the offering's community → allow status changes and deletion
- Keep existing provider self-management unchanged

---

## Files Summary

### Files to Create
- `nativeCom/src/app/community/[communityId]/manage-offerings.tsx` — admin management screen
- `nativeCom/src/hooks/queries/use-admin-offerings.ts` — query hook for all offerings (including paused)

### Files to Modify
- `nativeCom/src/components/pages/community/board-tab.tsx` — redesign layout (posts vertical + category rows horizontal)
- `nativeCom/src/components/pages/community/info-tab.tsx` — add "Manage Offerings" button for admins
- `nativeCom/src/app/community/[communityId]/offerings/[offeringId]/index.tsx` — show availability status
- `nativeCom/src/types/offering.ts` — add `is_available` flag
- `nativeCom/src/hooks/queries/use-offerings.ts` — add category/availability filter params
- `nextserver/src/app/api/communities/[communityId]/offerings/route.ts` — availability join/filter, category param, status param
- `nextserver/src/app/api/communities/[communityId]/board/route.ts` — posts-only or restructured response
- `nextserver/src/app/api/offerings/[offeringId]/route.ts` — admin authorization for PATCH/DELETE

---

## Open Questions

1. Should offerings with no schedule be shown as "always available" or should schedules be required?
2. Should admins be able to edit offering content (title, price, description) or only manage status (pause/remove)?
3. The DB has a `food` category not exposed in the app — should it be added or removed from the schema?
4. Should the board show a maximum number of items per category row, or load all and let horizontal scroll handle it?
