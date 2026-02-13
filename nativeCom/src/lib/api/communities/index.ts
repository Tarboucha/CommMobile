import { fetchAPI } from '@/lib/api/client';
import type {
  Community,
  CommunityMember,
  PaginatedResponse,
  CreateCommunityInput,
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
 * TODO: Wire to GET /api/communities/browse once server endpoint exists
 */
export async function browseCommunities(
  limit = 20,
  after?: string,
  search?: string
): Promise<PaginatedResponse<Community>> {
  // Stub — returns empty list until server endpoint is ready
  return { data: [], pagination: { has_more: false, next_cursor: null, limit } };
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
