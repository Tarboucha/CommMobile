import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { assertCommunityMember } from "@/lib/guards/assert-community-member";
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "@/lib/errors/domain-errors";
import { decodeCursor, buildPaginatedResponse } from "@/lib/utils/pagination";
import type { UpdateCommunityInput, CreateInvitationInput } from "@/lib/validations/community";
import type { PaginationParams } from "@/lib/validations/pagination";
import type { User } from "@/types/auth";

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

// ============================================================================
// Invitations
// ============================================================================

export async function listInvitations(
  communityId: string,
  pagination: PaginationParams
) {
  const { limit, after } = pagination;

  const where: any = { community_id: communityId };

  if (after) {
    const cursor = decodeCursor(after);
    if (cursor) {
      where.OR = [
        { created_at: { lt: new Date(cursor.created_at) } },
        { created_at: { equals: new Date(cursor.created_at) }, id: { lt: cursor.id } },
      ];
    }
  }

  const invitations = await prisma.community_invitations.findMany({
    where,
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const shaped = invitations.map((i) => ({
    ...i,
    created_at: i.created_at?.toISOString() ?? null,
  }));

  return buildPaginatedResponse(shaped, limit);
}

export async function createInvitation(
  communityId: string,
  userId: string,
  input: CreateInvitationInput
) {
  await assertCommunityMember(communityId, userId, {
    requireCanInvite: true,
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + input.expires_in_days);

  const invitation = await prisma.community_invitations.create({
    data: {
      community_id: communityId,
      invited_by_profile_id: userId,
      invited_profile_id: input.invited_profile_id ?? null,
      invited_email: input.invited_email ?? null,
      invitation_message: input.invitation_message ?? null,
      invitation_token: randomUUID(),
      max_uses: input.max_uses,
      expires_at: expiresAt,
    },
  });

  // Resolve invited_profile_id from email if not provided directly
  let invitedProfileId = invitation.invited_profile_id;

  if (!invitedProfileId && invitation.invited_email) {
    const profile = await prisma.profiles.findFirst({
      where: { email: invitation.invited_email },
      select: { id: true },
    });

    if (profile) {
      invitedProfileId = profile.id;
      await prisma.community_invitations.update({
        where: { id: invitation.id },
        data: { invited_profile_id: profile.id },
      });
    }
  }

  // Send notification to the invitee if we have their profile ID
  if (invitedProfileId) {
    const community = await prisma.communities.findUnique({
      where: { id: communityId },
      select: { community_name: true },
    });

    const communityName = community?.community_name || "a community";

    await prisma.notifications.create({
      data: {
        profile_id: invitedProfileId,
        notification_type: "community_invite",
        title: "Community Invitation",
        body: `You've been invited to join "${communityName}"`,
        related_community_id: communityId,
        data_json: {
          invitation_id: invitation.id,
          community_id: communityId,
          invited_by_profile_id: userId,
        },
      },
    });
  }

  return invitation;
}

export async function respondToInvitation(
  communityId: string,
  invitationId: string,
  user: User,
  action: "accept" | "decline"
) {
  const invitation = await prisma.community_invitations.findFirst({
    where: { id: invitationId, community_id: communityId },
  });

  if (!invitation) throw new NotFoundError("Invitation");

  const isInvitee =
    invitation.invited_profile_id === user.id ||
    (invitation.invited_email && invitation.invited_email === user.email);

  if (!isInvitee) {
    throw new ForbiddenError("This invitation is not for you");
  }

  if (invitation.invitation_status !== "pending") {
    throw new ConflictError(
      `Invitation has already been ${invitation.invitation_status}`
    );
  }

  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    throw new ConflictError("Invitation has expired");
  }

  if (
    invitation.max_uses &&
    (invitation.current_uses || 0) >= invitation.max_uses
  ) {
    throw new ConflictError("Invitation has reached its maximum uses");
  }

  if (action === "decline") {
    return prisma.community_invitations.update({
      where: { id: invitationId },
      data: {
        invitation_status: "declined",
        declined_at: new Date(),
      },
    });
  }

  // Accept: check capacity
  const community = await prisma.communities.findUnique({
    where: { id: communityId },
    select: { current_members_count: true, max_members: true },
  });

  if (
    community?.max_members &&
    (community.current_members_count || 0) >= community.max_members
  ) {
    throw new ConflictError(
      "Community has reached its maximum member capacity"
    );
  }

  const existingMember = await prisma.community_members.findFirst({
    where: { community_id: communityId, profile_id: user.id },
    select: { id: true, membership_status: true },
  });

  if (existingMember?.membership_status === "active") {
    return prisma.community_invitations.update({
      where: { id: invitationId },
      data: {
        invitation_status: "accepted",
        accepted_at: new Date(),
        current_uses: (invitation.current_uses || 0) + 1,
      },
    });
  }

  const memberData = {
    community_id: communityId,
    profile_id: user.id,
    join_method: "direct_invite" as const,
    membership_status: "active" as const,
    invited_by_profile_id: invitation.invited_by_profile_id,
    membership_approved_at: new Date(),
    removal_reason: null,
    removed_by_profile_id: null,
    membership_removed_at: null,
  };

  if (
    existingMember &&
    (existingMember.membership_status === "left" ||
      existingMember.membership_status === "removed")
  ) {
    await prisma.community_members.update({
      where: { id: existingMember.id },
      data: memberData,
    });
  } else {
    await prisma.community_members.create({
      data: memberData,
    });
  }

  return prisma.community_invitations.update({
    where: { id: invitationId },
    data: {
      invitation_status: "accepted",
      accepted_at: new Date(),
      current_uses: (invitation.current_uses || 0) + 1,
    },
  });
}

// ============================================================================
// Invite link
// ============================================================================

export async function generateInviteLink(communityId: string, userId: string) {
  await assertCommunityMember(communityId, userId, {
    requiredRoles: ["owner", "admin", "moderator"],
  });

  const token = randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.communities.update({
    where: { id: communityId },
    data: {
      invite_link_token: token,
      invite_link_expires_at: expiresAt,
    },
  });

  return { token, expires_at: expiresAt.toISOString() };
}

export async function revokeInviteLink(communityId: string, userId: string) {
  await assertCommunityMember(communityId, userId, {
    requiredRoles: ["owner", "admin", "moderator"],
  });

  await prisma.communities.update({
    where: { id: communityId },
    data: {
      invite_link_token: null,
      invite_link_expires_at: null,
    },
  });
}
