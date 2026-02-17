// ============================================================================
// Community Post Types
// ============================================================================

export interface PostAuthor {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export interface CommunityPost {
  id: string;
  community_id: string;
  author_id: string;
  body: string;
  image_url: string | null;
  link_url: string | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  // Joined fields
  profiles?: PostAuthor | null;
}

export interface CreatePostInput {
  body: string;
  image_url?: string | null;
  link_url?: string | null;
}
