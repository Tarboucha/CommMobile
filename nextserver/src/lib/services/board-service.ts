import { prisma } from "@/lib/prisma";
import { assertCommunityMember } from "@/lib/guards/assert-community-member";
import { NotFoundError } from "@/lib/errors/domain-errors";
import type { PinItemInput } from "@/lib/validations/post";

// ============================================================================
// Pin / Unpin
// ============================================================================

export async function pinItem(
  communityId: string,
  userId: string,
  data: PinItemInput
) {
  await assertCommunityMember(communityId, userId, {
    requiredRoles: ["owner", "admin"],
  });

  const { item_type, item_id } = data;

  // Verify the item exists and belongs to this community
  if (item_type === "offering") {
    const offering = await prisma.offerings.findFirst({
      where: { id: item_id, community_id: communityId, deleted_at: null, status: "active" },
    });
    if (!offering) throw new NotFoundError("Offering");
  } else {
    const post = await prisma.community_posts.findFirst({
      where: { id: item_id, community_id: communityId, deleted_at: null, status: "active" },
    });
    if (!post) throw new NotFoundError("Post");
  }

  // Delete existing pin
  await prisma.community_pinned_items.deleteMany({
    where: { community_id: communityId },
  });

  // Insert new pin
  await prisma.community_pinned_items.create({
    data: {
      community_id: communityId,
      pinned_by_profile_id: userId,
      pinned_offering_id: item_type === "offering" ? item_id : null,
      pinned_post_id: item_type === "post" ? item_id : null,
    },
  });
}

export async function unpinItem(communityId: string, userId: string) {
  await assertCommunityMember(communityId, userId, {
    requiredRoles: ["owner", "admin"],
  });

  await prisma.community_pinned_items.deleteMany({
    where: { community_id: communityId },
  });
}
