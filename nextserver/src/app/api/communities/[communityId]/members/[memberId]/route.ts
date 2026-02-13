import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  handleUnsupportedMethod,
  ApiErrors,
  parseZodError,
} from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";
import { updateMemberSchema } from "@/lib/validations/community";
import type { CommunityMemberResponse } from "@/types/community";

/**
 * PATCH /api/communities/[communityId]/members/[memberId]
 * Update member role/permissions/status — admin/owner only
 */
export const PATCH = withAuth(async (user, request: NextRequest, params) => {
  const communityId = params?.communityId;
  const memberId = params?.memberId;
  if (!communityId || !memberId) {
    return ApiErrors.badRequest("Community ID and Member ID are required");
  }

  const supabase = await createClient();

  // Check requester is admin/owner
  const { data: requesterMembership } = await supabase
    .from("community_members")
    .select("member_role")
    .eq("community_id", communityId)
    .eq("profile_id", user.id)
    .eq("membership_status", "active")
    .in("member_role", ["owner", "admin"])
    .single();

  if (!requesterMembership) {
    return ApiErrors.forbidden("Only admins can manage members");
  }

  // Fetch target member
  const { data: targetMember, error: fetchError } = await supabase
    .from("community_members")
    .select("*")
    .eq("id", memberId)
    .eq("community_id", communityId)
    .single();

  if (fetchError || !targetMember) {
    return ApiErrors.notFound("Member not found");
  }

  // Can't modify the owner
  if (targetMember.member_role === "owner") {
    return ApiErrors.forbidden("Cannot modify the community owner");
  }

  let rawData: Record<string, any>;
  try {
    rawData = await request.json();
  } catch {
    return ApiErrors.badRequest("Invalid JSON in request body");
  }

  const validation = updateMemberSchema.safeParse(rawData);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const updateData: Record<string, any> = { ...validation.data };

  // If approving a pending member
  if (updateData.membership_status === "active" && targetMember.membership_status === "pending") {
    updateData.membership_approved_at = new Date().toISOString();
    updateData.approved_by_profile_id = user.id;
  }

  // If removing a member
  if (updateData.membership_status === "removed") {
    updateData.membership_removed_at = new Date().toISOString();
    updateData.removed_by_profile_id = user.id;
  }

  const { data: updated, error } = await supabase
    .from("community_members")
    .update(updateData)
    .eq("id", memberId)
    .select()
    .single();

  if (error || !updated) {
    console.error("Error updating member:", error);
    return ApiErrors.serverError();
  }

  return successResponse<CommunityMemberResponse>({ member: updated });
});

/**
 * DELETE /api/communities/[communityId]/members/[memberId]
 * Remove a member — admin/owner only
 */
export const DELETE = withAuth(async (user, _request, params) => {
  const communityId = params?.communityId;
  const memberId = params?.memberId;
  if (!communityId || !memberId) {
    return ApiErrors.badRequest("Community ID and Member ID are required");
  }

  const supabase = await createClient();

  // Check requester is admin/owner
  const { data: requesterMembership } = await supabase
    .from("community_members")
    .select("member_role")
    .eq("community_id", communityId)
    .eq("profile_id", user.id)
    .eq("membership_status", "active")
    .in("member_role", ["owner", "admin"])
    .single();

  if (!requesterMembership) {
    return ApiErrors.forbidden("Only admins can remove members");
  }

  // Fetch target member
  const { data: targetMember } = await supabase
    .from("community_members")
    .select("member_role")
    .eq("id", memberId)
    .eq("community_id", communityId)
    .single();

  if (!targetMember) {
    return ApiErrors.notFound("Member not found");
  }

  if (targetMember.member_role === "owner") {
    return ApiErrors.forbidden("Cannot remove the community owner");
  }

  const { error } = await supabase
    .from("community_members")
    .update({
      membership_status: "removed",
      membership_removed_at: new Date().toISOString(),
      removed_by_profile_id: user.id,
    })
    .eq("id", memberId);

  if (error) {
    console.error("Error removing member:", error);
    return ApiErrors.serverError();
  }

  return successResponse({ message: "Member removed" });
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
