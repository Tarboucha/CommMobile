import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  parseZodError,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";
import {
  createOfferingSchema,
  offeringFilterSchema,
} from "@/lib/validations/offering";
import {
  applyCursorPagination,
  buildPaginatedResponse,
} from "@/lib/utils/pagination";

/**
 * GET /api/communities/[communityId]/offerings
 * List community offerings — RLS: only active community members can see
 */
export const GET = withAuth(async (user, request: NextRequest, params) => {
  const communityId = params?.communityId;
  if (!communityId) {
    return ApiErrors.badRequest("Community ID is required");
  }

  const supabase = await createClient();
  const searchParams = Object.fromEntries(
    new URL(request.url).searchParams.entries()
  );

  const validation = offeringFilterSchema.safeParse(searchParams);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const { category, limit, after } = validation.data;

  let query = supabase
    .from("offerings")
    .select("*, profiles!provider_id(id, first_name, last_name, avatar_url)")
    .eq("community_id", communityId)
    .is("deleted_at", null)
    .eq("status", "active");

  if (category) {
    query = query.eq("category", category);
  }

  query = applyCursorPagination(query, { limit, after });

  const { data: offerings, error } = await query;

  if (error) {
    console.error("Error fetching offerings:", error);
    return ApiErrors.serverError();
  }

  return successResponse(buildPaginatedResponse(offerings || [], limit));
});

/**
 * POST /api/communities/[communityId]/offerings
 * Create a new offering — requires can_post_offerings permission
 */
export const POST = withAuth(async (user, request: NextRequest, params) => {
  const communityId = params?.communityId;
  if (!communityId) {
    return ApiErrors.badRequest("Community ID is required");
  }

  const supabase = await createClient();

  // Check membership + posting permission
  const { data: membership } = await supabase
    .from("community_members")
    .select("id, can_post_offerings, membership_status")
    .eq("community_id", communityId)
    .eq("profile_id", user.id)
    .eq("membership_status", "active")
    .single();

  if (!membership) {
    return ApiErrors.forbidden("You must be an active member of this community");
  }

  if (!membership.can_post_offerings) {
    return ApiErrors.forbidden("You do not have permission to post offerings in this community");
  }

  // Parse and validate body
  let rawData: Record<string, unknown>;
  try {
    rawData = await request.json();
  } catch {
    return ApiErrors.badRequest("Invalid JSON in request body");
  }

  const validation = createOfferingSchema.safeParse(rawData);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const input = validation.data;

  // Insert offering
  const { data: offering, error: createError } = await supabase
    .from("offerings")
    .insert({
      ...input,
      community_id: communityId,
      provider_id: user.id,
      status: "active",
      version: 1,
    })
    .select("*")
    .single();

  if (createError || !offering) {
    console.error("Failed to create offering:", createError);
    return ApiErrors.serverError();
  }

  return successResponse({ offering }, undefined, 201);
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
