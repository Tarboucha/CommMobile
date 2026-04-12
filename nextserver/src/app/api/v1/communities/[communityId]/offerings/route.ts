import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  parseZodError,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import {
  createOfferingSchema,
  offeringFilterSchema,
} from "@/lib/validations/offering";
import { decodeCursor, buildPaginatedResponse } from "@/lib/utils/pagination";

/**
 * GET /api/communities/[communityId]/offerings
 * List community offerings
 */
export const GET = withAuth(async (_user, request: NextRequest, params) => {
  const communityId = params?.communityId;
  if (!communityId) {
    return ApiErrors.badRequest("Community ID is required");
  }

  const searchParams = Object.fromEntries(
    new URL(request.url).searchParams.entries()
  );

  const validation = offeringFilterSchema.safeParse(searchParams);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const { category, transaction_type, limit, after } = validation.data;

  try {
    const where: any = {
      community_id: communityId,
      deleted_at: null,
      status: "active",
    };

    if (category) where.category = category;
    if (transaction_type) where.transaction_type = transaction_type;

    if (after) {
      const cursor = decodeCursor(after);
      if (cursor) {
        where.OR = [
          { created_at: { lt: new Date(cursor.created_at) } },
          { created_at: { equals: new Date(cursor.created_at) }, id: { lt: cursor.id } },
        ];
      }
    }

    const offerings = await prisma.offerings.findMany({
      where,
      include: {
        profiles: { select: { id: true, first_name: true, last_name: true, avatar_url: true } },
      },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const shaped = offerings.map((o) => ({
      ...o,
      created_at: o.created_at?.toISOString() ?? null,
    }));

    return successResponse(buildPaginatedResponse(shaped, limit));
  } catch (error) {
    console.error("Error fetching offerings:", error);
    return ApiErrors.serverError();
  }
});

/**
 * POST /api/communities/[communityId]/offerings
 * Create a new offering — requires can_post_offerings permission
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
    select: { id: true, can_post_offerings: true },
  });

  if (!membership) {
    return ApiErrors.forbidden("You must be an active member of this community");
  }

  if (!membership.can_post_offerings) {
    return ApiErrors.forbidden("You do not have permission to post offerings in this community");
  }

  let rawData: Record<string, unknown>;
  try {
    rawData = await request.json();
  } catch {
    return ApiErrors.badRequest("Invalid JSON in request body");
  }

  const validation = createOfferingSchema.safeParse(rawData);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  try {
    const offering = await prisma.offerings.create({
      data: {
        ...validation.data,
        community_id: communityId,
        provider_id: user.id,
        status: "active",
        version: 1,
      },
    });

    return successResponse({ offering: offering }, undefined, 201);
  } catch (error) {
    console.error("Failed to create offering:", error);
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
