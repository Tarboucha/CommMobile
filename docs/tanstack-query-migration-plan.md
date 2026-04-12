# TanStack Query Integration Plan

## Context

The nativeCom app currently uses manual `useState` + `useCallback` + `useFocusEffect` patterns for all data fetching across screens. This results in:
- No caching — every screen visit shows a loading spinner
- Duplicated loading/error/refresh state management (~30 lines per screen)
- Three near-identical chat hooks (~150 lines each) with socket + pagination logic
- No stale-while-revalidate — users wait on every navigation

`@tanstack/react-query` v5.62.11 is already installed but unused. This plan migrates all server-state fetching to TanStack Query incrementally, without breaking existing functionality.

---

## Phase 0: Foundation

### Create `src/lib/query-client.ts`
- Export singleton `QueryClient` with defaults:
  - `staleTime: 2 * 60 * 1000` (2 min — cached data shown instantly on revisit)
  - `gcTime: 10 * 60 * 1000` (10 min garbage collection)
  - `retry: 1` (API client already retries 3x, avoid double-retry)
  - `refetchOnWindowFocus: false` (not relevant in RN)
  - `refetchOnReconnect: true`

### Modify `src/app/_layout.tsx`
- Add `QueryClientProvider` wrapping the app
- Provider order: `ThemeProvider > QueryClientProvider > SocketProvider > DrawerProvider`
- QueryClient is a module singleton so socket-context can import it directly (no circular deps)

### Create `src/hooks/queries/use-refresh-on-focus.ts`
- Small utility: calls `refetch()` on `useFocusEffect`
- Replaces the current `useFocusEffect` + manual fetch pattern
- Preserves "refetch on tab focus" behavior while showing cached data instantly

---

## Phase 1: Query Keys + Read-Only Hooks

### Create `src/lib/query-keys.ts`
Centralized key factory:
```
communities.all / .mine() / .browse() / .detail(id) / .members(id)
bookings.all / .list(role?) / .detail(id)
conversations.all / .list(type?) / .messages(conversationId)
offerings.all / .community(communityId) / .detail(id) / .schedules(id)
board.all / .feed(communityId)
addresses.all
notifications.all / .unreadCount
profile.me
```

### Create query hooks in `src/hooks/queries/`

**`use-communities.ts`**
- `useMyCommunities()` → wraps `getCommunities()`, `enabled: !!user`
- `useBrowseCommunities()` → wraps `browseCommunities()`
- `useCommunityDetail(id)` → wraps `getCommunity(id)`
- `useCommunityMembers(id)` → wraps `getCommunityMembers(id)`

**`use-bookings.ts`**
- `useMyBookings(role?)` → wraps `getMyBookings(role)`
- `useBookingDetail(id)` → wraps `getBooking(id)`

**`use-conversations.ts`**
- `useConversations(type?)` → wraps `listConversations(type)`

**`use-addresses.ts`**
- `useAddresses()` → wraps `getAddresses()`

**`use-notifications.ts`**
- `useNotifications(params?)` → wraps `getNotifications(params)`
- `useUnreadCount()` → wraps `getUnreadCount()`

**`use-offerings.ts`**
- `useCommunityOfferings(communityId)` → wraps `getCommunityOfferings(communityId)`
- `useOffering(id)` → wraps `getOffering(id)`
- `useOfferingSchedules(id)` → wraps `getOfferingSchedules(id)`

All hooks: `enabled: !!user` from `useAuthStore`, return TanStack Query result object.

---

## Phase 2: Migrate Screens (one at a time, test after each)

### 2a. `src/app/(tabs)/communities.tsx`
- Replace `MyCommunities` sub-component state with `useMyCommunities()` + `useRefreshOnFocus`
- Replace `BrowseCommunities` sub-component state with `useBrowseCommunities()`
- Map: `query.isLoading` → spinner, `query.isFetching && !query.isLoading` → RefreshControl
- Delete: manual `useState` triplets, `useCallback` fetch functions, `useFocusEffect` calls

### 2b. `src/app/(tabs)/conversations.tsx`
- Replace with `useConversations()`
- Same mapping pattern

### 2c. `src/app/account/bookings/index.tsx`
- Replace with `useMyBookings(activeTab === 'all' ? undefined : activeTab)`
- Tab switch → different query key → instant cached results for previously visited tabs

### 2d. `src/app/booking/[bookingId]/index.tsx`
- Replace with `useBookingDetail(bookingId)`
- Keep error state UI (use `query.error`)
- After status update mutation: invalidate `bookings.detail(id)` and `bookings.all`

### 2e. `src/app/community/[communityId]/index.tsx`
- Replace with `useCommunityDetail(communityId)` + `useCommunityMembers(communityId)`
- Derive `isMember` / `currentMembership` from members query data
- Join/leave mutations handled in Phase 3

### 2f. `src/components/pages/community/board-tab.tsx`
- Create `useBoardFeed(communityId)` using `useInfiniteQuery` (cursor pagination)
- `getNextPageParam: (lastPage) => lastPage.pagination.next_cursor ?? undefined`

---

## Phase 3: Mutation Hooks

### Create in `src/hooks/queries/`

**`use-community-mutations.ts`**

| Mutation | Invalidates |
|----------|-------------|
| `useJoinCommunity` | `communities.mine`, `communities.browse`, `communities.members(id)` |
| `useLeaveCommunity` | same |
| `useCreateCommunity` | `communities.mine` |
| `useGenerateInviteLink` | none (returns data) |
| `useAcceptInviteLink` | `communities.mine` |

