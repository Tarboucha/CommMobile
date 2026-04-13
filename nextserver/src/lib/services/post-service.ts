import { prisma } from "@/lib/prisma";
import { assertCommunityMember } from "@/lib/guards/assert-community-member";
import {
  NotFoundError,
  ForbiddenError,
} from "@/lib/errors/domain-errors";
import { decodeCursor, buildPaginatedResponse } from "@/lib/utils/pagination";
import type { CreatePostInput, UpdatePostInput } from "@/lib/validations/post";
import type { PaginationParams } from "@/lib/validations/pagination";

const POST_AUTHOR_INCLUDE = {
  profiles: { select: { id: true, first_name: true, last_name: true, avatar_url: true } },
} as const;

// ============================================================================
// Single post
// ============================================================================

export async function getPost(postId: string) {
  const post = await prisma.community_posts.findFirst({
    where: { id: postId, deleted_at: null },
    include: POST_AUTHOR_INCLUDE,
  });

  if (!post) throw new NotFoundError("Post");
  return post;
}

export async function updatePost(
  postId: string,
  userId: string,
  data: UpdatePostInput
) {
  const existing = await prisma.community_posts.findFirst({
    where: { id: postId, deleted_at: null },
    select: { id: true, author_id: true },
  });

  if (!existing) throw new NotFoundError("Post");
  if (existing.author_id !== userId) {
    throw new ForbiddenError("You can only edit your own posts");
  }

  return prisma.community_posts.update({
    where: { id: postId },
    data: { ...data, updated_at: new Date() },
    include: POST_AUTHOR_INCLUDE,
  });
}

export async function deletePost(postId: string, userId: string) {
  const existing = await prisma.community_posts.findFirst({
    where: { id: postId, deleted_at: null },
    select: { id: true, author_id: true },
  });

  if (!existing) throw new NotFoundError("Post");
  if (existing.author_id !== userId) {
    throw new ForbiddenError("You can only delete your own posts");
  }

  await prisma.community_posts.update({
    where: { id: postId },
    data: { deleted_at: new Date(), status: "inactive" },
  });
}

// ============================================================================
// Community-scoped posts
// ============================================================================

export async function listCommunityPosts(
  communityId: string,
  pagination: PaginationParams
) {
  const { limit, after } = pagination;

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
    include: POST_AUTHOR_INCLUDE,
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const shaped = posts.map((p) => ({
    ...p,
    created_at: p.created_at?.toISOString() ?? null,
  }));

  return buildPaginatedResponse(shaped, limit);
}

export async function createCommunityPost(
  communityId: string,
  userId: string,
  data: CreatePostInput
) {
  await assertCommunityMember(communityId, userId, {
    requiredRoles: ["owner", "admin"],
  });

  return prisma.community_posts.create({
    data: {
      ...data,
      community_id: communityId,
      author_id: userId,
      status: "active",
    },
    include: POST_AUTHOR_INCLUDE,
  });
}
