import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  handleUnsupportedMethod,
  ApiErrors,
  parseZodError,
} from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";
import { browseFilterSchema } from "@/lib/validations/community";
import {
  applyCursorPagination,
  buildPaginatedResponse,
} from "@/lib/utils/pagination";

/**
 * GET /api/communities/browse
 * Discover communities that are open or request-to-join,
 * excluding communities the user is already a member of.
 */
export const GET = withAuth(async (user, request: NextRequest) => {
  const supabase = await createClient();
  const searchParams = Object.fromEntries(
    new URL(request.url).searchParams.entries()
  );

  const validation = browseFilterSchema.safeParse(searchParams);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const { limit, after, search } = validation.data;

  // Get community IDs the user is already a member of (any status)
  const { data: memberships, error: memberError } = await supabase
    .from("community_members")
    .select("community_id")
    .eq("profile_id", user.id)
    .in("membership_status", ["active", "pending"]);

  if (memberError) {
    console.error("Error fetching memberships:", memberError);
    return ApiErrors.serverError();
  }

  const excludeIds = memberships?.map((m) => m.community_id) || [];

  let query = supabase
    .from("communities")
    .select("*")
    .eq("is_active", true)
    .is("deleted_at", null)
    .in("access_type", ["open", "request_to_join"]);

  // Exclude communities the user is already part of
  if (excludeIds.length > 0) {
    query = query.not("id", "in", `(${excludeIds.join(",")})`);
  }

  // Search by name
  if (search) {
    query = query.ilike("community_name", `%${search}%`);
  }

  query = applyCursorPagination(query, { limit, after });

  const { data: communities, error } = await query;

  if (error) {
    console.error("Error browsing communities:", error);
    return ApiErrors.serverError();
  }

  return successResponse(buildPaginatedResponse(communities || [], limit));
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
