import { z } from "zod";

const numberFromString = z.preprocess((value) => {
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return value;
}, z.number());

/**
 * Base pagination schema — routes extend this with their own filters.
 *
 * @example
 * const offeringsQuerySchema = paginationSchema.extend({
 *   category: z.string().optional(),
 *   community_id: z.string().uuid().optional(),
 * });
 */
export const paginationSchema = z.object({
  limit: numberFromString
    .optional()
    .default(1000)
    .transform((v) => Math.min(Math.max(v, 1), 1000)),
  after: z.string().optional(),
});

export type PaginationParams = z.infer<typeof paginationSchema>;
