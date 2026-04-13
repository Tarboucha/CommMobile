import { prisma } from "@/lib/prisma";
import { assertOfferingOwner, assertScheduleOwner } from "@/lib/guards/assert-offering-owner";
import { assertCommunityMember } from "@/lib/guards/assert-community-member";
import { NotFoundError, ValidationError } from "@/lib/errors/domain-errors";
import { decodeCursor, buildPaginatedResponse } from "@/lib/utils/pagination";
import { dateFromYMD, timeFromHHMM, formatTime } from "@/lib/utils/date-helpers";
import type { CreateOfferingInput, CreateScheduleInput, UpdateScheduleInput, OfferingFilterInput } from "@/lib/validations/offering";

// ============================================================================
// Offering CRUD
// ============================================================================

export async function getOfferingDetail(offeringId: string) {
  const offering = await prisma.offerings.findFirst({
    where: { id: offeringId, deleted_at: null },
    include: {
      profiles: { select: { id: true, first_name: true, last_name: true, avatar_url: true } },
      availability_schedules: true,
    },
  });

  if (!offering) throw new NotFoundError("Offering");
  return offering;
}

export async function updateOffering(
  offeringId: string,
  userId: string,
  data: Record<string, unknown>
) {
  await assertOfferingOwner(offeringId, userId);

  return prisma.offerings.update({
    where: { id: offeringId },
    data: { ...data, updated_at: new Date() },
  });
}

export async function softDeleteOffering(offeringId: string, userId: string) {
  await assertOfferingOwner(offeringId, userId);

  await prisma.offerings.update({
    where: { id: offeringId },
    data: { deleted_at: new Date(), status: "deleted" },
  });
}

// ============================================================================
// Schedule CRUD
// ============================================================================

export async function listSchedules(offeringId: string) {
  return prisma.availability_schedules.findMany({
    where: { offering_id: offeringId },
    orderBy: { created_at: "desc" },
  });
}

export async function createSchedule(
  offeringId: string,
  userId: string,
  input: CreateScheduleInput
) {
  await assertOfferingOwner(offeringId, userId);

  return prisma.availability_schedules.create({
    data: {
      offering_id: offeringId,
      rrule: input.rrule,
      dtstart: dateFromYMD(input.dtstart),
      dtend: input.dtend ? dateFromYMD(input.dtend) : null,
      start_time: timeFromHHMM(input.start_time),
      end_time: timeFromHHMM(input.end_time),
      slots_available: input.slots_available,
      slot_label: input.slot_label ?? null,
      is_active: input.is_active,
      ...(input.loan_duration_days !== undefined && { loan_duration_days: input.loan_duration_days }),
      ...(input.loan_max_duration_days !== undefined && { loan_max_duration_days: input.loan_max_duration_days }),
      ...(input.slot_duration_minutes !== undefined && { slot_duration_minutes: input.slot_duration_minutes }),
    },
  });
}

export async function updateSchedule(
  offeringId: string,
  scheduleId: string,
  userId: string,
  input: UpdateScheduleInput
) {
  await assertScheduleOwner(offeringId, scheduleId, userId);

  const data: Record<string, unknown> = { updated_at: new Date() };

  if (input.rrule !== undefined) data.rrule = input.rrule;
  if (input.dtstart !== undefined) data.dtstart = dateFromYMD(input.dtstart);
  if (input.dtend !== undefined) data.dtend = input.dtend ? dateFromYMD(input.dtend) : null;
  if (input.start_time !== undefined) data.start_time = timeFromHHMM(input.start_time);
  if (input.end_time !== undefined) data.end_time = timeFromHHMM(input.end_time);
  if (input.slots_available !== undefined) data.slots_available = input.slots_available;
  if (input.slot_label !== undefined) data.slot_label = input.slot_label;
  if (input.is_active !== undefined) data.is_active = input.is_active;
  if (input.loan_duration_days !== undefined) data.loan_duration_days = input.loan_duration_days;
  if (input.loan_max_duration_days !== undefined) data.loan_max_duration_days = input.loan_max_duration_days;
  if (input.slot_duration_minutes !== undefined) data.slot_duration_minutes = input.slot_duration_minutes;

  return prisma.availability_schedules.update({
    where: { id: scheduleId },
    data,
  });
}

export async function deleteSchedule(
  offeringId: string,
  scheduleId: string,
  userId: string
) {
  await assertScheduleOwner(offeringId, scheduleId, userId);

  await prisma.availability_schedules.delete({
    where: { id: scheduleId },
  });
}

// ============================================================================
// Time slots
// ============================================================================

// ============================================================================
// Community-scoped offerings
// ============================================================================

export async function listCommunityOfferings(
  communityId: string,
  filters: OfferingFilterInput
) {
  const { category, transaction_type, limit, after } = filters;

  const where: any = {
    community_id: communityId,
    deleted_at: null,
    status: "active",
  };

  if (category) where.category = category;
  if (transaction_type) where.transaction_type = transaction_type;

  if (after) {
    const cursor = decodeCursor(after);
    if (cursor) {
      where.OR = [
        { created_at: { lt: new Date(cursor.created_at) } },
        { created_at: { equals: new Date(cursor.created_at) }, id: { lt: cursor.id } },
      ];
    }
  }

  const offerings = await prisma.offerings.findMany({
    where,
    include: {
      profiles: { select: { id: true, first_name: true, last_name: true, avatar_url: true } },
    },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const shaped = offerings.map((o) => ({
    ...o,
    created_at: o.created_at?.toISOString() ?? null,
  }));

  return buildPaginatedResponse(shaped, limit);
}

export async function createCommunityOffering(
  communityId: string,
  userId: string,
  data: CreateOfferingInput
) {
  await assertCommunityMember(communityId, userId, {
    requireCanPost: true,
  });

  return prisma.offerings.create({
    data: {
      ...data,
      community_id: communityId,
      provider_id: userId,
      status: "active",
      version: 1,
    },
  });
}

// ============================================================================
// Time slots
// ============================================================================

export async function getTimeSlots(
  offeringId: string,
  scheduleId: string,
  date: string
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ValidationError("Date must be YYYY-MM-DD format");
  }

  const schedule = await prisma.availability_schedules.findFirst({
    where: { id: scheduleId, offering_id: offeringId, is_active: true },
    select: { id: true, slot_duration_minutes: true },
  });

  if (!schedule) throw new NotFoundError("Schedule");

  if (!schedule.slot_duration_minutes) {
    return {
      schedule_id: scheduleId,
      date,
      slot_duration_minutes: null,
      slots: [],
    };
  }

  const rows = await prisma.$queryRaw<
    Array<{
      slot_start_time: string;
      slot_end_time: string;
      slots_available: number;
      slots_booked: number;
      is_available: boolean;
    }>
  >`SELECT * FROM public.get_time_slots_for_date(${scheduleId}::uuid, ${date}::date)`;

  return {
    schedule_id: scheduleId,
    date,
    slot_duration_minutes: schedule.slot_duration_minutes,
    slots: rows.map((row) => ({
      start_time: formatTime(row.slot_start_time),
      end_time: formatTime(row.slot_end_time),
      slots_available: row.slots_available,
      slots_booked: row.slots_booked,
      is_available: row.is_available,
    })),
  };
}
