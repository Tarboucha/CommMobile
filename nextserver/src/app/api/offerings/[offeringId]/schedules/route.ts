import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  parseZodError,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { createScheduleSchema } from "@/lib/validations/offering";

/**
 * GET /api/offerings/[offeringId]/schedules
 * List availability schedules for an offering
 */
export const GET = withAuth(async (_user, _request: NextRequest, params) => {
  const offeringId = params?.offeringId;
  if (!offeringId) {
    return ApiErrors.badRequest("Offering ID is required");
  }

  try {
    const schedules = await prisma.availability_schedules.findMany({
      where: { offering_id: offeringId },
      orderBy: { created_at: "desc" },
    });

    return successResponse({ schedules: schedules as any });
  } catch (error) {
    console.error("Error fetching schedules:", error);
    return ApiErrors.serverError();
  }
});

/**
 * POST /api/offerings/[offeringId]/schedules
 * Create an availability schedule — offering provider only
 */
export const POST = withAuth(async (user, request: NextRequest, params) => {
  const offeringId = params?.offeringId;
  if (!offeringId) {
    return ApiErrors.badRequest("Offering ID is required");
  }

  const offering = await prisma.offerings.findFirst({
    where: { id: offeringId, deleted_at: null },
    select: { id: true, provider_id: true },
  });

  if (!offering) {
    return ApiErrors.notFound("Offering");
  }

  if (offering.provider_id !== user.id) {
    return ApiErrors.forbidden("You can only manage schedules for your own offerings");
  }

  let rawData: Record<string, unknown>;
  try {
    rawData = await request.json();
  } catch {
    return ApiErrors.badRequest("Invalid JSON in request body");
  }

  const validation = createScheduleSchema.safeParse(rawData);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const input = validation.data;

  try {
    const schedule = await prisma.availability_schedules.create({
      data: {
        offering_id: offeringId,
        rrule: input.rrule,
        // Prisma expects Date objects for @db.Date / @db.Time columns,
        // not plain YYYY-MM-DD / HH:MM strings from the API
        dtstart: new Date(`${input.dtstart}T00:00:00Z`),
        dtend: input.dtend ? new Date(`${input.dtend}T00:00:00Z`) : null,
        start_time: new Date(`1970-01-01T${input.start_time}:00Z`),
        end_time: new Date(`1970-01-01T${input.end_time}:00Z`),
        slots_available: input.slots_available,
        slot_label: input.slot_label ?? null,
        is_active: input.is_active,
        // Loan fields (only relevant for loan offerings)
        ...(input.loan_duration_days !== undefined && {
          loan_duration_days: input.loan_duration_days,
        }),
        ...(input.loan_max_duration_days !== undefined && {
          loan_max_duration_days: input.loan_max_duration_days,
        }),
        ...(input.slot_duration_minutes !== undefined && {
          slot_duration_minutes: input.slot_duration_minutes,
        }),
      },
    });

    return successResponse({ schedule: schedule as any }, undefined, 201);
  } catch (error) {
    console.error("Failed to create schedule:", error);
    return ApiErrors.serverError();
  }
});

export async function PUT() {
  return handleUnsupportedMethod(["GET", "POST"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["GET", "POST"]);
}

export async function DELETE() {
  return handleUnsupportedMethod(["GET", "POST"]);
}
