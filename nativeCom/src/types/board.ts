// ============================================================================
// Board Feed Types
// ============================================================================

import type { Offering } from './offering';
import type { CommunityPost } from './post';
import type { PaginationMeta } from './community';

export type BoardItemType = 'offering' | 'post';

export interface BoardOffering {
  type: 'offering';
  item: Offering;
}

export interface BoardPost {
  type: 'post';
  item: CommunityPost;
}

export type BoardItem = BoardOffering | BoardPost;

export interface PinnedItem {
  id: string;
  community_id: string;
  pinned_offering_id: string | null;
  pinned_post_id: string | null;
  pinned_by_profile_id: string | null;
  pinned_at: string;
  offering?: Offering | null;
  post?: CommunityPost | null;
}

export interface BoardFeedResponse {
  pinned: PinnedItem | null;
  data: BoardItem[];
  pagination: PaginationMeta;
}
