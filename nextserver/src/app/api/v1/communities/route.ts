import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  handleUnsupportedMethod,
  ApiErrors,
  parseZodError,
} from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import {
  createCommunitySchema,
  communityFilterSchema,
} from "@/lib/validations/community";
import {
  decodeCursor,
  buildPaginatedResponse,
} from "@/lib/utils/pagination";
import type { CommunityResponse } from "@/types/community";

/**
 * GET /api/communities
 * List the authenticated user's communities
 */
export const GET = withAuth(async (user, request: NextRequest) => {
  const searchParams = Object.fromEntries(
    new URL(request.url).searchParams.entries()
  );

  const validation = communityFilterSchema.safeParse(searchParams);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const { limit, after } = validation.data;

  try {
    // Get community IDs where user is an active member
    const memberships = await prisma.community_members.findMany({
      where: {
        profile_id: user.id,
        membership_status: "active",
      },
      select: { community_id: true },
    });

    const communityIds = memberships.map((m) => m.community_id);

    if (communityIds.length === 0) {
      return successResponse(buildPaginatedResponse([], limit));
    }

    const where: any = {
      id: { in: communityIds },
      is_active: true,
      deleted_at: null,
    };

    if (after) {
      const cursor = decodeCursor(after);
      if (cursor) {
        where.OR = [
          { created_at: { lt: new Date(cursor.created_at) } },
          { created_at: { equals: new Date(cursor.created_at) }, id: { lt: cursor.id } },
        ];
      }
    }

    const communities = await prisma.communities.findMany({
      where,
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    return successResponse(
      buildPaginatedResponse(
        communities.map((c) => ({ ...c, created_at: c.created_at?.toISOString() ?? null })),
        limit
      )
    );
  } catch (error) {
    console.error("Error fetching communities:", error);
    return ApiErrors.serverError();
  }
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

  try {
    // With Prisma there's no RLS, so we can create and return directly.
    // The DB trigger still fires to add the creator as owner.
    const community = await prisma.communities.create({
      data: {
        ...validation.data,
        created_by_profile_id: user.id,
      },
    });

    return successResponse(
      { community: community },
      undefined,
      201
    );
  } catch (error) {
    console.error("Error creating community:", error);
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
