# Notification System Plan

## Current State: 90% Complete

The architecture is solid — DB triggers create notifications on booking status changes, pg_notify pipes them to Socket.io for online users, and Expo push service handles offline delivery. Frontend UI is fully built.

**What works:**
- Booking status notifications (trigger-generated)
- Community invitation notifications
- Real-time Socket.io delivery to online users
- All CRUD API endpoints (list, read, mark read, delete)
- All frontend components (popover, full screen, badges)
- Push notification service (Expo SDK integration)
- Mobile notification handlers (permissions, tap-to-navigate)

**What's broken/missing:**

| Issue | Impact | Effort |
|---|---|---|
| No `/api/v1/push-tokens` route | Push notifications can't work — tokens never saved | Low |
| No notifications for: new messages, new offerings, reviews | Silent features — users don't know about activity | Medium |
| No notification for booking chat messages (offer cards, etc.) | Users miss negotiation activity | Medium |
| No notification preferences (opt-out per type) | Users can't control what they receive | Low-Medium |

---

## Phase 1: Push Token Registration (Critical)

Create `POST /api/v1/push-tokens` and `DELETE /api/v1/push-tokens` routes.

**Files:**
- New: `nextserver/src/app/api/v1/push-tokens/route.ts`
- New: `nextserver/src/lib/validations/push-token.ts`

**POST** — register a push token:
```json
{ "token": "ExponentPushToken[xxx]", "device_type": "android", "device_name": "Pixel 8" }
```
- Upsert: if token exists, update `last_used_at` + `is_active = true`
- If new, insert with `profile_id = user.id`

**DELETE** — deregister on logout:
```json
{ "token": "ExponentPushToken[xxx]" }
```
- Set `is_active = false` (soft delete, token may be re-activated)

---

## Phase 2: Message Notifications

When a new message is sent in a booking or direct conversation, notify participants who are NOT currently in the chat room.

**Trigger approach:** Add a trigger on `messages` INSERT that:
1. Finds all participants of the conversation (excluding the sender)
2. For each participant NOT currently connected to the conversation's Socket.io room:
   - Create a `new_message` notification with `related_booking_id` or sender info
3. The existing pg_notify → Socket.io → push pipeline handles delivery

**Alternative (simpler):** Create notifications for ALL participants except sender. The frontend already handles dedup (Socket.io dedup + notification list shows only unread).

**Files:**
- New migration: trigger on `messages` INSERT
- Or: add notification creation to the message send logic in community-conversation and conversation-messages routes

---

## Phase 3: Offering Notifications

When a new offering is posted in a community, notify community members.

**Options:**
- **Notify all members** — simple but noisy for large communities
- **Notify followers/interested** — requires a follow/subscribe feature (future)

**Recommended for v1:** Notify all active members of the community (excluding the provider). Use a batch approach — don't create 100 individual notifications for a 100-member community. Instead:
- Create one notification per member (needed for individual read/dismiss tracking)
- Batch the Expo push sends (expo-push-service already handles batching)

**Files:**
- Add to `offering-service.ts` `createCommunityOffering()` — after creating the offering, create notifications for community members

---

## Phase 4: Chat Offer Notifications

When a price offer is made/accepted/declined in a booking chat, notify the other party. This partially exists via the booking status trigger, but offer-specific notifications are missing.

**What to add:**
- `price_offer_received` — when someone sends you an offer
- `price_offer_accepted` — when your offer is accepted
- `price_offer_declined` — when your offer is declined

**Files:**
- Add to `offer-service.ts` — after creating offer/response messages, create notification for the other party

---

## Phase 5: Notification Preferences (Nice-to-Have)

Allow users to opt out of specific notification types.

**Schema:**
```sql
CREATE TABLE notification_preferences (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id),
  disabled_types TEXT[] DEFAULT '{}',
  do_not_disturb_until TIMESTAMPTZ,
  push_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Logic:** Before creating a notification, check if the target user has disabled that type. The pg_notify listener already checks for push tokens — add a preferences check there too.

---

## Implementation Priority

| Phase | What | Why first |
|---|---|---|
| **1** | Push token routes | Unblocks push notifications entirely |
| **2** | Message notifications | Users need to know when they receive messages |
| **3** | Offer notifications | Users need to know about price offers |
| **4** | Offering notifications | Community engagement |
| **5** | Preferences | User control |

Phase 1 is ~30 minutes. Phases 2-4 are each ~1 hour. Phase 5 is a separate feature.
