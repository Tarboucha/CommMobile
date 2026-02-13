import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  handleUnsupportedMethod,
  ApiErrors,
  parseZodError,
} from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";
import { respondInvitationSchema } from "@/lib/validations/community";
import type {
  CommunityInvitationResponse,
  CommunityMemberResponse,
} from "@/types/community";

/**
 * PATCH /api/communities/[communityId]/invitations/[invitationId]
 * Accept or decline an invitation — invitee only
 */
export const PATCH = withAuth(async (user, request: NextRequest, params) => {
  const communityId = params?.communityId;
  const invitationId = params?.invitationId;
  if (!communityId || !invitationId) {
    return ApiErrors.badRequest("Community ID and Invitation ID are required");
  }

  let rawData: Record<string, any>;
  try {
    rawData = await request.json();
  } catch {
    return ApiErrors.badRequest("Invalid JSON in request body");
  }

  const validation = respondInvitationSchema.safeParse(rawData);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const { action } = validation.data;
  const supabase = await createClient();

  // Fetch invitation
  const { data: invitation, error: fetchError } = await supabase
    .from("community_invitations")
    .select("*")
    .eq("id", invitationId)
    .eq("community_id", communityId)
    .single();

  if (fetchError || !invitation) {
    return ApiErrors.notFound("Invitation not found");
  }

  // Verify invitee identity
  const isInvitee =
    invitation.invited_profile_id === user.id ||
    (invitation.invited_email &&
      invitation.invited_email === (user as any).email);

  if (!isInvitee) {
    return ApiErrors.forbidden("This invitation is not for you");
  }

  // Check invitation is still valid
  if (invitation.invitation_status !== "pending") {
    return ApiErrors.conflict(
      `Invitation has already been ${invitation.invitation_status}`
    );
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return ApiErrors.conflict("Invitation has expired");
  }

  if (
    invitation.max_uses &&
    (invitation.current_uses || 0) >= invitation.max_uses
  ) {
    return ApiErrors.conflict("Invitation has reached its maximum uses");
  }

  if (action === "decline") {
    const { data: updated, error } = await supabase
      .from("community_invitations")
      .update({
        invitation_status: "declined",
        declined_at: new Date().toISOString(),
      })
      .eq("id", invitationId)
      .select()
      .single();

    if (error || !updated) {
      console.error("Error declining invitation:", error);
      return ApiErrors.serverError();
    }

    return successResponse<CommunityInvitationResponse>({
      invitation: updated,
    });
  }

  // Accept: check capacity
  const { data: community } = await supabase
    .from("communities")
    .select("current_members_count, max_members")
    .eq("id", communityId)
    .single();

  if (
    community?.max_members &&
    (community.current_members_count || 0) >= community.max_members
  ) {
    return ApiErrors.conflict(
      "Community has reached its maximum member capacity"
    );
  }

  // Check if user is already a member
  const { data: existingMember } = await supabase
    .from("community_members")
    .select("id, membership_status")
    .eq("community_id", communityId)
    .eq("profile_id", user.id)
    .single();

  if (existingMember?.membership_status === "active") {
    // Already a member — just mark invitation as accepted
    const { data: updated } = await supabase
      .from("community_invitations")
      .update({
        invitation_status: "accepted",
        accepted_at: new Date().toISOString(),
        current_uses: (invitation.current_uses || 0) + 1,
      })
      .eq("id", invitationId)
      .select()
      .single();

    return successResponse<CommunityInvitationResponse>({
      invitation: updated!,
    });
  }

  // Create or re-activate membership
  const memberData = {
    community_id: communityId,
    profile_id: user.id,
    join_method: "direct_invite" as const,
    membership_status: "active" as const,
    invited_by_profile_id: invitation.invited_by_profile_id,
    membership_approved_at: new Date().toISOString(),
    removal_reason: null,
    removed_by_profile_id: null,
    membership_removed_at: null,
  };

  if (
    existingMember &&
    (existingMember.membership_status === "left" ||
      existingMember.membership_status === "removed")
  ) {
    // Re-activate
    await supabase
      .from("community_members")
      .update(memberData)
      .eq("id", existingMember.id);
  } else {
    // New member
    await supabase.from("community_members").insert(memberData);
  }

  // Update invitation
  const { data: updatedInvitation } = await supabase
    .from("community_invitations")
    .update({
      invitation_status: "accepted",
      accepted_at: new Date().toISOString(),
      current_uses: (invitation.current_uses || 0) + 1,
    })
    .eq("id", invitationId)
    .select()
    .single();

  return successResponse<CommunityInvitationResponse>({
    invitation: updatedInvitation!,
  });
});

export async function GET() {
  return handleUnsupportedMethod(["PATCH"]);
}

export async function POST() {
  return handleUnsupportedMethod(["PATCH"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["PATCH"]);
}

export async function DELETE() {
  return handleUnsupportedMethod(["PATCH"]);
}
