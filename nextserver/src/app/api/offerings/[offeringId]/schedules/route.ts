import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  parseZodError,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";
import { createScheduleSchema } from "@/lib/validations/offering";

/**
 * GET /api/offerings/[offeringId]/schedules
 * List availability schedules for an offering
 */
export const GET = withAuth(async (user, _request: NextRequest, params) => {
  const offeringId = params?.offeringId;
  if (!offeringId) {
    return ApiErrors.badRequest("Offering ID is required");
  }

  const supabase = await createClient();

  const { data: schedules, error } = await supabase
    .from("availability_schedules")
    .select("*")
    .eq("offering_id", offeringId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching schedules:", error);
    return ApiErrors.serverError();
  }

  return successResponse({ schedules: schedules || [] });
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

  const supabase = await createClient();

  // Verify offering ownership
  const { data: offering } = await supabase
    .from("offerings")
    .select("id, provider_id")
    .eq("id", offeringId)
    .is("deleted_at", null)
    .single();

  if (!offering) {
    return ApiErrors.notFound("Offering");
  }

  if (offering.provider_id !== user.id) {
    return ApiErrors.forbidden("You can only manage schedules for your own offerings");
  }

  // Parse and validate
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

  const { data: schedule, error: createError } = await supabase
    .from("availability_schedules")
    .insert({
      offering_id: offeringId,
      rrule: input.rrule,
      dtstart: input.dtstart,
      dtend: input.dtend ?? null,
      start_time: input.start_time,
      end_time: input.end_time,
      slots_available: input.slots_available,
      slot_label: input.slot_label ?? null,
      is_active: input.is_active,
    })
    .select("*")
    .single();

  if (createError || !schedule) {
    console.error("Failed to create schedule:", createError);
    return ApiErrors.serverError();
  }

  return successResponse({ schedule }, undefined, 201);
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
