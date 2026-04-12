import type {
  communities,
  community_invitations,
  community_members,
  Prisma,
} from "@/generated/prisma/client";

/**
 * Community types extracted from the Prisma schema.
 */

// ============================================================================
// Database Types
// ============================================================================

export type Community = communities;
export type CommunityInsert = Prisma.communitiesCreateInput;
export type CommunityUpdate = Prisma.communitiesUpdateInput;

export type CommunityMember = community_members;
export type CommunityMemberInsert = Prisma.community_membersCreateInput;
export type CommunityMemberUpdate = Prisma.community_membersUpdateInput;

export type CommunityInvitation = community_invitations;
export type CommunityInvitationInsert = Prisma.community_invitationsCreateInput;
export type CommunityInvitationUpdate = Prisma.community_invitationsUpdateInput;

// ============================================================================
// Enum Value Arrays (for Zod validation)
// ============================================================================

export const CommunityAccessTypeValues = ["open", "request_to_join", "invite_only"] as const;
export type CommunityAccessType = (typeof CommunityAccessTypeValues)[number];

export const MemberRoleValues = ["owner", "admin", "moderator", "member"] as const;
export type MemberRole = (typeof MemberRoleValues)[number];

export const MembershipStatusValues = ["pending", "active", "removed", "left"] as const;
export type MembershipStatus = (typeof MembershipStatusValues)[number];

export const JoinMethodValues = ["invite_link", "direct_invite", "request"] as const;
export type JoinMethod = (typeof JoinMethodValues)[number];

export const InvitationStatusValues = ["pending", "accepted", "declined", "expired"] as const;
export type InvitationStatus = (typeof InvitationStatusValues)[number];

// ============================================================================
// API Response Types
// ============================================================================

export interface CommunityResponse {
  community: Community;
}

export interface CommunityMemberResponse {
  member: CommunityMember;
}

export interface CommunityInvitationResponse {
  invitation: CommunityInvitation;
}
