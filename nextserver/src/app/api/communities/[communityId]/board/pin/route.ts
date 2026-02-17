import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  parseZodError,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";
import { pinItemSchema } from "@/lib/validations/post";

/**
 * POST /api/communities/[communityId]/board/pin
 * Pin an item (offering or post) to the top of the board.
 * Replaces any existing pin for this community.
 */
export const POST = withAuth(async (user, request: NextRequest, params) => {
  const communityId = params?.communityId;
  if (!communityId) {
    return ApiErrors.badRequest("Community ID is required");
  }

  const supabase = await createClient();

  // Check admin/owner role
  const { data: membership } = await supabase
    .from("community_members")
    .select("id, member_role, membership_status")
    .eq("community_id", communityId)
    .eq("profile_id", user.id)
    .eq("membership_status", "active")
    .single();

  if (!membership) {
    return ApiErrors.forbidden("You must be an active member of this community");
  }

  if (!["owner", "admin"].includes(membership.member_role ?? "")) {
    return ApiErrors.notCommunityAdmin();
  }

  // Parse body
  let rawData: Record<string, unknown>;
  try {
    rawData = await request.json();
  } catch {
    return ApiErrors.badRequest("Invalid JSON in request body");
  }

  const validation = pinItemSchema.safeParse(rawData);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const { item_type, item_id } = validation.data;

  // Verify the item exists and belongs to this community
  if (item_type === "offering") {
    const { data: offering } = await supabase
      .from("offerings")
      .select("id")
      .eq("id", item_id)
      .eq("community_id", communityId)
      .is("deleted_at", null)
      .eq("status", "active")
      .single();

    if (!offering) {
      return ApiErrors.notFound("Offering");
    }
  } else {
    const { data: post } = await supabase
      .from("community_posts")
      .select("id")
      .eq("id", item_id)
      .eq("community_id", communityId)
      .is("deleted_at", null)
      .eq("status", "active")
      .single();

    if (!post) {
      return ApiErrors.notFound("Post");
    }
  }

  // Delete existing pin (UNIQUE constraint enforces one per community)
  await supabase
    .from("community_pinned_items")
    .delete()
    .eq("community_id", communityId);

  // Insert new pin
  const insertData = {
    community_id: communityId as string,
    pinned_by_profile_id: user.id,
    pinned_offering_id: item_type === "offering" ? item_id : null,
    pinned_post_id: item_type === "post" ? item_id : null,
  };

  const { error: insertError } = await supabase
    .from("community_pinned_items")
    .insert(insertData);

  if (insertError) {
    console.error("Failed to pin item:", insertError);
    return ApiErrors.serverError();
  }

  return successResponse({ pinned: true }, undefined, 201);
});

/**
 * DELETE /api/communities/[communityId]/board/pin
 * Remove the pinned item from the board.
 */
export const DELETE = withAuth(async (user, _request: NextRequest, params) => {
  const communityId = params?.communityId;
  if (!communityId) {
    return ApiErrors.badRequest("Community ID is required");
  }

  const supabase = await createClient();

  // Check admin/owner role
  const { data: membership } = await supabase
    .from("community_members")
    .select("id, member_role, membership_status")
    .eq("community_id", communityId)
    .eq("profile_id", user.id)
    .eq("membership_status", "active")
    .single();

  if (!membership) {
    return ApiErrors.forbidden("You must be an active member of this community");
  }

  if (!["owner", "admin"].includes(membership.member_role ?? "")) {
    return ApiErrors.notCommunityAdmin();
  }

  const { error } = await supabase
    .from("community_pinned_items")
    .delete()
    .eq("community_id", communityId);

  if (error) {
    console.error("Failed to unpin item:", error);
    return ApiErrors.serverError();
  }

  return successResponse({ unpinned: true });
});

export async function GET() {
  return handleUnsupportedMethod(["POST", "DELETE"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["POST", "DELETE"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["POST", "DELETE"]);
}
