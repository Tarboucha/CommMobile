import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  parseZodError,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { updateScheduleSchema } from "@/lib/validations/offering";

async function verifyScheduleOwnership(
  offeringId: string,
  scheduleId: string,
  userId: string
) {
  const offering = await prisma.offerings.findFirst({
    where: { id: offeringId, deleted_at: null },
    select: { id: true, provider_id: true },
  });

  if (!offering) return { error: "offering_not_found" as const };
  if (offering.provider_id !== userId) return { error: "forbidden" as const };

  const schedule = await prisma.availability_schedules.findFirst({
    where: { id: scheduleId, offering_id: offeringId },
  });

  if (!schedule) return { error: "schedule_not_found" as const };

  return { schedule };
}

/**
 * PATCH /api/offerings/[offeringId]/schedules/[scheduleId]
 * Update a schedule — offering provider only
 */
export const PATCH = withAuth(async (user, request: NextRequest, params) => {
  const offeringId = params?.offeringId;
  const scheduleId = params?.scheduleId;
  if (!offeringId || !scheduleId) {
    return ApiErrors.badRequest("Offering ID and Schedule ID are required");
  }

  const ownership = await verifyScheduleOwnership(offeringId, scheduleId, user.id);
  if ("error" in ownership) {
    if (ownership.error === "offering_not_found") return ApiErrors.notFound("Offering");
    if (ownership.error === "schedule_not_found") return ApiErrors.notFound("Schedule");
    return ApiErrors.forbidden("You can only manage your own offering schedules");
  }

  let rawData: Record<string, unknown>;
  try {
    rawData = await request.json();
  } catch {
    return ApiErrors.badRequest("Invalid JSON in request body");
  }

  const validation = updateScheduleSchema.safeParse(rawData);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  try {
    const input = validation.data;
    const data: any = { updated_at: new Date() };

    // Convert string date/time fields to Date objects for Prisma @db.Date / @db.Time
    if (input.rrule !== undefined) data.rrule = input.rrule;
    if (input.dtstart !== undefined) {
      data.dtstart = new Date(`${input.dtstart}T00:00:00Z`);
    }
    if (input.dtend !== undefined) {
      data.dtend = input.dtend ? new Date(`${input.dtend}T00:00:00Z`) : null;
    }
    if (input.start_time !== undefined) {
      data.start_time = new Date(`1970-01-01T${input.start_time}:00Z`);
    }
    if (input.end_time !== undefined) {
      data.end_time = new Date(`1970-01-01T${input.end_time}:00Z`);
    }
    if (input.slots_available !== undefined) data.slots_available = input.slots_available;
    if (input.slot_label !== undefined) data.slot_label = input.slot_label;
    if (input.is_active !== undefined) data.is_active = input.is_active;
    if (input.loan_duration_days !== undefined) data.loan_duration_days = input.loan_duration_days;
    if (input.loan_max_duration_days !== undefined) {
      data.loan_max_duration_days = input.loan_max_duration_days;
    }
    if (input.slot_duration_minutes !== undefined) {
      data.slot_duration_minutes = input.slot_duration_minutes;
    }

    const schedule = await prisma.availability_schedules.update({
      where: { id: scheduleId },
      data,
    });

    return successResponse({ schedule: schedule as any });
  } catch (error) {
    console.error("Failed to update schedule:", error);
    return ApiErrors.serverError();
  }
});

/**
 * DELETE /api/offerings/[offeringId]/schedules/[scheduleId]
 * Delete a schedule — offering provider only
 */
export const DELETE = withAuth(async (user, _request: NextRequest, params) => {
  const offeringId = params?.offeringId;
  const scheduleId = params?.scheduleId;
  if (!offeringId || !scheduleId) {
    return ApiErrors.badRequest("Offering ID and Schedule ID are required");
  }

  const ownership = await verifyScheduleOwnership(offeringId, scheduleId, user.id);
  if ("error" in ownership) {
    if (ownership.error === "offering_not_found") return ApiErrors.notFound("Offering");
    if (ownership.error === "schedule_not_found") return ApiErrors.notFound("Schedule");
    return ApiErrors.forbidden("You can only manage your own offering schedules");
  }

  try {
    await prisma.availability_schedules.delete({
      where: { id: scheduleId },
    });

    return successResponse({ deleted: true });
  } catch (error) {
    console.error("Failed to delete schedule:", error);
    return ApiErrors.serverError();
  }
});

export async function GET() {
  return handleUnsupportedMethod(["PATCH", "DELETE"]);
}

export async function POST() {
  return handleUnsupportedMethod(["PATCH", "DELETE"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["PATCH", "DELETE"]);
}
