import { NextRequest } from "next/server";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  handleUnsupportedMethod,
  ApiErrors,
  parseZodError,
} from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { browseFilterSchema } from "@/lib/validations/community";
import {
  decodeCursor,
  buildPaginatedResponse,
} from "@/lib/utils/pagination";

/**
 * GET /api/communities/browse
 * Discover communities that are open or request-to-join,
 * excluding communities the user is already a member of.
 */
export const GET = withAuth(async (user, request: NextRequest) => {
  const searchParams = Object.fromEntries(
    new URL(request.url).searchParams.entries()
  );

  const validation = browseFilterSchema.safeParse(searchParams);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const { limit, after, search } = validation.data;

  try {
    // Get community IDs the user is already a member of (any status)
    const memberships = await prisma.community_members.findMany({
      where: {
        profile_id: user.id,
        membership_status: { in: ["active", "pending"] },
      },
      select: { community_id: true },
    });

    const excludeIds = memberships.map((m) => m.community_id);

    const where: any = {
      is_active: true,
      deleted_at: null,
      access_type: { in: ["open", "request_to_join"] },
    };

    // Exclude communities the user is already part of
    if (excludeIds.length > 0) {
      where.id = { notIn: excludeIds };
    }

    // Search by name
    if (search) {
      where.community_name = { contains: search, mode: "insensitive" };
    }

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
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function POST() {
  return handleUnsupportedMethod(["GET"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["GET"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["GET"]);
}

export async function DELETE() {
  return handleUnsupportedMethod(["GET"]);
}
