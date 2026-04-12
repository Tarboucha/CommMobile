/**
 * End-to-end test for the full booking flow:
 *
 *   1. Log in as provider (test3@kodo.com) and customer (test2@kodo.com)
 *   2. Create a loan offering + schedule (as provider, direct Prisma)
 *   3. POST /api/bookings            — customer creates the booking
 *   4. GET  /api/bookings/:id        — assert snapshots are populated
 *   5. PATCH /api/bookings/:id       — provider accepts (→ confirmed)
 *   6. PATCH /api/bookings/:id       — provider marks loaned_out
 *   7. POST /api/bookings/:id/items/:itemId/return — provider marks returned
 *   8. Verify booking_status = 'returned' and slots released
 *   9. Cleanup
 *
 * Hits the real running dev server at localhost:3002, using real Supabase
 * sessions for both accounts.
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const API_BASE = 'http://localhost:3002';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_OR_PUBLISHABLE_KEY!;

const PROVIDER_EMAIL = 'test3@kodo.com';
const CUSTOMER_EMAIL = 'test2@kodo.com';
const PASSWORD = 'test123';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function section(title: string) {
  console.log(`\n${'─'.repeat(70)}\n${title}\n${'─'.repeat(70)}`);
}

function ok(msg: string) {
  console.log(`  ✓ ${msg}`);
}

function fail(msg: string): never {
  console.log(`  ✗ ${msg}`);
  throw new Error(msg);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) fail(msg);
  else ok(msg);
}

async function login(email: string): Promise<string> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (error || !data.session) {
    throw new Error(`Login failed for ${email}: ${error?.message}`);
  }
  return data.session.access_token;
}

async function api<T = any>(
  token: string,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: any;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }
  if (!res.ok) {
    throw new Error(
      `${method} ${path} → ${res.status}: ${JSON.stringify(parsed)}`
    );
  }
  return parsed;
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

async function cleanup(providerId: string) {
  const offerings = await prisma.offerings.findMany({
    where: { provider_id: providerId, title: { startsWith: 'E2E Test' } },
    select: { id: true },
  });
  const offeringIds = offerings.map((o) => o.id);
  if (offeringIds.length === 0) return;

  const items = await prisma.booking_items.findMany({
    where: { offering_id: { in: offeringIds } },
    select: { id: true, booking_id: true },
  });
  const bookingIds = [...new Set(items.map((i) => i.booking_id))];
  const itemIds = items.map((i) => i.id);

  if (bookingIds.length > 0) {
    // Clean up conversations + messages + price_offers (CASCADE handles most via FK)
    const conversations = await prisma.conversations.findMany({
      where: { booking_id: { in: bookingIds } },
      select: { id: true },
    });
    const conversationIds = conversations.map((c) => c.id);

    if (conversationIds.length > 0) {
      // Clear accepted_offer_id FK before deleting price_offers
      await prisma.bookings.updateMany({
        where: { id: { in: bookingIds }, accepted_offer_id: { not: null } },
        data: { accepted_offer_id: null },
      });
      await prisma.price_offers.deleteMany({
        where: { booking_id: { in: bookingIds } },
      });
      await prisma.messages.deleteMany({
        where: { conversation_id: { in: conversationIds } },
      });
      await prisma.conversation_participants.deleteMany({
        where: { conversation_id: { in: conversationIds } },
      });
      await prisma.conversations.deleteMany({
        where: { id: { in: conversationIds } },
      });
    }

    await prisma.booking_status_history.deleteMany({
      where: { booking_id: { in: bookingIds } },
    });
    await prisma.booking_schedule_snapshots.deleteMany({
      where: { booking_item_id: { in: itemIds } },
    });
    await prisma.booking_provider_snapshots.deleteMany({
      where: { booking_item_id: { in: itemIds } },
    });
    await prisma.booking_items.deleteMany({
      where: { id: { in: itemIds } },
    });
    await prisma.booking_customer_snapshots.deleteMany({
      where: { booking_id: { in: bookingIds } },
    });
    await prisma.booking_delivery_snapshots.deleteMany({
      where: { booking_id: { in: bookingIds } },
    });
    await prisma.booking_community_snapshots.deleteMany({
      where: { booking_id: { in: bookingIds } },
    });
    await prisma.bookings.deleteMany({ where: { id: { in: bookingIds } } });
  }

  const schedules = await prisma.availability_schedules.findMany({
    where: { offering_id: { in: offeringIds } },
    select: { id: true },
  });
  await prisma.schedule_instances.deleteMany({
    where: { schedule_id: { in: schedules.map((s) => s.id) } },
  });
  await prisma.availability_schedules.deleteMany({
    where: { offering_id: { in: offeringIds } },
  });
  await prisma.offerings.deleteMany({ where: { id: { in: offeringIds } } });
}

// ─── Main flow ───────────────────────────────────────────────────────────────

async function main() {
  section('1. Resolve test accounts & shared community');

  const provider = await prisma.profiles.findFirstOrThrow({
    where: { email: PROVIDER_EMAIL },
  });
  const customer = await prisma.profiles.findFirstOrThrow({
    where: { email: CUSTOMER_EMAIL },
  });
  ok(`provider: ${provider.email} (${provider.id})`);
  ok(`customer: ${customer.email} (${customer.id})`);

  // Find a community both belong to with posting rights for the provider
  const providerMembership = await prisma.community_members.findFirstOrThrow({
    where: {
      profile_id: provider.id,
      membership_status: 'active',
      can_post_offerings: true,
      community_members_community_id_profile_id_key: undefined,
    },
  });
  const customerMembership = await prisma.community_members.findFirst({
    where: {
      profile_id: customer.id,
      community_id: providerMembership.community_id,
      membership_status: 'active',
    },
  });
  if (!customerMembership) {
    throw new Error(
      `${CUSTOMER_EMAIL} is not a member of community ${providerMembership.community_id}`
    );
  }
  const communityId = providerMembership.community_id;
  ok(`shared community: ${communityId}`);

  section('2. Cleanup previous test data');
  await cleanup(provider.id);
  ok('previous data removed');

  section('3. Login via Supabase (real sessions)');
  const providerToken = await login(PROVIDER_EMAIL);
  const customerToken = await login(CUSTOMER_EMAIL);
  ok('provider + customer tokens obtained');

  section('4. Create loan offering + schedule (via Prisma as provider)');
  const offering = await prisma.offerings.create({
    data: {
      community_id: communityId,
      provider_id: provider.id,
      title: 'E2E Test Drill (Loan)',
      description: 'E2E: loaner drill for the booking flow test',
      category: 'product',
      transaction_type: 'loan',
      price_type: 'free',
      fulfillment_method: 'pickup',
      currency_code: 'EUR',
      requires_deposit: true,
      deposit_amount: 50,
      status: 'active',
      version: 1,
    },
  });
  ok(`offering created: ${offering.id}`);

  const today = new Date();
  const schedule = await prisma.availability_schedules.create({
    data: {
      offering_id: offering.id,
      rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU',
      dtstart: new Date(`${today.toISOString().split('T')[0]}T00:00:00Z`),
      start_time: new Date('1970-01-01T09:00:00Z'),
      end_time: new Date('1970-01-01T18:00:00Z'),
      slots_available: 1,
      is_active: true,
      loan_duration_days: 3,
      loan_max_duration_days: 7,
    },
  });
  ok(`schedule created: ${schedule.id}`);

  section('5. POST /api/bookings (customer)');
  const startDate = today.toISOString().split('T')[0];
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + 2); // 3-day loan
  const dueDateStr = dueDate.toISOString().split('T')[0];

  const createRes = await api<{ data: { booking: { id: string; booking_number: string; booking_status: string } } }>(
    customerToken,
    'POST',
    '/api/bookings',
    {
      community_id: communityId,
      items: [
        {
          offering_id: offering.id,
          offering_version: 1,
          quantity: 1,
          fulfillment_method: 'pickup',
          schedule_id: schedule.id,
          instance_date: startDate,
          is_loan: true,
          loan_start_date: startDate,
          loan_due_date: dueDateStr,
          deposit_amount: 50,
        },
      ],
      payment_method: 'cash',
      idempotency_key: randomUUID(),
    }
  );
  const bookingId = createRes.data.booking.id;
  ok(`booking created: id=${bookingId}, number=${createRes.data.booking.booking_number}`);
  assert(createRes.data.booking.booking_status === 'pending', 'status is pending on create');

  section('6. GET /api/bookings/:id — assert snapshots');
  const getRes = await api<{ data: { booking: any } }>(
    customerToken,
    'GET',
    `/api/bookings/${bookingId}`
  );
  const b = getRes.data.booking;
  assert(b.booking_items?.length === 1, 'booking has 1 item');

  const item = b.booking_items[0];
  const ymd = (v: string) => v.slice(0, 10);
  assert(item.is_loan === true, 'item.is_loan');
  assert(ymd(item.loan_start_date) === startDate, `item.loan_start_date = ${startDate}`);
  assert(ymd(item.loan_due_date) === dueDateStr, `item.loan_due_date = ${dueDateStr}`);
  assert(Number(item.deposit_amount) === 50, 'item.deposit_amount = 50');
  assert(item.snapshot_title === 'E2E Test Drill (Loan)', 'item.snapshot_title matches');
  assert(item.snapshot_category === 'product', 'item.snapshot_category = product');
  assert(item.snapshot_transaction_type === 'loan', 'item.snapshot_transaction_type = loan');

  // booking_schedule_snapshots (created by RPC)
  const schedSnap = item.booking_schedule_snapshots;
  assert(schedSnap, 'booking_schedule_snapshots exists');
  assert(schedSnap.original_schedule_id === schedule.id, 'schedule snapshot points at original schedule');
  assert(schedSnap.snapshot_slots_available === 1, 'snapshot_slots_available = 1');
  assert(schedSnap.snapshot_loan_duration_days === 3, 'snapshot_loan_duration_days = 3');

  // booking_provider_snapshots (created by route after RPC)
  const provSnap = item.booking_provider_snapshots;
  assert(provSnap, 'booking_provider_snapshots exists');
  assert(provSnap.original_provider_id === provider.id, 'provider snapshot points at provider');

  // booking_customer_snapshots
  assert(b.customer_snapshot, 'customer_snapshot exists');
  assert(b.customer_snapshot.original_customer_id === customer.id, 'customer snapshot points at customer');

  // booking_community_snapshots
  assert(b.community_snapshot, 'community_snapshot exists');
  assert(
    b.community_snapshot.original_community_id === communityId,
    'community snapshot points at community'
  );

  // No delivery snapshot for pickup bookings
  assert(!b.delivery_snapshot, 'no delivery_snapshot (pickup)');

  // Deposit totals
  assert(Number(b.deposit_total) === 50, 'booking.deposit_total = 50');
  assert(b.deposit_status === 'held', 'booking.deposit_status = held');

  // Status history (NULL → pending) created by trigger
  assert(
    Array.isArray(b.status_history) && b.status_history.length >= 1,
    'status_history has at least 1 entry (trigger-inserted)'
  );
  assert(
    b.status_history.some((e: any) => e.to_status === 'pending'),
    'status_history has pending entry'
  );

  section('7. Verify schedule slots reserved (3-day range)');
  const instances = await prisma.schedule_instances.findMany({
    where: {
      schedule_id: schedule.id,
      instance_date: {
        gte: new Date(`${startDate}T00:00:00Z`),
        lte: new Date(`${dueDateStr}T00:00:00Z`),
      },
    },
    orderBy: { instance_date: 'asc' },
  });
  assert(instances.length === 3, '3 schedule_instances reserved');
  instances.forEach((inst) =>
    assert(inst.slots_booked === 1, `${inst.instance_date.toISOString().split('T')[0]} slots_booked=1`)
  );

  section('8. PATCH /api/bookings/:id — provider accepts (pending → confirmed)');
  const confirmRes = await api<{ data: { booking: any } }>(
    providerToken,
    'PATCH',
    `/api/bookings/${bookingId}`,
    { booking_status: 'confirmed' }
  );
  assert(confirmRes.data.booking.booking_status === 'confirmed', 'booking_status = confirmed');
  assert(confirmRes.data.booking.confirmed_at, 'confirmed_at timestamp set');

  section('9. PATCH /api/bookings/:id — provider marks loaned_out (confirmed → loaned_out)');
  const loanedRes = await api<{ data: { booking: any } }>(
    providerToken,
    'PATCH',
    `/api/bookings/${bookingId}`,
    { booking_status: 'loaned_out' }
  );
  assert(loanedRes.data.booking.booking_status === 'loaned_out', 'booking_status = loaned_out');

  section('10. POST /api/bookings/:id/items/:itemId/return — return the loan');
  const returnRes = await api<{ data: { booking: any } }>(
    providerToken,
    'POST',
    `/api/bookings/${bookingId}/items/${item.id}/return`
  );
  assert(returnRes.data.booking.booking_status === 'returned', 'booking_status = returned');

  const returnedItem = returnRes.data.booking.booking_items[0];
  assert(returnedItem.loan_returned_at, 'loan_returned_at timestamp set');

  section('11. Verify schedule slots released');
  const instancesAfter = await prisma.schedule_instances.findMany({
    where: {
      schedule_id: schedule.id,
      instance_date: {
        gte: new Date(`${startDate}T00:00:00Z`),
        lte: new Date(`${dueDateStr}T00:00:00Z`),
      },
    },
    orderBy: { instance_date: 'asc' },
  });
  instancesAfter.forEach((inst) =>
    assert(
      inst.slots_booked === 0,
      `${inst.instance_date.toISOString().split('T')[0]} slots_booked=0 (released)`
    )
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SERVICE BOOKING FLOW
  // ═══════════════════════════════════════════════════════════════════════════

  section('12. Create service offering + schedule');
  const serviceOffering = await prisma.offerings.create({
    data: {
      community_id: communityId,
      provider_id: provider.id,
      title: 'E2E Test Haircut (Service)',
      description: 'E2E: service booking test',
      category: 'service',
      transaction_type: 'booking',
      price_type: 'fixed',
      price_amount: 25,
      fulfillment_method: 'at_location',
      currency_code: 'EUR',
      status: 'active',
      version: 1,
    },
  });
  ok(`service offering: ${serviceOffering.id}`);

  const serviceSchedule = await prisma.availability_schedules.create({
    data: {
      offering_id: serviceOffering.id,
      rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU',
      dtstart: new Date(`${startDate}T00:00:00Z`),
      start_time: new Date('1970-01-01T10:00:00Z'),
      end_time: new Date('1970-01-01T17:00:00Z'),
      slots_available: 3,
      is_active: true,
    },
  });
  ok(`service schedule: ${serviceSchedule.id}`);

  section('13. POST /api/bookings — service booking');
  const svcRes = await api<{ data: { booking: { id: string; booking_number: string; booking_status: string } } }>(
    customerToken,
    'POST',
    '/api/bookings',
    {
      community_id: communityId,
      items: [
        {
          offering_id: serviceOffering.id,
          offering_version: 1,
          quantity: 1,
          fulfillment_method: 'at_location',
          schedule_id: serviceSchedule.id,
          instance_date: startDate,
        },
      ],
      payment_method: 'cash',
      idempotency_key: randomUUID(),
    }
  );
  const svcBookingId = svcRes.data.booking.id;
  ok(`service booking created: ${svcRes.data.booking.booking_number}`);
  assert(svcRes.data.booking.booking_status === 'pending', 'service booking is pending');

  section('14. GET /api/bookings/:id — service snapshots');
  const svcGet = await api<{ data: { booking: any } }>(
    customerToken,
    'GET',
    `/api/bookings/${svcBookingId}`
  );
  const sb = svcGet.data.booking;
  const sItem = sb.booking_items[0];
  assert(!sItem.is_loan, 'service item is NOT loan');
  assert(sItem.snapshot_category === 'service', 'snapshot_category = service');
  assert(sItem.snapshot_transaction_type === 'booking', 'snapshot_transaction_type = booking');
  assert(Number(sItem.unit_price_amount) === 25, 'unit_price_amount = 25');
  assert(sItem.booking_schedule_snapshots, 'service has schedule snapshot');
  assert(sItem.booking_schedule_snapshots.snapshot_slots_available === 3, 'service snapshot_slots = 3');
  assert(sItem.booking_provider_snapshots, 'service has provider snapshot');
  assert(sb.customer_snapshot, 'service has customer snapshot');
  assert(sb.community_snapshot, 'service has community snapshot');
  assert(Number(sb.deposit_total) === 0, 'service deposit_total = 0');

  section('15. Verify single-date slot reserved for service');
  const svcInstances = await prisma.schedule_instances.findMany({
    where: { schedule_id: serviceSchedule.id, instance_date: new Date(`${startDate}T00:00:00Z`) },
  });
  assert(svcInstances.length === 1, '1 schedule_instance for service date');
  assert(svcInstances[0].slots_booked === 1, 'service: 1 slot reserved');

  section('16. Service: confirm → in_progress → ready → completed');
  await api(providerToken, 'PATCH', `/api/bookings/${svcBookingId}`, { booking_status: 'confirmed' });
  await api(providerToken, 'PATCH', `/api/bookings/${svcBookingId}`, { booking_status: 'in_progress' });
  await api(providerToken, 'PATCH', `/api/bookings/${svcBookingId}`, { booking_status: 'ready' });
  const svcComplete = await api<{ data: { booking: any } }>(
    providerToken, 'PATCH', `/api/bookings/${svcBookingId}`, { booking_status: 'completed' }
  );
  assert(svcComplete.data.booking.booking_status === 'completed', 'service booking completed');
  assert(svcComplete.data.booking.completed_at, 'service completed_at set');
  ok('service: full status flow passed');

  // ═══════════════════════════════════════════════════════════════════════════
  // TIME-SLOTTED SERVICE BOOKING FLOW
  // ═══════════════════════════════════════════════════════════════════════════

  section('16b. Create time-slotted service offering + schedule');
  const tsOffering = await prisma.offerings.create({
    data: {
      community_id: communityId,
      provider_id: provider.id,
      title: 'E2E Test Haircut (Time-Slotted)',
      description: 'E2E: time-slotted service booking test',
      category: 'service',
      transaction_type: 'booking',
      price_type: 'fixed',
      price_amount: 30,
      fulfillment_method: 'at_location',
      currency_code: 'EUR',
      status: 'active',
      version: 1,
    },
  });
  ok(`time-slotted offering: ${tsOffering.id}`);

  const tsSchedule = await prisma.availability_schedules.create({
    data: {
      offering_id: tsOffering.id,
      rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU',
      dtstart: new Date(`${startDate}T00:00:00Z`),
      start_time: new Date('1970-01-01T09:00:00Z'),
      end_time: new Date('1970-01-01T17:00:00Z'),
      slots_available: 1,
      is_active: true,
      slot_duration_minutes: 45,
    },
  });
  ok(`time-slotted schedule: ${tsSchedule.id} (45 min slots)`);

  section('16c. GET time-slots endpoint');
  const tsRes = await api<{ data: { schedule_id: string; date: string; slot_duration_minutes: number; slots: any[] } }>(
    customerToken,
    'GET',
    `/api/offerings/${tsOffering.id}/schedules/${tsSchedule.id}/time-slots?date=${startDate}`
  );
  assert(tsRes.data.slot_duration_minutes === 45, 'slot_duration_minutes = 45');
  // 09:00-17:00 with 45min → 10 slots (last at 15:45-16:30, 16:30+0:45=17:15 > 17:00 → dropped)
  const expectedSlots = Math.floor((17 - 9) * 60 / 45); // = 10
  assert(tsRes.data.slots.length === expectedSlots, `${expectedSlots} time slots generated`);
  assert(tsRes.data.slots[0].start_time === '09:00', 'first slot starts at 09:00');
  assert(tsRes.data.slots[0].end_time === '09:45', 'first slot ends at 09:45');
  assert(tsRes.data.slots[0].is_available === true, 'first slot is available');
  ok('time slots endpoint returns correct data');

  section('16d. Book the 09:00 time slot');
  const tsBookRes = await api<{ data: { booking: { id: string; booking_number: string; booking_status: string } } }>(
    customerToken,
    'POST',
    '/api/bookings',
    {
      community_id: communityId,
      items: [
        {
          offering_id: tsOffering.id,
          offering_version: 1,
          quantity: 1,
          fulfillment_method: 'at_location',
          schedule_id: tsSchedule.id,
          instance_date: startDate,
          instance_start_time: '09:00',
          instance_end_time: '09:45',
        },
      ],
      payment_method: 'cash',
      idempotency_key: randomUUID(),
    }
  );
  const tsBookingId = tsBookRes.data.booking.id;
  ok(`time-slotted booking created: ${tsBookRes.data.booking.booking_number}`);

  section('16e. Verify time-slotted instance + booking item');
  // Check schedule_instances has a row with slot_start_time = 09:00
  const tsInstance = await prisma.schedule_instances.findFirst({
    where: {
      schedule_id: tsSchedule.id,
      instance_date: new Date(`${startDate}T00:00:00Z`),
      slot_start_time: new Date('1970-01-01T09:00:00Z'),
    },
  });
  assert(tsInstance, 'schedule_instance row exists for 09:00 slot');
  assert(tsInstance!.slots_booked === 1, 'slots_booked = 1 for 09:00 slot');

  // Verify no sentinel row was created (date-based sentinel should NOT exist)
  const tsSentinel = await prisma.schedule_instances.findFirst({
    where: {
      schedule_id: tsSchedule.id,
      instance_date: new Date(`${startDate}T00:00:00Z`),
      slot_start_time: new Date('1970-01-01T00:00:00Z'),
    },
  });
  assert(!tsSentinel, 'no sentinel 00:00 row (time-slotted, not date-based)');

  // Fetch booking detail and check time fields
  const tsDetail = await api<{ data: { booking: any } }>(
    customerToken,
    'GET',
    `/api/bookings/${tsBookingId}`
  );
  const tsItem = tsDetail.data.booking.booking_items[0];
  assert(tsItem.instance_start_time, 'instance_start_time is set');
  assert(tsItem.instance_end_time, 'instance_end_time is set');
  assert(tsItem.snapshot_title === 'E2E Test Haircut (Time-Slotted)', 'ts item snapshot_title matches');
  assert(tsItem.snapshot_category === 'service', 'ts item snapshot_category = service');
  assert(tsItem.snapshot_transaction_type === 'booking', 'ts item snapshot_transaction_type = booking');
  assert(Number(tsItem.unit_price_amount) === 30, 'ts item unit_price = 30');

  // Schedule snapshot should capture slot_duration_minutes
  const tsSchedSnap = tsItem.booking_schedule_snapshots;
  assert(tsSchedSnap, 'ts booking_schedule_snapshots exists');
  assert(tsSchedSnap.snapshot_slot_duration_minutes === 45, 'ts snapshot_slot_duration_minutes = 45');
  assert(tsSchedSnap.snapshot_slots_available === 1, 'ts snapshot_slots_available = 1');

  // Provider snapshot
  const tsProvSnap = tsItem.booking_provider_snapshots;
  assert(tsProvSnap, 'ts provider snapshot exists');
  assert(tsProvSnap.original_provider_id === provider.id, 'ts provider snapshot points at provider');
  assert(tsProvSnap.snapshot_display_name, 'ts provider snapshot has display_name');
  assert(tsProvSnap.snapshot_email === 'test3@kodo.com', 'ts provider snapshot email correct');

  // Customer snapshot
  assert(tsDetail.data.booking.customer_snapshot, 'ts customer snapshot exists');
  assert(
    tsDetail.data.booking.customer_snapshot.original_customer_id === customer.id,
    'ts customer snapshot points at customer'
  );
  assert(
    tsDetail.data.booking.customer_snapshot.snapshot_email === 'test2@kodo.com',
    'ts customer snapshot email correct'
  );

  // Community snapshot
  assert(tsDetail.data.booking.community_snapshot, 'ts community snapshot exists');
  assert(
    tsDetail.data.booking.community_snapshot.snapshot_community_name === 'Houmet lem3alem',
    'ts community snapshot name correct'
  );

  section('16f. Verify 09:00 slot now unavailable, others still available');
  const tsRes2 = await api<{ data: { slots: any[] } }>(
    customerToken,
    'GET',
    `/api/offerings/${tsOffering.id}/schedules/${tsSchedule.id}/time-slots?date=${startDate}`
  );
  const slot0900 = tsRes2.data.slots.find((s: any) => s.start_time === '09:00');
  const slot0945 = tsRes2.data.slots.find((s: any) => s.start_time === '09:45');
  assert(slot0900 && !slot0900.is_available, '09:00 slot is no longer available');
  assert(slot0945 && slot0945.is_available, '09:45 slot is still available');
  ok('time-slotted availability correctly updated');

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT BOOKING FLOW
  // ═══════════════════════════════════════════════════════════════════════════

  section('17. Create event offering + schedule');
  const eventOffering = await prisma.offerings.create({
    data: {
      community_id: communityId,
      provider_id: provider.id,
      title: 'E2E Test Workshop (Event)',
      description: 'E2E: event booking test',
      category: 'event',
      transaction_type: 'booking',
      price_type: 'free',
      price_amount: 0,
      fulfillment_method: 'at_location',
      currency_code: 'EUR',
      status: 'active',
      version: 1,
    },
  });
  ok(`event offering: ${eventOffering.id}`);

  const eventSchedule = await prisma.availability_schedules.create({
    data: {
      offering_id: eventOffering.id,
      rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU',
      dtstart: new Date(`${startDate}T00:00:00Z`),
      start_time: new Date('1970-01-01T14:00:00Z'),
      end_time: new Date('1970-01-01T16:00:00Z'),
      slots_available: 20,
      is_active: true,
    },
  });
  ok(`event schedule: ${eventSchedule.id}`);

  section('18. POST /api/bookings — event booking (free)');
  const evtRes = await api<{ data: { booking: { id: string; booking_number: string; booking_status: string } } }>(
    customerToken,
    'POST',
    '/api/bookings',
    {
      community_id: communityId,
      items: [
        {
          offering_id: eventOffering.id,
          offering_version: 1,
          quantity: 1,
          fulfillment_method: 'at_location',
          schedule_id: eventSchedule.id,
          instance_date: startDate,
        },
      ],
      payment_method: 'cash',
      idempotency_key: randomUUID(),
    }
  );
  const evtBookingId = evtRes.data.booking.id;
  ok(`event booking created: ${evtRes.data.booking.booking_number}`);
  assert(evtRes.data.booking.booking_status === 'pending', 'event booking is pending');

  section('19. GET /api/bookings/:id — event snapshots');
  const evtGet = await api<{ data: { booking: any } }>(
    customerToken,
    'GET',
    `/api/bookings/${evtBookingId}`
  );
  const eb = evtGet.data.booking;
  const eItem = eb.booking_items[0];
  assert(!eItem.is_loan, 'event item is NOT loan');
  assert(eItem.snapshot_category === 'event', 'snapshot_category = event');
  assert(eItem.snapshot_transaction_type === 'booking', 'snapshot_transaction_type = booking');
  assert(Number(eItem.unit_price_amount) === 0, 'event unit_price = 0 (free)');
  assert(Number(eItem.total_amount) === 0, 'event total = 0');
  assert(eItem.booking_schedule_snapshots, 'event has schedule snapshot');
  assert(eItem.booking_schedule_snapshots.snapshot_slots_available === 20, 'event snapshot_slots = 20');
  assert(eItem.booking_provider_snapshots, 'event has provider snapshot');
  assert(eb.customer_snapshot, 'event has customer snapshot');
  assert(eb.community_snapshot, 'event has community snapshot');

  section('20. Verify single-date slot reserved for event');
  const evtInstances = await prisma.schedule_instances.findMany({
    where: { schedule_id: eventSchedule.id, instance_date: new Date(`${startDate}T00:00:00Z`) },
  });
  assert(evtInstances.length === 1, '1 schedule_instance for event date');
  assert(evtInstances[0].slots_booked === 1, 'event: 1 slot reserved');

  // ═══════════════════════════════════════════════════════════════════════════
  // CHAT + NEGOTIATION FLOW
  // ═══════════════════════════════════════════════════════════════════════════

  section('21. Verify conversation auto-created with loan booking');
  const loanConv = await prisma.conversations.findFirst({
    where: { booking_id: bookingId, conversation_type: 'booking' },
    include: {
      conversation_participants: true,
      messages: { orderBy: { created_at: 'asc' } },
    },
  });
  assert(loanConv, 'loan booking has a conversation');
  assert(loanConv!.conversation_participants.length === 2, 'conversation has 2 participants');
  const loanMsgs = loanConv!.messages;
  assert(loanMsgs.length >= 1, 'conversation has at least 1 message');
  assert((loanMsgs[0] as any).message_type === 'booking_request', 'first message is booking_request');
  assert((loanMsgs[0] as any).metadata?.booking_id === bookingId, 'booking_request metadata has booking_id');
  ok('loan booking conversation + booking_request verified');

  section('22. Verify status_update messages from loan flow');
  // The loan flow went: pending → confirmed → loaned_out → returned
  // Each transition should have generated a status_update message
  const statusMsgs = loanConv!.messages.filter((m: any) => m.message_type === 'status_update');
  assert(statusMsgs.length >= 3, `${statusMsgs.length} status_update messages (expected ≥3: confirmed, loaned_out, returned)`);
  ok('status_update messages generated for loan transitions');

  section('23. Create offering for negotiation test');
  const negoOffering = await prisma.offerings.create({
    data: {
      community_id: communityId,
      provider_id: provider.id,
      title: 'E2E Test Negotiable Service',
      description: 'E2E: price negotiation test',
      category: 'service',
      transaction_type: 'booking',
      price_type: 'fixed',
      price_amount: 100,
      fulfillment_method: 'at_location',
      currency_code: 'EUR',
      status: 'active',
      version: 1,
    },
  });
  const negoSchedule = await prisma.availability_schedules.create({
    data: {
      offering_id: negoOffering.id,
      rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU',
      dtstart: new Date(`${startDate}T00:00:00Z`),
      start_time: new Date('1970-01-01T09:00:00Z'),
      end_time: new Date('1970-01-01T17:00:00Z'),
      slots_available: 5,
      is_active: true,
    },
  });
  ok(`negotiation offering: ${negoOffering.id}`);

  section('24. Book with an offer (80 EUR instead of 100)');
  const negoBookRes = await api<{ data: { booking: any } }>(
    customerToken,
    'POST',
    '/api/bookings',
    {
      community_id: communityId,
      items: [{
        offering_id: negoOffering.id,
        offering_version: 1,
        quantity: 1,
        fulfillment_method: 'at_location',
        schedule_id: negoSchedule.id,
        instance_date: startDate,
      }],
      payment_method: 'cash',
      idempotency_key: randomUUID(),
      offer_amount: 80,
      offer_note: 'Can we do 80?',
    }
  );
  const negoBookingId = negoBookRes.data.booking.id;
  const negoConvId = negoBookRes.data.booking.conversation_id;
  assert(negoBookingId, 'negotiation booking created');
  assert(negoConvId, 'conversation_id returned in response');
  assert(negoBookRes.data.booking.booking_status === 'pending', 'booking is pending');
  ok(`negotiation booking: ${negoBookRes.data.booking.booking_number}`);

  section('25. Verify conversation has booking_request + price_offer');
  const negoConv = await prisma.conversations.findFirst({
    where: { id: negoConvId },
    include: { messages: { orderBy: { created_at: 'asc' } } },
  });
  assert(negoConv, 'negotiation conversation exists');
  const negoMsgs = negoConv!.messages;
  assert(negoMsgs.length >= 2, 'conversation has ≥2 messages');
  assert((negoMsgs[0] as any).message_type === 'booking_request', 'msg 1: booking_request');
  assert((negoMsgs[1] as any).message_type === 'price_offer', 'msg 2: price_offer');
  assert((negoMsgs[1] as any).metadata?.offered_amount === 80, 'offer amount = 80 in metadata');

  // Verify price_offers row
  const pendingOffer = await prisma.price_offers.findFirst({
    where: { booking_id: negoBookingId, offer_status: 'pending' },
  });
  assert(pendingOffer, 'pending price_offer row exists');
  assert(Number(pendingOffer!.offered_amount) === 80, 'price_offer.offered_amount = 80');
  assert(pendingOffer!.offered_by === customer.id, 'offer made by customer');
  ok('booking_request + price_offer messages verified');

  section('26. Provider counters with 90 EUR');
  const counterRes = await api<{ data: any }>(
    providerToken,
    'POST',
    `/api/bookings/${negoBookingId}/offers`,
    { action: 'counter', offered_amount: 90, note: 'How about 90?' }
  );
  assert(counterRes.data.offer, 'counter offer created');
  assert(Number(counterRes.data.offer.offered_amount) === 90, 'counter amount = 90');

  // Previous offer should be superseded
  const superseded = await prisma.price_offers.findUnique({ where: { id: pendingOffer!.id } });
  assert(superseded?.offer_status === 'superseded', 'original offer is superseded');

  // New pending offer
  const newPending = await prisma.price_offers.findFirst({
    where: { booking_id: negoBookingId, offer_status: 'pending' },
  });
  assert(newPending, 'new pending offer exists');
  assert(Number(newPending!.offered_amount) === 90, 'new offer = 90');
  assert(newPending!.offered_by === provider.id, 'counter offer by provider');
  ok('counter-offer flow works');

  section('27. Customer accepts the 90 EUR offer');
  const acceptRes = await api<{ data: any }>(
    customerToken,
    'POST',
    `/api/bookings/${negoBookingId}/offers`,
    { action: 'accept', offer_id: newPending!.id }
  );
  assert(acceptRes.data.agreed_amount === 90, 'agreed amount = 90');

  // Verify booking updated
  const updatedBooking = await prisma.bookings.findUnique({ where: { id: negoBookingId } });
  assert(Number(updatedBooking!.total_amount) === 90, 'booking.total_amount = 90 (updated)');
  assert(updatedBooking!.accepted_offer_id === newPending!.id, 'accepted_offer_id set');
  assert(updatedBooking!.booking_status === 'pending', 'booking still pending (ready for provider accept)');
  ok('offer acceptance updates booking correctly');

  section('28. Verify full message timeline in negotiation chat');
  const finalConv = await prisma.conversations.findFirst({
    where: { id: negoConvId },
    include: { messages: { orderBy: { created_at: 'asc' } } },
  });
  const msgTypes = finalConv!.messages.map((m: any) => m.message_type);
  assert(msgTypes[0] === 'booking_request', 'timeline[0] = booking_request');
  assert(msgTypes[1] === 'price_offer', 'timeline[1] = price_offer (customer 80)');
  assert(msgTypes[2] === 'price_offer', 'timeline[2] = price_offer (provider 90)');
  assert(msgTypes[3] === 'offer_response', 'timeline[3] = offer_response (accepted)');
  ok(`full negotiation timeline: ${msgTypes.join(' → ')}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════════════

  section('29. Cleanup');
  await cleanup(provider.id);
  ok('test data removed');

  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log('  ALL CHECKS PASSED');
  console.log('════════════════════════════════════════════════════════════════════\n');
}

main()
  .then(() => prisma.$disconnect().then(() => process.exit(0)))
  .catch(async (e) => {
    console.error('\n✗ TEST FAILED:', e.message);
    if (e.stack) console.error(e.stack.split('\n').slice(0, 8).join('\n'));
    await prisma.$disconnect();
    process.exit(1);
  });