**`use-booking-mutations.ts`**

| Mutation | Invalidates |
|----------|-------------|
| `useCreateBooking` | `bookings.list` |
| `useUpdateBookingStatus` | `bookings.detail(id)`, `bookings.all` |

**`use-offering-mutations.ts`**

| Mutation | Invalidates |
|----------|-------------|
| `useCreateOffering` | `offerings.community(id)`, `board.feed(id)` |
| `useUpdateOffering` | `offerings.detail(id)`, `offerings.community(communityId)` |
| `useDeleteOffering` | same |

**`use-address-mutations.ts`**

| Mutation | Invalidates |
|----------|-------------|
| `useCreateAddress` | `addresses.all` |
| `useUpdateAddress` | `addresses.all` |
| `useDeleteAddress` | `addresses.all` |

**`use-profile-mutations.ts`**

| Mutation | Invalidates |
|----------|-------------|
| `useUpdateProfile` | `profile.me` + calls `authStore.fetchUser()` |
| `useUploadAvatar` | same |

Pattern: `useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries(...) })`

---

## Phase 4: Socket.io + Cache Integration

### Modify `src/contexts/socket-context.tsx`
- Import `queryClient` from `@/lib/query-client` (module-level, not via hook)
- Wire socket events to cache invalidation:

```
notification:new          → invalidate notifications.all + notifications.unreadCount
notification:badge_update → keep current badge state + invalidate notifications
message:new               → invalidate conversations.list() (updates preview/ordering)
```

---

## Phase 5: Consolidate Chat Hooks

### Create `src/hooks/queries/use-chat.ts`
Replace three hooks (`use-community-chat`, `use-booking-chat`, `use-direct-chat`) with:

**`useChatMessages(options)`**
```ts
options: {
  conversationId: string | null
  communityId?: string    // for community chat room join
  bookingId?: string      // for booking chat room join
  userId: string | null
  enabled?: boolean
}
```

- Initial load: `useInfiniteQuery` with cursor pagination on `conversations.messages(id)`
- For community chat: first fetches conversation via `getCommunityConversation`, then messages
- For booking chat: first fetches conversation via `getBookingConversation`, then messages
- For direct chat: uses `conversationId` directly
- Socket `message:new` → `queryClient.setQueryData` to prepend message (O(1), no refetch)
- Socket room join/leave via `useEffect` (same as current)
- Deduplication check on incoming socket messages (same as current)

**`useSendMessage(conversationId, communityId?)`**
- `useMutation` with optimistic prepend + rollback on error
- Community chat uses `sendMessage(communityId, content)`
- Others use `sendConversationMessage(conversationId, content)`

### Delete after migration
- `src/hooks/use-community-chat.ts`
- `src/hooks/use-booking-chat.ts`
- `src/hooks/use-direct-chat.ts`

---

## Phase 6: Auth Reset

### Modify `src/lib/stores/auth-store.ts`
- On sign-out (`clearUser`): call `queryClient.clear()` to wipe all cached data
- Prevents stale user A data showing for user B
- All queries with `enabled: !!user` auto-start on next login

---

## Files Summary

### New files to create (10)
- `src/lib/query-client.ts`
- `src/lib/query-keys.ts`
- `src/hooks/queries/use-refresh-on-focus.ts`
- `src/hooks/queries/use-communities.ts`
- `src/hooks/queries/use-bookings.ts`
- `src/hooks/queries/use-conversations.ts`
- `src/hooks/queries/use-addresses.ts`
- `src/hooks/queries/use-notifications.ts`
- `src/hooks/queries/use-offerings.ts`
- `src/hooks/queries/use-chat.ts`

### New mutation files (5)
- `src/hooks/queries/use-community-mutations.ts`
- `src/hooks/queries/use-booking-mutations.ts`
- `src/hooks/queries/use-offering-mutations.ts`
- `src/hooks/queries/use-address-mutations.ts`
- `src/hooks/queries/use-profile-mutations.ts`

### Files to modify (9)
- `src/app/_layout.tsx` — add QueryClientProvider
- `src/app/(tabs)/communities.tsx` — use query hooks
- `src/app/(tabs)/conversations.tsx` — use query hooks
- `src/app/account/bookings/index.tsx` — use query hooks
- `src/app/booking/[bookingId]/index.tsx` — use query hooks
- `src/app/community/[communityId]/index.tsx` — use query hooks
- `src/components/pages/community/board-tab.tsx` — use infinite query
- `src/contexts/socket-context.tsx` — add cache invalidation
- `src/lib/stores/auth-store.ts` — clear cache on sign-out

### Files to delete (3, after Phase 5)
- `src/hooks/use-community-chat.ts`
- `src/hooks/use-booking-chat.ts`
- `src/hooks/use-direct-chat.ts`

---

## Verification

After each phase:
1. Run `npx expo start` and test affected screens
2. Verify: cached data shows instantly on back-navigation (no spinner)
3. Verify: pull-to-refresh still works
4. Verify: mutations update the UI correctly (join community, update booking status)
5. After Phase 4: verify socket events update cached data (send a message, check conversation list updates)
6. After Phase 5: verify all three chat types work (community, booking, direct)
7. After Phase 6: sign out → sign in as different user → verify no stale data
