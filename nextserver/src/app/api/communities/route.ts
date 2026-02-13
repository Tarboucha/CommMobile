import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  handleUnsupportedMethod,
  ApiErrors,
  parseZodError,
} from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";
import {
  createCommunitySchema,
  communityFilterSchema,
} from "@/lib/validations/community";
import {
  applyCursorPagination,
  buildPaginatedResponse,
} from "@/lib/utils/pagination";
import type { CommunityResponse } from "@/types/community";

/**
 * GET /api/communities
 * List the authenticated user's communities
 */
export const GET = withAuth(async (user, request: NextRequest) => {
  const supabase = await createClient();
  const searchParams = Object.fromEntries(
    new URL(request.url).searchParams.entries()
  );

  const validation = communityFilterSchema.safeParse(searchParams);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const { limit, after } = validation.data;

  // Get community IDs where user is an active member
  const { data: memberships, error: memberError } = await supabase
    .from("community_members")
    .select("community_id")
    .eq("profile_id", user.id)
    .eq("membership_status", "active");

  if (memberError) {
    console.error("Error fetching memberships:", memberError);
    return ApiErrors.serverError();
  }

  const communityIds = memberships?.map((m) => m.community_id) || [];

  if (communityIds.length === 0) {
    return successResponse(buildPaginatedResponse([], limit));
  }

  let query = supabase
    .from("communities")
    .select("*")
    .in("id", communityIds)
    .eq("is_active", true)
    .is("deleted_at", null);

  query = applyCursorPagination(query, { limit, after });

  const { data: communities, error } = await query;

  if (error) {
    console.error("Error fetching communities:", error);
    return ApiErrors.serverError();
  }

  return successResponse(buildPaginatedResponse(communities || [], limit));
});

/**
 * POST /api/communities
 * Create a new community — creator is auto-added as owner via DB trigger
 */
export const POST = withAuth(async (user, request: NextRequest) => {
  let rawData: Record<string, any>;
  try {
    rawData = await request.json();
  } catch {
    return ApiErrors.badRequest("Invalid JSON in request body");
  }

  const validation = createCommunitySchema.safeParse(rawData);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const supabase = await createClient();

  const { data: community, error } = await supabase
    .from("communities")
    .insert({
      ...validation.data,
      created_by_profile_id: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating community:", error);
    return ApiErrors.serverError();
  }

  return successResponse<CommunityResponse>({ community }, undefined, 201);
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
