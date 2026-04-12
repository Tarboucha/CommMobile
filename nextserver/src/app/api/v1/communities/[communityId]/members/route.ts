import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { memberFilterSchema } from "@/lib/validations/community";
import { decodeCursor, buildPaginatedResponse } from "@/lib/utils/pagination";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import * as communityService from "@/lib/services/community-service";

/**
 * GET /api/communities/[communityId]/members
 * List community members (simple paginated read — no service needed)
 */
export const GET = withAuth(async (_user, request: NextRequest, params) => {
  try {
    const communityId = params!.communityId;
    const searchParams = Object.fromEntries(
      new URL(request.url).searchParams.entries()
    );

    const validation = memberFilterSchema.safeParse(searchParams);
    if (!validation.success) {
      const { ValidationError } = await import("@/lib/errors/domain-errors");
      const { parseZodError } = await import("@/lib/utils/api-response");
      throw new ValidationError(parseZodError(validation.error));
    }

    const { membership_status, limit, after } = validation.data;

    const where: any = { community_id: communityId };
    where.membership_status = membership_status || "active";

    if (after) {
      const cursor = decodeCursor(after);
      if (cursor) {
        where.OR = [
          { created_at: { lt: new Date(cursor.created_at) } },
          {
            created_at: { equals: new Date(cursor.created_at) },
            id: { lt: cursor.id },
          },
        ];
      }
    }

    const members = await prisma.community_members.findMany({
      where,
      include: {
        profiles_community_members_profile_idToprofiles: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            avatar_url: true,
          },
        },
      },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    // Reshape relation name to match existing API contract
    const shaped = members.map((m) => {
      const {
        profiles_community_members_profile_idToprofiles,
        ...rest
      } = m;
      return {
        ...rest,
        profiles: profiles_community_members_profile_idToprofiles,
        created_at: rest.created_at?.toISOString() ?? null,
      };
    });

    return successResponse(buildPaginatedResponse(shaped, limit));
  } catch (err) {
    return handleServiceError(err);
  }
});

/**
 * POST /api/communities/[communityId]/members
 * Join or request to join a community
 */
export const POST = withAuth(async (user, _request: NextRequest, params) => {
  try {
    const { member, isOpen } = await communityService.joinCommunity(
      params!.communityId,
      user.id
    );
    return successResponse(
      { member },
      isOpen ? "Joined community" : "Join request submitted",
      isOpen && member ? 200 : 201
    );
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function PUT() { return handleUnsupportedMethod(["GET", "POST"]); }
export async function PATCH() { return handleUnsupportedMethod(["GET", "POST"]); }
export async function DELETE() { return handleUnsupportedMethod(["GET", "POST"]); }
