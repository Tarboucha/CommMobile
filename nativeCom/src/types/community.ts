// ============================================================================
// Community Types (matching server schema)
// ============================================================================

export type CommunityAccessType = 'open' | 'request_to_join' | 'invite_only';
export type MemberRole = 'owner' | 'admin' | 'moderator' | 'member';
export type MembershipStatus = 'pending' | 'active' | 'removed' | 'left';
export type JoinMethod = 'invite_link' | 'direct_invite' | 'request';

export interface Community {
  id: string;
  community_name: string;
  community_description: string | null;
  community_image_url: string | null;
  access_type: CommunityAccessType | null;
  max_members: number | null;
  current_members_count: number | null;
  is_active: boolean | null;
  created_by_profile_id: string;
  address_id: string | null;
  allow_member_invites: boolean | null;
  auto_approve_join_requests: boolean | null;
  invite_link_token: string | null;
  invite_link_expires_at: string | null;
  plan: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface CommunityMember {
  id: string;
  community_id: string;
  profile_id: string;
  member_role: MemberRole | null;
  membership_status: MembershipStatus | null;
  join_method: JoinMethod;
  can_post_offerings: boolean | null;
  can_invite_members: boolean | null;
  invited_by_profile_id: string | null;
  approved_by_profile_id: string | null;
  removed_by_profile_id: string | null;
  removal_reason: string | null;
  admin_notes: string | null;
  join_requested_at: string | null;
  membership_approved_at: string | null;
  membership_removed_at: string | null;
  last_activity_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface PaginationMeta {
  has_more: boolean;
  next_cursor: string | null;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface CreateCommunityInput {
  community_name: string;
  community_description?: string | null;
  access_type?: CommunityAccessType;
  max_members?: number;
  allow_member_invites?: boolean;
  auto_approve_join_requests?: boolean;
  address_id?: string | null;
}
