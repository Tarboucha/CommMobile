import { prisma } from "@/lib/prisma";
import { assertCommunityMember } from "@/lib/guards/assert-community-member";
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "@/lib/errors/domain-errors";
import type { UpdateCommunityInput } from "@/lib/validations/community";

// ============================================================================
// Community CRUD
// ============================================================================

export async function getCommunity(communityId: string) {
  const community = await prisma.communities.findFirst({
    where: { id: communityId, deleted_at: null },
  });

  if (!community) throw new NotFoundError("Community");
  return community;
}

export async function updateCommunity(
  communityId: string,
  userId: string,
  data: UpdateCommunityInput
) {
  await assertCommunityMember(communityId, userId, {
    requiredRoles: ["owner", "admin"],
  });

  return prisma.communities.update({
    where: { id: communityId },
    data,
  });
}

export async function deleteCommunity(communityId: string, userId: string) {
  await assertCommunityMember(communityId, userId, {
    requiredRoles: ["owner"],
  });

  await prisma.communities.update({
    where: { id: communityId },
    data: { deleted_at: new Date(), is_active: false },
  });
}

// ============================================================================
// Member management
// ============================================================================

export async function joinCommunity(communityId: string, userId: string) {
  const community = await prisma.communities.findFirst({
    where: { id: communityId, deleted_at: null, is_active: true },
    select: {
      id: true,
      access_type: true,
      is_active: true,
      current_members_count: true,
      max_members: true,
      auto_approve_join_requests: true,
    },
  });

  if (!community) throw new NotFoundError("Community");

  if (community.access_type === "invite_only") {
    throw new ForbiddenError(
      "This community is invite-only. You need an invitation to join."
    );
  }

  const existing = await prisma.community_members.findFirst({
    where: { community_id: communityId, profile_id: userId },
    select: { id: true, membership_status: true },
  });

  if (existing) {
    if (existing.membership_status === "active") {
      throw new ConflictError("You are already a member of this community");
    }
    if (existing.membership_status === "pending") {
      throw new ConflictError("You already have a pending join request");
    }
  }

  if (
    community.max_members &&
    (community.current_members_count || 0) >= community.max_members
  ) {
    throw new ConflictError(
      "This community has reached its maximum member capacity"
    );
  }

  const isOpen =
    community.access_type === "open" || community.auto_approve_join_requests;
  const membershipStatus = isOpen ? "active" : "pending";
  const now = new Date();

  // Re-activate a previously left/removed member
  if (
    existing &&
    (existing.membership_status === "left" ||
      existing.membership_status === "removed")
  ) {
    const member = await prisma.community_members.update({
      where: { id: existing.id },
      data: {
        join_method: "request",
        membership_status: membershipStatus,
        join_requested_at: now,
        membership_approved_at: isOpen ? now : null,
        removal_reason: null,
        removed_by_profile_id: null,
        membership_removed_at: null,
      },
    });

    return { member, isOpen };
  }

  // Brand new member
  const member = await prisma.community_members.create({
    data: {
      community_id: communityId,
      profile_id: userId,
      join_method: "request",
      membership_status: membershipStatus,
      join_requested_at: now,
      membership_approved_at: isOpen ? now : null,
    },
  });

  return { member, isOpen };
}

export async function updateMember(
  communityId: string,
  memberId: string,
  userId: string,
  data: Record<string, any>
) {
  await assertCommunityMember(communityId, userId, {
    requiredRoles: ["owner", "admin"],
  });

  const targetMember = await prisma.community_members.findFirst({
    where: { id: memberId, community_id: communityId },
  });

  if (!targetMember) throw new NotFoundError("Member");

  if (targetMember.member_role === "owner") {
    throw new ForbiddenError("Cannot modify the community owner");
  }

  const updateData: Record<string, any> = { ...data };

  if (
    updateData.membership_status === "active" &&
    targetMember.membership_status === "pending"
  ) {
    updateData.membership_approved_at = new Date();
    updateData.approved_by_profile_id = userId;
  }

  if (updateData.membership_status === "removed") {
    updateData.membership_removed_at = new Date();
    updateData.removed_by_profile_id = userId;
  }

  return prisma.community_members.update({
    where: { id: memberId },
    data: updateData,
  });
}

export async function removeMember(
  communityId: string,
  memberId: string,
  userId: string
) {
  await assertCommunityMember(communityId, userId, {
    requiredRoles: ["owner", "admin"],
  });

  const targetMember = await prisma.community_members.findFirst({
    where: { id: memberId, community_id: communityId },
    select: { member_role: true },
  });

  if (!targetMember) throw new NotFoundError("Member");

  if (targetMember.member_role === "owner") {
    throw new ForbiddenError("Cannot remove the community owner");
  }

  await prisma.community_members.update({
    where: { id: memberId },
    data: {
      membership_status: "removed",
      membership_removed_at: new Date(),
      removed_by_profile_id: userId,
    },
  });
}

export async function leaveCommunity(communityId: string, userId: string) {
  const membership = await prisma.community_members.findFirst({
    where: { community_id: communityId, profile_id: userId },
    select: { id: true, member_role: true, membership_status: true },
  });

  if (!membership) throw new NotFoundError("You are not a member of this community");

  if (membership.membership_status !== "active") {
    throw new ConflictError("You are not an active member of this community");
  }

  if (membership.member_role === "owner") {
    throw new ForbiddenError(
      "The owner cannot leave the community. Transfer ownership first."
    );
  }

  await prisma.community_members.update({
    where: { id: membership.id },
    data: {
      membership_status: "left",
      membership_removed_at: new Date(),
    },
  });
}
