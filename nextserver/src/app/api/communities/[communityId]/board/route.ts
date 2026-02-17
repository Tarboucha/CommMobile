import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  parseZodError,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";
import { boardFilterSchema } from "@/lib/validations/post";
import {
  applyCursorPagination,
  buildPaginatedResponse,
  encodeCursor,
} from "@/lib/utils/pagination";

/**
 * GET /api/communities/[communityId]/board
 * Merged feed: offerings + posts, ordered by created_at DESC.
 * Pinned item returned separately (first page only).
 */
export const GET = withAuth(async (user, request: NextRequest, params) => {
  const communityId = params?.communityId;
  if (!communityId) {
    return ApiErrors.badRequest("Community ID is required");
  }

  const supabase = await createClient();
  const searchParams = Object.fromEntries(
    new URL(request.url).searchParams.entries()
  );

  const validation = boardFilterSchema.safeParse(searchParams);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const { limit, after } = validation.data;

  // ── Fetch pinned item (first page only) ──────────────────────────────
  let pinned = null;
  if (!after) {
    const { data: pinnedRow } = await supabase
      .from("community_pinned_items")
      .select("*")
      .eq("community_id", communityId)
      .single();

    if (pinnedRow) {
      // Fetch the actual pinned item with profile data
      if (pinnedRow.pinned_offering_id) {
        const { data: offering } = await supabase
          .from("offerings")
          .select(
            "*, profiles!provider_id(id, first_name, last_name, avatar_url)"
          )
          .eq("id", pinnedRow.pinned_offering_id)
          .is("deleted_at", null)
          .eq("status", "active")
          .single();

        if (offering) {
          pinned = { ...pinnedRow, offering, post: null };
        }
      } else if (pinnedRow.pinned_post_id) {
        const { data: post } = await supabase
          .from("community_posts")
          .select(
            "*, profiles!author_id(id, first_name, last_name, avatar_url)"
          )
          .eq("id", pinnedRow.pinned_post_id)
          .is("deleted_at", null)
          .eq("status", "active")
          .single();

        if (post) {
          pinned = { ...pinnedRow, offering: null, post };
        }
      }
    }
  }

  // ── Fetch offerings ──────────────────────────────────────────────────
  let offeringsQuery = supabase
    .from("offerings")
    .select("*, profiles!provider_id(id, first_name, last_name, avatar_url)")
    .eq("community_id", communityId)
    .is("deleted_at", null)
    .eq("status", "active");

  // Exclude pinned offering from the regular feed
  if (pinned?.pinned_offering_id) {
    offeringsQuery = offeringsQuery.neq("id", pinned.pinned_offering_id);
  }

  offeringsQuery = applyCursorPagination(offeringsQuery, { limit, after });

  const { data: offerings, error: offErr } = await offeringsQuery;
  if (offErr) {
    console.error("Error fetching offerings for board:", offErr);
    return ApiErrors.serverError();
  }

  // ── Fetch posts ──────────────────────────────────────────────────────
  let postsQuery = supabase
    .from("community_posts")
    .select("*, profiles!author_id(id, first_name, last_name, avatar_url)")
    .eq("community_id", communityId)
    .is("deleted_at", null)
    .eq("status", "active");

  // Exclude pinned post from the regular feed
  if (pinned?.pinned_post_id) {
    postsQuery = postsQuery.neq("id", pinned.pinned_post_id);
  }

  postsQuery = applyCursorPagination(postsQuery, { limit, after });

  const { data: posts, error: postErr } = await postsQuery;
  if (postErr) {
    console.error("Error fetching posts for board:", postErr);
    return ApiErrors.serverError();
  }

  // ── Merge + sort ─────────────────────────────────────────────────────
  type TaggedItem = {
    type: "offering" | "post";
    item: (typeof offerings)[0] | (typeof posts)[0];
    created_at: string;
    id: string;
  };

  const tagged: TaggedItem[] = [
    ...(offerings || []).map((o: any) => ({
      type: "offering" as const,
      item: o,
      created_at: o.created_at ?? "",
      id: o.id,
    })),
    ...(posts || []).map((p: any) => ({
      type: "post" as const,
      item: p,
      created_at: p.created_at ?? "",
      id: p.id,
    })),
  ];

  // Sort newest first
  tagged.sort((a, b) => {
    const cmp = b.created_at.localeCompare(a.created_at);
    if (cmp !== 0) return cmp;
    return b.id.localeCompare(a.id);
  });

  // Take `limit` items, determine has_more
  const has_more = tagged.length > limit;
  const page = has_more ? tagged.slice(0, limit) : tagged;

  let next_cursor: string | null = null;
  if (has_more && page.length > 0) {
    const last = page[page.length - 1];
    next_cursor = encodeCursor(last.created_at, last.id);
  }

  const data = page.map(({ type, item }) => ({ type, item }));

  return successResponse({
    pinned,
    data,
    pagination: { has_more, next_cursor, limit },
  });
});

export async function POST() {
  return handleUnsupportedMethod(["GET"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["GET"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["GET"]);
}

export async function DELETE() {
  return handleUnsupportedMethod(["GET"]);
}
