import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  handleUnsupportedMethod,
  ApiErrors,
  parseZodError,
} from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { createInvitationSchema } from "@/lib/validations/community";
import { decodeCursor, buildPaginatedResponse } from "@/lib/utils/pagination";
import { paginationSchema } from "@/lib/validations/pagination";
import type { CommunityInvitationResponse } from "@/types/community";

/**
 * GET /api/communities/[communityId]/invitations
 * List invitations
 */
export const GET = withAuth(async (user, request: NextRequest, params) => {
  const communityId = params?.communityId;
  if (!communityId) {
    return ApiErrors.badRequest("Community ID is required");
  }

  const searchParams = Object.fromEntries(
    new URL(request.url).searchParams.entries()
  );

  const validation = paginationSchema.safeParse(searchParams);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const { limit, after } = validation.data;

  try {
    const where: any = { community_id: communityId };

    if (after) {
      const cursor = decodeCursor(after);
      if (cursor) {
        where.OR = [
          { created_at: { lt: new Date(cursor.created_at) } },
          { created_at: { equals: new Date(cursor.created_at) }, id: { lt: cursor.id } },
        ];
      }
    }

    const invitations = await prisma.community_invitations.findMany({
      where,
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const shaped = invitations.map((i) => ({
      ...i,
      created_at: i.created_at?.toISOString() ?? null,
    }));

    return successResponse(buildPaginatedResponse(shaped as any, limit));
  } catch (error) {
    console.error("Error fetching invitations:", error);
    return ApiErrors.serverError();
  }
});

/**
 * POST /api/communities/[communityId]/invitations
 * Create an invitation — requires invite permission
 */
export const POST = withAuth(async (user, request: NextRequest, params) => {
  const communityId = params?.communityId;
  if (!communityId) {
    return ApiErrors.badRequest("Community ID is required");
  }

  const membership = await prisma.community_members.findFirst({
    where: {
      community_id: communityId,
      profile_id: user.id,
      membership_status: "active",
    },
    select: { member_role: true, can_invite_members: true },
  });

  if (!membership) {
    return ApiErrors.forbidden("You are not a member of this community");
  }

  const hasPermission =
    membership.can_invite_members ||
    ["owner", "admin", "moderator"].includes(membership.member_role || "");

  if (!hasPermission) {
    return ApiErrors.forbidden("You don't have permission to invite members");
  }

  let rawData: Record<string, any>;
  try {
    rawData = await request.json();
  } catch {
    return ApiErrors.badRequest("Invalid JSON in request body");
  }

  const validation = createInvitationSchema.safeParse(rawData);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const input = validation.data;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + input.expires_in_days);

  try {
    const invitation = await prisma.community_invitations.create({
      data: {
        community_id: communityId,
        invited_by_profile_id: user.id,
        invited_profile_id: input.invited_profile_id ?? null,
        invited_email: input.invited_email ?? null,
        invitation_message: input.invitation_message ?? null,
        invitation_token: randomUUID(),
        max_uses: input.max_uses,
        expires_at: expiresAt,
      },
    });

    // Resolve invited_profile_id from email if not provided directly
    let invitedProfileId = invitation.invited_profile_id;

    if (!invitedProfileId && invitation.invited_email) {
      const profile = await prisma.profiles.findFirst({
        where: { email: invitation.invited_email },
        select: { id: true },
      });

      if (profile) {
        invitedProfileId = profile.id;
        await prisma.community_invitations.update({
          where: { id: invitation.id },
          data: { invited_profile_id: profile.id },
        });
      }
    }

    // Send notification to the invitee if we have their profile ID
    if (invitedProfileId) {
      const community = await prisma.communities.findUnique({
        where: { id: communityId },
        select: { community_name: true },
      });

      const communityName = community?.community_name || "a community";

      await prisma.notifications.create({
        data: {
          profile_id: invitedProfileId,
          notification_type: "community_invite",
          title: "Community Invitation",
          body: `You've been invited to join "${communityName}"`,
          related_community_id: communityId,
          data_json: {
            invitation_id: invitation.id,
            community_id: communityId,
            invited_by_profile_id: user.id,
          },
        },
      });
    }

    return successResponse<CommunityInvitationResponse>(
      { invitation: invitation as any },
      undefined,
      201
    );
  } catch (error) {
    console.error("Error creating invitation:", error);
    return ApiErrors.serverError();
  }
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
