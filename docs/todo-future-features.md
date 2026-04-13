# Future Features TODO

Features that are planned but require infrastructure not yet in place (cron jobs, background workers, external services).

---

## Cron Jobs / Scheduled Tasks

### 1. Loan Return Reminder (24h before due date)
- **Trigger**: Daily cron (e.g., 08:00 UTC)
- **Logic**: Query `booking_items WHERE is_loan = true AND loan_returned_at IS NULL AND loan_due_date = CURRENT_DATE + 1`
- **Action**: Create `loan_return_reminder` notification for the customer + send push notification
- **Implementation options**: pg_cron (Supabase), node-cron, or Vercel cron hitting a protected endpoint
- **Priority**: High — directly affects user experience and item returns

### 2. Overdue Detection (mark loans as overdue)
- **Trigger**: Daily cron (e.g., 00:15 UTC)
- **Logic**: Query `bookings WHERE booking_status = 'loaned_out'` and check if any `booking_items.loan_due_date < CURRENT_DATE`
- **Action**: Update `booking_status = 'overdue'` + create notification for both customer and provider
- **Depends on**: Loan return reminder (should fire first)
- **Priority**: High

### 3. Price Offer Expiry (24h timeout)
- **Trigger**: Hourly cron or lazy check on fetch
- **Logic**: Query `price_offers WHERE offer_status = 'pending' AND expires_at < NOW()`
- **Action**: Update `offer_status = 'expired'` + insert `offer_response(expired)` message in chat
- **Priority**: Medium — offers without expiry enforcement feel broken

### 4. Inactive Booking Cleanup
- **Trigger**: Daily cron
- **Logic**: Cancel bookings stuck in `pending` for > 7 days with no activity
- **Action**: Update `booking_status = 'cancelled'` with reason "Auto-cancelled: no provider response"
- **Priority**: Low — nice-to-have for data hygiene

---

## Push Notification Triggers (Requires Phase 1: Push Token Route)

### 5. New Message Notification
- **Trigger**: On message INSERT (trigger or service-level)
- **Logic**: Notify all conversation participants except sender who are NOT in the Socket.io room
- **Priority**: High — users miss messages without this

### 6. New Offering Notification
- **Trigger**: On offering creation in a community
- **Logic**: Notify all active community members (excluding provider)
- **Priority**: Medium

### 7. Price Offer Notification
- **Trigger**: On price_offer creation (already in offer-service)
- **Logic**: Notify the other booking party
- **Priority**: High — negotiation is time-sensitive

---

## Features Requiring Design Decisions

### 8. Notification Preferences
- Per-type opt-out (e.g., disable `new_offering` notifications)
- Do-not-disturb schedule
- Push vs. in-app toggle
- **Requires**: New `notification_preferences` table + UI settings screen

### 9. Reschedule Flow (Services + Events)
- Customer requests reschedule → cancels current booking + opens new booking sheet pre-filled
- Or: provider proposes new time → customer confirms
- **Requires**: UX design decision on flow

### 10. Waitlist for Full Events
- When `slots_available` is reached, allow "Join Waitlist"
- Auto-promote when someone cancels
- **Requires**: New `waitlist` table or status on booking

### 11. Review System
- Post-completion review prompt (trigger after `completed` status)
- Rating + text review
- Display on offering detail + provider profile
- **Requires**: Reviews table exists in schema but no API/UI built

### 12. Recurring Bookings (Services)
- "Book every Monday at 10:00" for regular appointments
- Creates individual bookings per occurrence
- **Requires**: Significant feature — recurring booking entity + generation logic
