import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  parseZodError,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";
import { updateScheduleSchema } from "@/lib/validations/offering";

/**
 * Verify that the authenticated user owns the offering for this schedule
 */
async function verifyScheduleOwnership(
  supabase: any,
  offeringId: string,
  scheduleId: string,
  userId: string
) {
  const { data: offering } = await supabase
    .from("offerings")
    .select("id, provider_id")
    .eq("id", offeringId)
    .is("deleted_at", null)
    .single();

  if (!offering) return { error: "offering_not_found" as const };
  if (offering.provider_id !== userId) return { error: "forbidden" as const };

  const { data: schedule } = await supabase
    .from("availability_schedules")
    .select("*")
    .eq("id", scheduleId)
    .eq("offering_id", offeringId)
    .single();

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

  const supabase = await createClient();

  const ownership = await verifyScheduleOwnership(supabase, offeringId, scheduleId, user.id);
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

  const { data: schedule, error: updateError } = await supabase
    .from("availability_schedules")
    .update({
      ...validation.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", scheduleId)
    .select("*")
    .single();

  if (updateError || !schedule) {
    console.error("Failed to update schedule:", updateError);
    return ApiErrors.serverError();
  }

  return successResponse({ schedule });
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

  const supabase = await createClient();

  const ownership = await verifyScheduleOwnership(supabase, offeringId, scheduleId, user.id);
  if ("error" in ownership) {
    if (ownership.error === "offering_not_found") return ApiErrors.notFound("Offering");
    if (ownership.error === "schedule_not_found") return ApiErrors.notFound("Schedule");
    return ApiErrors.forbidden("You can only manage your own offering schedules");
  }

  const { error } = await supabase
    .from("availability_schedules")
    .delete()
    .eq("id", scheduleId);

  if (error) {
    console.error("Failed to delete schedule:", error);
    return ApiErrors.serverError();
  }

  return successResponse({ deleted: true });
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
