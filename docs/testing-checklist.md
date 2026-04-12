# Post-Refactor Testing Checklist

Comprehensive smoke tests after the major refactoring work (TanStack Query migration, Prisma migration, DB loan model, frontend alignment).

---

## 1. TanStack Query (Data Caching)

### Communities tab
- [ ] Open Communities tab → list loads
- [ ] Pull to refresh → refreshes without full spinner
- [ ] Switch to Browse tab → loads
- [ ] Navigate into a community, press back → **list shows instantly** (cached, no spinner)
- [ ] Wait 2+ minutes, revisit → cached data shows instantly, silent refetch in background

### Community detail
- [ ] Open any community → info / board / chat tabs render
- [ ] Go back, reopen → loads instantly from cache
- [ ] Join a community → success, lists refresh
- [ ] Leave a community → navigates back, lists reflect change

### Conversations tab
- [ ] Open tab → DM list loads
- [ ] Pull to refresh → works
- [ ] Navigate into a conversation, press back → list shows instantly

### Bookings
- [ ] Open My Bookings → list loads
- [ ] Switch tabs (All / Customer / Provider) → previously visited tabs show instantly
- [ ] Open a booking → detail loads
- [ ] Go back, reopen → instant
- [ ] Update status (if applicable) → UI reflects change immediately
- [ ] Pull to refresh → works

### Chat (all 3 types)
- [ ] Community chat — open, send message, receive from another user
- [ ] Booking chat — same
- [ ] Direct message — same
- [ ] Scroll up to load older messages → pagination works
- [ ] Navigate away and back → messages show instantly

### Auth reset
- [ ] Sign out → sign in as different user → verify no stale data from previous user

---

## 2. Prisma Migration (REST API)

All routes now run through Prisma. Symptom of breakage: 500 errors or missing/malformed data.

### Addresses
- [ ] Open account → addresses → list loads
- [ ] Create a new address → success, appears in list
- [ ] Edit an address → update persists
- [ ] Delete an address → removed from list
- [ ] Set default address → default changes

### Profile
- [ ] Open account → profile → data loads
- [ ] Edit profile (first name, bio, phone, etc.) → saves
- [ ] Upload avatar → works (still uses Supabase Storage, not migrated)

### Notifications
- [ ] Open notification center → list loads
- [ ] Open notification bell popover → shows recent notifications (no crash)
- [ ] Mark as read → updates
- [ ] Mark all as read → updates
- [ ] Delete one → removed
- [ ] Unread count updates (bell badge)

### Communities
- [ ] Create a community → success
- [ ] Update community info (as owner/admin) → saves
- [ ] Browse communities → loads
- [ ] Join a community → member added
- [ ] View members list → loads with profiles
- [ ] Leave community → removed
- [ ] Kick a member (as admin) → works
- [ ] Create invitation → works
- [ ] Accept/decline invitation → works
- [ ] Generate invite link → token returned
- [ ] Open invite link → community info shown
- [ ] Accept invite link → joined

### Offerings + Schedules
- [ ] Create an offering (product) → success — **verify `share` is no longer in category picker**
- [ ] Create an offering (service) → success
- [ ] Create an offering (event) → success
- [ ] Edit an offering → saves
- [ ] Delete an offering → removed
- [ ] Add a schedule → works
- [ ] Edit a schedule → saves
- [ ] Delete a schedule → removed

### Posts
- [ ] Create a post (as admin/owner) → appears on board
- [ ] Delete a post → removed
- [ ] Edit a post → updates

### Board feed
- [ ] Open community board → shows merged posts + offerings
- [ ] Pull to refresh → works
- [ ] Pin an offering (as admin) → appears pinned
- [ ] Unpin → removed

### Bookings
- [ ] Create a booking → success (uses the new refactored RPC)
- [ ] View booking detail → all snapshots load correctly
- [ ] Update status (accept/refuse as provider, cancel as customer) → works
- [ ] Open booking chat → conversation loads, messages work

### Conversations
- [ ] Direct message another member → conversation created
- [ ] Send message → received
- [ ] List all conversations → loads with other participants' profiles

---

## 3. DB Refactor (Loan Schema)

These won't have UI yet (deferred to Phase B), but the data model should handle them:

- [ ] Existing bookings still work — status rendering doesn't crash on any row
- [ ] New booking creation goes through the refactored RPC — if this breaks, it's a real issue
- [ ] Offerings list — verify no offering has `share` category (DB migration converted them)
- [ ] Offering detail — `transaction_type` field should be `'purchase'` on all existing rows (backend default)

---

## 4. Critical End-to-End Paths

### The "happy path" — full booking flow
- [ ] Join a community (or already be in one)
- [ ] Browse offerings on the board
- [ ] Add an offering to cart (with schedule date if required)
- [ ] Go to cart, review
- [ ] Place the booking → success
- [ ] Open the booking detail → all info correct
- [ ] Open booking chat → works
- [ ] As provider: change status to `confirmed` → customer sees update

### Real-time sockets
- [ ] Receive a notification (have someone else trigger one) → toast shows, list updates
- [ ] Receive a message from another user → chat shows new message without refresh
- [ ] Badge count updates when new notification arrives

---

## 5. Priority Order (if short on time)

If you only have time for a few tests, do these first:

1. **Create a booking end-to-end** — exercises the refactored RPC, Prisma migration, snapshots, new booking statuses
2. **Browse → open an offering** — exercises Prisma `getCommunityOfferings`, cart, category rendering
3. **Community chat** — exercises sockets + the consolidated chat hook
4. **Create and delete a community** — exercises Prisma mutations + TanStack cache invalidation
5. **Sign out / sign in as different user** — exercises auth reset + cache clearing

If any of these break, something we did needs fixing.

---

## Known Pre-existing Bugs Found During Testing

### Notification popover (FIXED)
- `response.notifications` → `response.data` (API returns `{ data, pagination, unread_count }`)
- `is_dismissed` → `is_read` (wrong field name)

Location: [components/navigation/notification-popover.tsx](../nativeCom/src/components/navigation/notification-popover.tsx)

---

## Test Data — Valid German Address

For address creation tests, use this valid address (Nominatim will geocode it):

**Berlin (boulevard):**
- Street: Unter den Linden
- Number: 1
- City: Berlin
- Postal code: 10117
- State: Berlin
- Country: Germany

**München (city center):**
- Street: Marienplatz
- Number: 1
- City: München
- Postal code: 80331
- State: Bayern
- Country: Germany
