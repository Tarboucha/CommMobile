# Cursor-Based Pagination

## Why cursor-based?

- Constant O(1) performance regardless of page depth (offset gets slower the deeper you go)
- No skipped/duplicated items when data changes between page fetches
- No separate COUNT query needed — uses `limit + 1` trick

## How it works

The cursor is an opaque base64 string encoding `created_at|id` of the last item seen. The client passes it back as `?after=<cursor>` to get the next page.

Composite key (`created_at` + `id`) handles timestamp ties — two rows created at the same millisecond won't cause ambiguity.

## File

`nextserver/src/lib/utils/pagination.ts`

## Exports

### Types

```typescript
interface PaginationMeta {
  has_more: boolean;
  next_cursor: string | null;
  limit: number;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}
```

### Cursor helpers

```typescript
encodeCursor(created_at: string, id: string): string
decodeCursor(cursor: string): { created_at: string; id: string }
```

### Zod schema

```typescript
paginationSchema = z.object({
  limit: numberFromString.optional().default(20),  // clamped to 1-100
  after: z.string().optional(),
})
```

Routes extend with their own filters:

```typescript
const offeringsQuerySchema = paginationSchema.extend({
  category: z.string().optional(),
  status: z.enum(["active", "paused"]).optional(),
  community_id: z.string().uuid().optional(),
});
```

### Supabase query helper

```typescript
applyCursorPagination(query, { limit, after }, options?)
```

1. Adds `.order(created_at, desc)` + `.order(id, desc)` for tie-breaking
2. If `after` cursor provided: decodes it, filters with `.or()` to get rows after that point
3. Sets `.limit(limit + 1)` — extra row determines `has_more` without a count query

### Response builder

```typescript
buildPaginatedResponse(rows, limit)
```

1. If `rows.length > limit` → `has_more = true`, slices to `limit`
2. Builds `next_cursor` from last item's `created_at` + `id`
3. Returns `{ data, pagination }`

## API contract

### Request

```
GET /api/offerings?limit=10&category=food                → first page, filtered
GET /api/offerings?limit=10&category=food&after=eyJj...  → next page, same filters
```

### Response

```json
{
  "success": true,
  "data": {
    "data": [...],
    "pagination": {
      "has_more": true,
      "next_cursor": "eyJjcmVhdGVkX2F0IjoiMjAyNC0wMS0xNVQxMDozMDowMC4wMDBaIiwiaWQiOiJhYmMtMTIzIn0=",
      "limit": 10
    }
  }
}
```

### Client rules

- When filters change → drop cursor, start fresh
- When scrolling → pass `next_cursor` as `after` with the same filters
- `has_more: false` → no more pages

## Route usage example

```typescript
import { paginationSchema, applyCursorPagination, buildPaginatedResponse } from "@/lib/utils/pagination";

const offeringsQuerySchema = paginationSchema.extend({
  category: z.string().optional(),
  community_id: z.string().uuid().optional(),
});

export const GET = withAuth(async (user, request) => {
  const searchParams = Object.fromEntries(new URL(request.url).searchParams.entries());
  const { limit, after, category, community_id } = offeringsQuerySchema.parse(searchParams);

  const supabase = await createClient();
  let query = supabase.from("offerings").select("*");

  if (category) query = query.eq("category", category);
  if (community_id) query = query.eq("community_id", community_id);

  query = applyCursorPagination(query, { limit, after });

  const { data, error } = await query;
  if (error) return ApiErrors.serverError();

  return successResponse(buildPaginatedResponse(data!, limit));
});
```
