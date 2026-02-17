import { fetchAPI } from '@/lib/api/client';
import type {
  Community,
  CommunityMember,
  CommunityInvitation,
  PaginatedResponse,
  CreateCommunityInput,
  CreateInvitationInput,
  InviteLinkInfo,
} from '@/types/community';

/**
 * Get the authenticated user's communities (paginated)
 */
export async function getCommunities(limit = 20, after?: string): Promise<PaginatedResponse<Community>> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (after) params.set('after', after);

  const response = await fetchAPI<{
    success: boolean;
    data: PaginatedResponse<Community>;
  }>(`/api/communities?${params}`, { method: 'GET' });

  return response.data;
}

/**
 * Browse discoverable communities (open / request-to-join, excluding user's)
 */
export async function browseCommunities(
  limit = 20,
  after?: string,
  search?: string
): Promise<PaginatedResponse<Community>> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (after) params.set('after', after);
  if (search) params.set('search', search);

  const response = await fetchAPI<{
    success: boolean;
    data: PaginatedResponse<Community>;
  }>(`/api/communities/browse?${params}`, { method: 'GET' });

  return response.data;
}

/**
 * Get a single community by ID
 */
export async function getCommunity(communityId: string): Promise<Community> {
  const response = await fetchAPI<{
    success: boolean;
    data: { community: Community };
  }>(`/api/communities/${communityId}`, { method: 'GET' });

  return response.data.community;
}

/**
 * Create a new community
 */
export async function createCommunity(data: CreateCommunityInput): Promise<Community> {
  const response = await fetchAPI<{
    success: boolean;
    data: { community: Community };
  }>('/api/communities', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  return response.data.community;
}

/**
 * Update a community (admin/owner only)
 */
export async function updateCommunity(
  communityId: string,
  data: Partial<CreateCommunityInput>
): Promise<Community> {
  const response = await fetchAPI<{
    success: boolean;
    data: { community: Community };
  }>(`/api/communities/${communityId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

  return response.data.community;
}

/**
 * Delete a community (owner only, soft delete)
 */
export async function deleteCommunity(communityId: string): Promise<void> {
  await fetchAPI(`/api/communities/${communityId}`, { method: 'DELETE' });
}

/**
 * Join a community (or request to join)
 */
export async function joinCommunity(communityId: string): Promise<CommunityMember> {
  const response = await fetchAPI<{
    success: boolean;
    data: { member: CommunityMember };
  }>(`/api/communities/${communityId}/members`, { method: 'POST' });

  return response.data.member;
}

/**
 * Leave a community
 */
export async function leaveCommunity(communityId: string): Promise<void> {
  await fetchAPI(`/api/communities/${communityId}/leave`, { method: 'POST' });
}

/**
 * Get community members (paginated)
 */
export async function getCommunityMembers(
  communityId: string,
  limit = 20,
  after?: string
): Promise<PaginatedResponse<CommunityMember>> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (after) params.set('after', after);

  const response = await fetchAPI<{
    success: boolean;
    data: PaginatedResponse<CommunityMember>;
  }>(`/api/communities/${communityId}/members?${params}`, { method: 'GET' });

  return response.data;
}

// ============================================================================
// Invitations
// ============================================================================

/**
 * Create an invitation (email-based)
 */
export async function createInvitation(
  communityId: string,
  data: CreateInvitationInput
): Promise<CommunityInvitation> {
  const response = await fetchAPI<{
    success: boolean;
    data: { invitation: CommunityInvitation };
  }>(`/api/communities/${communityId}/invitations`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

  return response.data.invitation;
}

/**
 * Accept or decline an invitation
 */
export async function respondToInvitation(
  communityId: string,
  invitationId: string,
  action: 'accept' | 'decline'
): Promise<CommunityInvitation> {
  const response = await fetchAPI<{
    success: boolean;
    data: { invitation: CommunityInvitation };
  }>(`/api/communities/${communityId}/invitations/${invitationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ action }),
  });

  return response.data.invitation;
}

// ============================================================================
// Invite Links
// ============================================================================

/**
 * Generate or refresh a community invite link
 */
export async function generateInviteLink(
  communityId: string
): Promise<{ token: string; expires_at: string }> {
  const response = await fetchAPI<{
    success: boolean;
    data: { token: string; expires_at: string };
  }>(`/api/communities/${communityId}/invite-link`, { method: 'POST' });

  return response.data;
}

/**
 * Revoke the community invite link
 */
export async function revokeInviteLink(communityId: string): Promise<void> {
  await fetchAPI(`/api/communities/${communityId}/invite-link`, { method: 'DELETE' });
}

/**
 * Resolve an invite link token — get community info
 */
export async function getInviteLinkInfo(token: string): Promise<InviteLinkInfo> {
  const response = await fetchAPI<{
    success: boolean;
    data: InviteLinkInfo;
  }>(`/api/invite/${token}`, { method: 'GET' });

  return response.data;
}

/**
 * Accept an invite link — join the community
 */
export async function acceptInviteLink(
  token: string
): Promise<CommunityMember> {
  const response = await fetchAPI<{
    success: boolean;
    data: { member: CommunityMember; already_member: boolean };
  }>(`/api/invite/${token}`, { method: 'POST' });

  return response.data.member;
}
