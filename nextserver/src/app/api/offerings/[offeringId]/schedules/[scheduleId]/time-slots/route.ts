import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/offerings/[offeringId]/schedules/[scheduleId]/time-slots?date=YYYY-MM-DD
 *
 * Returns computed time slots for a time-slotted schedule on a given date.
 * Only returns results when the schedule has slot_duration_minutes set.
 * Respects exception overrides for time window, capacity, and duration.
 */
export const GET = withAuth(async (_user, request: NextRequest, params) => {
  const offeringId = params?.offeringId;
  const scheduleId = params?.scheduleId;

  if (!offeringId || !scheduleId) {
    return ApiErrors.badRequest("Offering ID and Schedule ID are required");
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return ApiErrors.badRequest("Query parameter 'date' is required (YYYY-MM-DD)");
  }

  // Verify schedule belongs to offering
  const schedule = await prisma.availability_schedules.findFirst({
    where: { id: scheduleId, offering_id: offeringId, is_active: true },
    select: { id: true, slot_duration_minutes: true },
  });

  if (!schedule) {
    return ApiErrors.notFound("Schedule");
  }

  if (!schedule.slot_duration_minutes) {
    return successResponse({
      schedule_id: scheduleId,
      date,
      slot_duration_minutes: null,
      slots: [],
    });
  }

  try {
    const rows = await prisma.$queryRaw<
      Array<{
        slot_start_time: string;
        slot_end_time: string;
        slots_available: number;
        slots_booked: number;
        is_available: boolean;
      }>
    >`SELECT * FROM public.get_time_slots_for_date(${scheduleId}::uuid, ${date}::date)`;

    // Format TIME values to HH:MM strings
    const slots = rows.map((row) => ({
      start_time: formatTime(row.slot_start_time),
      end_time: formatTime(row.slot_end_time),
      slots_available: row.slots_available,
      slots_booked: row.slots_booked,
      is_available: row.is_available,
    }));

    return successResponse({
      schedule_id: scheduleId,
      date,
      slot_duration_minutes: schedule.slot_duration_minutes,
      slots,
    });
  } catch (error) {
    console.error("Error fetching time slots:", error);
    return ApiErrors.serverError("Failed to compute time slots");
  }
});

function formatTime(value: unknown): string {
  if (typeof value === "string") {
    // Could be "09:00:00" or already "09:00" or a Date ISO string
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
      return value.slice(0, 5);
    }
    // ISO date string from Prisma
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
    }
  }
  if (value instanceof Date) {
    return `${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}`;
  }
  return String(value).slice(0, 5);
}

export async function POST() {
  return handleUnsupportedMethod(["GET"]);
}
