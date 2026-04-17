import { prisma } from "@/lib/prisma";
import { NotFoundError, ForbiddenError } from "@/lib/errors/domain-errors";

/**
 * Asserts that the community post exists and the user is its author.
 * Throws NotFoundError or ForbiddenError on failure.
 * Returns the post record on success.
 */
export async function assertPostAuthor(postId: string, userId: string) {
  const post = await prisma.community_posts.findFirst({
    where: { id: postId, deleted_at: null },
  });

  if (!post) throw new NotFoundError("Post");
  if (post.author_id !== userId) {
    throw new ForbiddenError("You can only modify your own posts");
  }

  return post;
}
