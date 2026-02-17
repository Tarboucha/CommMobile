import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  parseZodError,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";
import { createPostSchema } from "@/lib/validations/post";
import { paginationSchema } from "@/lib/validations/pagination";
import {
  applyCursorPagination,
  buildPaginatedResponse,
} from "@/lib/utils/pagination";

/**
 * GET /api/communities/[communityId]/posts
 * List community posts — RLS: only active community members can see
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

  const validation = paginationSchema.safeParse(searchParams);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const { limit, after } = validation.data;

  let query = supabase
    .from("community_posts")
    .select("*, profiles!author_id(id, first_name, last_name, avatar_url)")
    .eq("community_id", communityId)
    .is("deleted_at", null)
    .eq("status", "active");

  query = applyCursorPagination(query, { limit, after });

  const { data: posts, error } = await query;

  if (error) {
    console.error("Error fetching posts:", error);
    return ApiErrors.serverError();
  }

  return successResponse(buildPaginatedResponse(posts || [], limit));
});

/**
 * POST /api/communities/[communityId]/posts
 * Create a new post — requires owner or admin role
 */
export const POST = withAuth(async (user, request: NextRequest, params) => {
  const communityId = params?.communityId;
  if (!communityId) {
    return ApiErrors.badRequest("Community ID is required");
  }

  const supabase = await createClient();

  // Check membership + admin/owner role
  const { data: membership } = await supabase
    .from("community_members")
    .select("id, member_role, membership_status")
    .eq("community_id", communityId)
    .eq("profile_id", user.id)
    .eq("membership_status", "active")
    .single();

  if (!membership) {
    return ApiErrors.forbidden("You must be an active member of this community");
  }

  if (!["owner", "admin"].includes(membership.member_role ?? "")) {
    return ApiErrors.forbidden("Only owners and admins can create posts");
  }

  // Parse and validate body
  let rawData: Record<string, unknown>;
  try {
    rawData = await request.json();
  } catch {
    return ApiErrors.badRequest("Invalid JSON in request body");
  }

  const validation = createPostSchema.safeParse(rawData);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const input = validation.data;

  // Insert post
  const { data: post, error: createError } = await supabase
    .from("community_posts")
    .insert({
      ...input,
      community_id: communityId,
      author_id: user.id,
      status: "active",
    })
    .select("*, profiles!author_id(id, first_name, last_name, avatar_url)")
    .single();

  if (createError || !post) {
    console.error("Failed to create post:", createError);
    return ApiErrors.serverError();
  }

  return successResponse({ post }, undefined, 201);
});

export async function PUT() {
  return handleUnsupportedMethod(["GET", "POST"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["GET", "POST"]);
}

export async function DELETE() {
  return handleUnsupportedMethod(["GET", "POST"]);
}
