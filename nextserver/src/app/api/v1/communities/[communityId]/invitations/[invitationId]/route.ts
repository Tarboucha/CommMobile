import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  handleUnsupportedMethod,
  ApiErrors,
  parseZodError,
} from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { respondInvitationSchema } from "@/lib/validations/community";
import type { CommunityInvitationResponse } from "@/types/community";

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

  const invitation = await prisma.community_invitations.findFirst({
    where: { id: invitationId, community_id: communityId },
  });

  if (!invitation) {
    return ApiErrors.notFound("Invitation not found");
  }

  const isInvitee =
    invitation.invited_profile_id === user.id ||
    (invitation.invited_email &&
      invitation.invited_email === (user).email);

  if (!isInvitee) {
    return ApiErrors.forbidden("This invitation is not for you");
  }

  if (invitation.invitation_status !== "pending") {
    return ApiErrors.conflict(
      `Invitation has already been ${invitation.invitation_status}`
    );
  }

  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    return ApiErrors.conflict("Invitation has expired");
  }

  if (
    invitation.max_uses &&
    (invitation.current_uses || 0) >= invitation.max_uses
  ) {
    return ApiErrors.conflict("Invitation has reached its maximum uses");
  }

  try {
    if (action === "decline") {
      const updated = await prisma.community_invitations.update({
        where: { id: invitationId },
        data: {
          invitation_status: "declined",
          declined_at: new Date(),
        },
      });

      return successResponse({
        invitation: updated,
      });
    }

    // Accept: check capacity
    const community = await prisma.communities.findUnique({
      where: { id: communityId },
      select: { current_members_count: true, max_members: true },
    });

    if (
      community?.max_members &&
      (community.current_members_count || 0) >= community.max_members
    ) {
      return ApiErrors.conflict(
        "Community has reached its maximum member capacity"
      );
    }

    const existingMember = await prisma.community_members.findFirst({
      where: { community_id: communityId, profile_id: user.id },
      select: { id: true, membership_status: true },
    });

    if (existingMember?.membership_status === "active") {
      const updated = await prisma.community_invitations.update({
        where: { id: invitationId },
        data: {
          invitation_status: "accepted",
          accepted_at: new Date(),
          current_uses: (invitation.current_uses || 0) + 1,
        },
      });

      return successResponse({
        invitation: updated,
      });
    }

    const memberData = {
      community_id: communityId,
      profile_id: user.id,
      join_method: "direct_invite" as const,
      membership_status: "active" as const,
      invited_by_profile_id: invitation.invited_by_profile_id,
      membership_approved_at: new Date(),
      removal_reason: null,
      removed_by_profile_id: null,
      membership_removed_at: null,
    };

    if (
      existingMember &&
      (existingMember.membership_status === "left" ||
        existingMember.membership_status === "removed")
    ) {
      await prisma.community_members.update({
        where: { id: existingMember.id },
        data: memberData,
      });
    } else {
      await prisma.community_members.create({
        data: memberData,
      });
    }

    const updatedInvitation = await prisma.community_invitations.update({
      where: { id: invitationId },
      data: {
        invitation_status: "accepted",
        accepted_at: new Date(),
        current_uses: (invitation.current_uses || 0) + 1,
      },
    });

    return successResponse({
      invitation: updatedInvitation,
    });
  } catch (error) {
    console.error("Error responding to invitation:", error);
    return ApiErrors.serverError();
  }
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
