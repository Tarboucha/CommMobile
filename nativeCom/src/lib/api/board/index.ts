import { fetchAPI } from '@/lib/api/client';
import type { BoardFeedResponse } from '@/types/board';
import type { CommunityPost, CreatePostInput } from '@/types/post';

// ============================================================================
// Board Feed
// ============================================================================

export async function getBoardFeed(
  communityId: string,
  limit = 20,
  cursor?: string
): Promise<BoardFeedResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('after', cursor);

  const response = await fetchAPI<{
    success: boolean;
    data: BoardFeedResponse;
  }>(`/api/communities/${communityId}/board?${params}`, { method: 'GET' });

  return response.data;
}

// ============================================================================
// Posts
// ============================================================================

export async function createPost(
  communityId: string,
  data: CreatePostInput
): Promise<CommunityPost> {
  const response = await fetchAPI<{
    success: boolean;
    data: { post: CommunityPost };
  }>(`/api/communities/${communityId}/posts`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

  return response.data.post;
}

export async function deletePost(postId: string): Promise<void> {
  await fetchAPI<{ success: boolean }>(
    `/api/posts/${postId}`,
    { method: 'DELETE' }
  );
}

// ============================================================================
// Pinning
// ============================================================================

export async function pinItem(
  communityId: string,
  itemType: 'offering' | 'post',
  itemId: string
): Promise<void> {
  await fetchAPI<{ success: boolean }>(
    `/api/communities/${communityId}/board/pin`,
    {
      method: 'POST',
      body: JSON.stringify({ item_type: itemType, item_id: itemId }),
    }
  );
}

export async function unpinItem(communityId: string): Promise<void> {
  await fetchAPI<{ success: boolean }>(
    `/api/communities/${communityId}/board/pin`,
    { method: 'DELETE' }
  );
}
