import { NextRequest } from "next/server";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  parseZodError,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { boardFilterSchema } from "@/lib/validations/post";
import { decodeCursor, encodeCursor } from "@/lib/utils/pagination";

/**
 * GET /api/communities/[communityId]/board
 * Merged feed: offerings + posts, ordered by created_at DESC.
 * Pinned item returned separately (first page only).
 */
export const GET = withAuth(async (_user, request: NextRequest, params) => {
  const communityId = params?.communityId;
  if (!communityId) {
    return ApiErrors.badRequest("Community ID is required");
  }

  const searchParams = Object.fromEntries(
    new URL(request.url).searchParams.entries()
  );

  const validation = boardFilterSchema.safeParse(searchParams);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const { limit, after } = validation.data;

  try {
    // Fetch pinned item (first page only)
    let pinned: any = null;
    if (!after) {
      const pinnedRow = await prisma.community_pinned_items.findFirst({
        where: { community_id: communityId },
      });

      if (pinnedRow) {
        if (pinnedRow.pinned_offering_id) {
          const offering = await prisma.offerings.findFirst({
            where: { id: pinnedRow.pinned_offering_id, deleted_at: null, status: "active" },
            include: {
              profiles: { select: { id: true, first_name: true, last_name: true, avatar_url: true } },
            },
          });
          if (offering) {
            pinned = { ...pinnedRow, offering, post: null };
          }
        } else if (pinnedRow.pinned_post_id) {
          const post = await prisma.community_posts.findFirst({
            where: { id: pinnedRow.pinned_post_id, deleted_at: null, status: "active" },
            include: {
              profiles: { select: { id: true, first_name: true, last_name: true, avatar_url: true } },
            },
          });
          if (post) {
            pinned = { ...pinnedRow, offering: null, post };
          }
        }
      }
    }

    // Build cursor filter
    const cursorFilter = after ? (() => {
      const cursor = decodeCursor(after);
      if (!cursor) return {};
      return {
        OR: [
          { created_at: { lt: new Date(cursor.created_at) } },
          { created_at: { equals: new Date(cursor.created_at) }, id: { lt: cursor.id } },
        ],
      };
    })() : {};

    // Fetch offerings
    const offeringsWhere: any = {
      community_id: communityId,
      deleted_at: null,
      status: "active",
      ...cursorFilter,
    };

    // Exclude pinned offering from regular feed
    if (pinned?.pinned_offering_id) {
      offeringsWhere.id = { not: pinned.pinned_offering_id };
    }

    const offerings = await prisma.offerings.findMany({
      where: offeringsWhere,
      include: {
        profiles: { select: { id: true, first_name: true, last_name: true, avatar_url: true } },
      },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    // Fetch posts
    const postsWhere: any = {
      community_id: communityId,
      deleted_at: null,
      status: "active",
      ...cursorFilter,
    };

    if (pinned?.pinned_post_id) {
      postsWhere.id = { not: pinned.pinned_post_id };
    }

    const posts = await prisma.community_posts.findMany({
      where: postsWhere,
      include: {
        profiles: { select: { id: true, first_name: true, last_name: true, avatar_url: true } },
      },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    // Merge + sort
    type TaggedItem = {
      type: "offering" | "post";
      item: any;
      created_at: string;
      id: string;
    };

    const tagged: TaggedItem[] = [
      ...offerings.map((o) => ({
        type: "offering" as const,
        item: o,
        created_at: o.created_at?.toISOString() ?? "",
        id: o.id,
      })),
      ...posts.map((p) => ({
        type: "post" as const,
        item: p,
        created_at: p.created_at?.toISOString() ?? "",
        id: p.id,
      })),
    ];

    tagged.sort((a, b) => {
      const cmp = b.created_at.localeCompare(a.created_at);
      if (cmp !== 0) return cmp;
      return b.id.localeCompare(a.id);
    });

    const has_more = tagged.length > limit;
    const page = has_more ? tagged.slice(0, limit) : tagged;

    let next_cursor: string | null = null;
    if (has_more && page.length > 0) {
      const last = page[page.length - 1];
      next_cursor = encodeCursor(last.created_at, last.id);
    }

    const data = page.map(({ type, item }) => ({ type, item }));

    return successResponse({
      pinned,
      data,
      pagination: { has_more, next_cursor, limit },
    });
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
