import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  parseZodError,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";
import { updateOfferingSchema } from "@/lib/validations/offering";

/**
 * GET /api/offerings/[offeringId]
 * Get offering detail with schedules
 */
export const GET = withAuth(async (user, _request: NextRequest, params) => {
  const offeringId = params?.offeringId;
  if (!offeringId) {
    return ApiErrors.badRequest("Offering ID is required");
  }

  const supabase = await createClient();

  const { data: offering, error } = await supabase
    .from("offerings")
    .select(
      "*, profiles!provider_id(id, first_name, last_name, avatar_url), availability_schedules(*)"
    )
    .eq("id", offeringId)
    .is("deleted_at", null)
    .single();

  if (error || !offering) {
    return ApiErrors.notFound("Offering");
  }

  return successResponse({ offering });
});

/**
 * PATCH /api/offerings/[offeringId]
 * Update offering — provider only
 */
export const PATCH = withAuth(async (user, request: NextRequest, params) => {
  const offeringId = params?.offeringId;
  if (!offeringId) {
    return ApiErrors.badRequest("Offering ID is required");
  }

  const supabase = await createClient();

  // Verify ownership
  const { data: existing } = await supabase
    .from("offerings")
    .select("id, provider_id")
    .eq("id", offeringId)
    .is("deleted_at", null)
    .single();

  if (!existing) {
    return ApiErrors.notFound("Offering");
  }

  if (existing.provider_id !== user.id) {
    return ApiErrors.forbidden("You can only edit your own offerings");
  }

  // Parse and validate
  let rawData: Record<string, unknown>;
  try {
    rawData = await request.json();
  } catch {
    return ApiErrors.badRequest("Invalid JSON in request body");
  }

  const validation = updateOfferingSchema.safeParse(rawData);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const { data: offering, error: updateError } = await supabase
    .from("offerings")
    .update({
      ...validation.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", offeringId)
    .select("*")
    .single();

  if (updateError || !offering) {
    console.error("Failed to update offering:", updateError);
    return ApiErrors.serverError();
  }

  return successResponse({ offering });
});

/**
 * DELETE /api/offerings/[offeringId]
 * Soft delete offering — provider only
 */
export const DELETE = withAuth(async (user, _request: NextRequest, params) => {
  const offeringId = params?.offeringId;
  if (!offeringId) {
    return ApiErrors.badRequest("Offering ID is required");
  }

  const supabase = await createClient();

  // Verify ownership
  const { data: existing } = await supabase
    .from("offerings")
    .select("id, provider_id")
    .eq("id", offeringId)
    .is("deleted_at", null)
    .single();

  if (!existing) {
    return ApiErrors.notFound("Offering");
  }

  if (existing.provider_id !== user.id) {
    return ApiErrors.forbidden("You can only delete your own offerings");
  }

  const { error } = await supabase
    .from("offerings")
    .update({
      deleted_at: new Date().toISOString(),
      status: "inactive",
    })
    .eq("id", offeringId);

  if (error) {
    console.error("Failed to delete offering:", error);
    return ApiErrors.serverError();
  }

  return successResponse({ deleted: true });
});

export async function POST() {
  return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]);
}
