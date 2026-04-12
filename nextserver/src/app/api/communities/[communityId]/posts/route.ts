import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  parseZodError,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { createPostSchema } from "@/lib/validations/post";
import { paginationSchema } from "@/lib/validations/pagination";
import { decodeCursor, buildPaginatedResponse } from "@/lib/utils/pagination";

/**
 * GET /api/communities/[communityId]/posts
 * List community posts
 */
export const GET = withAuth(async (_user, request: NextRequest, params) => {
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
    const where: any = {
      community_id: communityId,
      deleted_at: null,
      status: "active",
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

    const posts = await prisma.community_posts.findMany({
      where,
      include: {
        profiles: { select: { id: true, first_name: true, last_name: true, avatar_url: true } },
      },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const shaped = posts.map((p) => ({
      ...p,
      created_at: p.created_at?.toISOString() ?? null,
    }));

    return successResponse(buildPaginatedResponse(shaped as any, limit));
  } catch (error) {
    console.error("Error fetching posts:", error);
    return ApiErrors.serverError();
  }
});

/**
 * POST /api/communities/[communityId]/posts
 * Create a new post — requires owner or admin role
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
    select: { id: true, member_role: true },
  });

  if (!membership) {
    return ApiErrors.forbidden("You must be an active member of this community");
  }

  if (!["owner", "admin"].includes(membership.member_role ?? "")) {
    return ApiErrors.forbidden("Only owners and admins can create posts");
  }

  let rawData: Record<string, unknown>;
  try {
    rawData = await request.json();
  } catch {
    return ApiErrors.badRequest("Invalid JSON in request body");
  }

  const validation = createPostSchema.safeParse(rawData);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  try {
    const post = await prisma.community_posts.create({
      data: {
        ...validation.data,
        community_id: communityId,
        author_id: user.id,
        status: "active",
      },
      include: {
        profiles: { select: { id: true, first_name: true, last_name: true, avatar_url: true } },
      },
    });

    return successResponse({ post: post as any }, undefined, 201);
  } catch (error) {
    console.error("Failed to create post:", error);
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
