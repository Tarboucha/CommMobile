import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { NotFoundError, ValidationError } from "@/lib/errors/domain-errors";
import { mapRpcError } from "@/lib/utils/rpc-errors";

/**
 * GET /api/invite/[token]
 * Resolve an invite link token — returns community info + membership status
 */
export const GET = withAuth(async (user, _request: NextRequest, params) => {
  const token = params?.token;
  if (!token) return handleServiceError(new ValidationError("Invite token is required"));

  try {
    const community = await prisma.communities.findFirst({
      where: { invite_link_token: token, is_active: true },
      select: {
        id: true, community_name: true, community_description: true,
        current_members_count: true, max_members: true, access_type: true,
        invite_link_expires_at: true,
      },
    });

    if (!community) throw new NotFoundError("Invite link");

    if (community.invite_link_expires_at && new Date(community.invite_link_expires_at) < new Date()) {
      throw new ValidationError("This invite link has expired");
    }

    const membership = await prisma.community_members.findFirst({
      where: { community_id: community.id, profile_id: user.id, membership_status: "active" },
      select: { id: true },
    });

    const { invite_link_expires_at, ...communityData } = community;

    return successResponse({
      community: communityData,
      is_already_member: !!membership,
    });
  } catch (err) {
    return handleServiceError(err);
  }
});

/**
 * POST /api/invite/[token]
 * Accept an invite link — join the community via SECURITY DEFINER RPC
 */
export const POST = withAuth(async (user, _request: NextRequest, params) => {
  const token = params?.token;
  if (!token) return handleServiceError(new ValidationError("Invite token is required"));

  try {
    let result: [{ join_community_via_invite_link: Record<string, unknown> }];
    try {
      result = await prisma.$queryRaw<[{ join_community_via_invite_link: Record<string, unknown> }]>`
        SELECT public.join_community_via_invite_link(${token}::text, ${user.id}::uuid) AS join_community_via_invite_link
      `;
    } catch (err) {
      mapRpcError(err);
    }

    const data = result[0].join_community_via_invite_link as {
      success?: boolean;
      already_member?: boolean;
      member_id?: string;
      error?: string;
    };

    if (data.error) {
      throw new ValidationError(data.error);
    }

    return successResponse(
      { member: { id: data.member_id }, already_member: data.already_member ?? false },
      undefined,
      data.already_member ? 200 : 201
    );
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function PUT() { return handleUnsupportedMethod(["GET", "POST"]); }
export async function PATCH() { return handleUnsupportedMethod(["GET", "POST"]); }
export async function DELETE() { return handleUnsupportedMethod(["GET", "POST"]); }
