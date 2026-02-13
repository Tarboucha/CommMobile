import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  handleUnsupportedMethod,
  ApiErrors,
  parseZodError,
} from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";
import { updateCommunitySchema } from "@/lib/validations/community";
import type { CommunityResponse } from "@/types/community";

/**
 * GET /api/communities/[communityId]
 * Get a single community — RLS handles visibility
 */
export const GET = withAuth(async (user, _request, params) => {
  const communityId = params?.communityId;
  if (!communityId) {
    return ApiErrors.badRequest("Community ID is required");
  }

  const supabase = await createClient();

  const { data: community, error } = await supabase
    .from("communities")
    .select("*")
    .eq("id", communityId)
    .is("deleted_at", null)
    .single();

  if (error || !community) {
    return ApiErrors.notFound("Community not found");
  }

  return successResponse<CommunityResponse>({ community });
});

/**
 * PATCH /api/communities/[communityId]
 * Update community — admin/owner only
 */
export const PATCH = withAuth(async (user, request: NextRequest, params) => {
  const communityId = params?.communityId;
  if (!communityId) {
    return ApiErrors.badRequest("Community ID is required");
  }

  const supabase = await createClient();

  // Check user is admin/owner
  const { data: membership } = await supabase
    .from("community_members")
    .select("member_role")
    .eq("community_id", communityId)
    .eq("profile_id", user.id)
    .eq("membership_status", "active")
    .in("member_role", ["owner", "admin"])
    .single();

  if (!membership) {
    return ApiErrors.forbidden("Only owners and admins can update the community");
  }

  let rawData: Record<string, any>;
  try {
    rawData = await request.json();
  } catch {
    return ApiErrors.badRequest("Invalid JSON in request body");
  }

  const validation = updateCommunitySchema.safeParse(rawData);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const { data: updated, error } = await supabase
    .from("communities")
    .update(validation.data)
    .eq("id", communityId)
    .is("deleted_at", null)
    .select()
    .single();

  if (error || !updated) {
    console.error("Error updating community:", error);
    return ApiErrors.serverError();
  }

  return successResponse<CommunityResponse>({ community: updated });
});

/**
 * DELETE /api/communities/[communityId]
 * Soft delete — owner only
 */
export const DELETE = withAuth(async (user, _request, params) => {
  const communityId = params?.communityId;
  if (!communityId) {
    return ApiErrors.badRequest("Community ID is required");
  }

  const supabase = await createClient();

  // Only owner can delete
  const { data: membership } = await supabase
    .from("community_members")
    .select("member_role")
    .eq("community_id", communityId)
    .eq("profile_id", user.id)
    .eq("membership_status", "active")
    .eq("member_role", "owner")
    .single();

  if (!membership) {
    return ApiErrors.forbidden("Only the owner can delete the community");
  }

  const { error } = await supabase
    .from("communities")
    .update({
      deleted_at: new Date().toISOString(),
      is_active: false,
    })
    .eq("id", communityId);

  if (error) {
    console.error("Error deleting community:", error);
    return ApiErrors.serverError();
  }

  return successResponse({ message: "Community deleted" });
});

export async function POST() {
  return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]);
}
