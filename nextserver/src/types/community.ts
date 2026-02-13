import { Database } from "@/types/supabase";

/**
 * Community types extracted from Supabase schema
 */

// ============================================================================
// Database Types
// ============================================================================

export type Community = Database["public"]["Tables"]["communities"]["Row"];
export type CommunityInsert = Database["public"]["Tables"]["communities"]["Insert"];
export type CommunityUpdate = Database["public"]["Tables"]["communities"]["Update"];

export type CommunityMember = Database["public"]["Tables"]["community_members"]["Row"];
export type CommunityMemberInsert = Database["public"]["Tables"]["community_members"]["Insert"];
export type CommunityMemberUpdate = Database["public"]["Tables"]["community_members"]["Update"];

export type CommunityInvitation = Database["public"]["Tables"]["community_invitations"]["Row"];
export type CommunityInvitationInsert = Database["public"]["Tables"]["community_invitations"]["Insert"];
export type CommunityInvitationUpdate = Database["public"]["Tables"]["community_invitations"]["Update"];

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
