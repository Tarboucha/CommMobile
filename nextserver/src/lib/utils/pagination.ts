import type { PaginatedResponse } from "@/types/pagination";

// Re-export for convenience
export type { PaginationMeta, PaginatedResponse } from "@/types/pagination";
export { paginationSchema, type PaginationParams } from "@/lib/validations/pagination";

// ============================================================================
// Cursor encoding / decoding
// ============================================================================

/**
 * Encode a cursor from created_at + id
 * Cursor = base64url of "created_at|id"
 */
export function encodeCursor(created_at: string, id: string): string {
  return Buffer.from(`${created_at}|${id}`).toString("base64url");
}

/**
 * Decode a cursor back to created_at + id
 * Returns null if the cursor is malformed
 */
export function decodeCursor(
  cursor: string
): { created_at: string; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf-8");
    const separatorIndex = decoded.indexOf("|");
    if (separatorIndex === -1) return null;

    const created_at = decoded.substring(0, separatorIndex);
    const id = decoded.substring(separatorIndex + 1);

    if (!created_at || !id) return null;
    return { created_at, id };
  } catch {
    return null;
  }
}

// ============================================================================
// Supabase query helper
// ============================================================================

/**
 * Apply cursor-based pagination to a Supabase query.
 *
 * - Adds ordering (orderColumn DESC, id DESC by default)
 * - If `after` cursor provided, filters to rows after that point
 * - Fetches limit + 1 to determine has_more
 *
 * @example
 * let query = supabase.from("offerings").select("*").eq("community_id", id);
 * query = applyCursorPagination(query, { limit: 20, after: cursor });
 */
export function applyCursorPagination(
  query: any,
  params: { limit: number; after?: string },
  options?: { orderColumn?: string; ascending?: boolean }
) {
  const orderColumn = options?.orderColumn ?? "created_at";
  const ascending = options?.ascending ?? false;

  // Order by the sort column + id for tie-breaking
  query = query
    .order(orderColumn, { ascending })
    .order("id", { ascending });

  // Apply cursor filter if provided
  if (params.after) {
    const cursor = decodeCursor(params.after);
    if (cursor) {
      const modifier = ascending ? "gt" : "lt";
      // PostgREST .or() with compound condition for tie-breaking
      query = query.or(
        `${orderColumn}.${modifier}.${cursor.created_at},and(${orderColumn}.eq.${cursor.created_at},id.${modifier}.${cursor.id})`
      );
    }
  }

  // Fetch one extra to detect has_more
  query = query.limit(params.limit + 1);

  return query;
}

// ============================================================================
// Response builder
// ============================================================================

/**
 * Build a paginated response from query results.
 * Expects rows fetched with limit + 1 (from applyCursorPagination).
 *
 * @example
 * const { data, error } = await query;
 * return successResponse(buildPaginatedResponse(data!, limit));
 */
export function buildPaginatedResponse<
  T extends { id: string; created_at: string | null }
>(rows: T[], limit: number, orderColumn?: string): PaginatedResponse<T> {
  const has_more = rows.length > limit;
  const data = has_more ? rows.slice(0, limit) : rows;

  let next_cursor: string | null = null;
  if (has_more && data.length > 0) {
    const lastItem = data[data.length - 1];
    const cursorValue =
      orderColumn && orderColumn !== "created_at"
        ? (lastItem as any)[orderColumn]
        : lastItem.created_at;

    if (cursorValue) {
      next_cursor = encodeCursor(cursorValue, lastItem.id);
    }
  }

  return {
    data,
    pagination: {
      has_more,
      next_cursor,
      limit,
    },
  };
}
