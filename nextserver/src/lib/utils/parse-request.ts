import type { NextRequest } from "next/server";
import type { z } from "zod";
import { ValidationError } from "@/lib/errors/domain-errors";
import { parseZodError } from "@/lib/utils/api-response";

/**
 * Parse and validate a JSON request body against a Zod schema.
 * Throws ValidationError (domain error) on invalid JSON or validation failure.
 *
 * Replaces the repeated try/catch + safeParse pattern in 12+ routes:
 *
 *   // Before (12 lines, in every route):
 *   let rawData;
 *   try { rawData = await request.json(); }
 *   catch { return ApiErrors.badRequest("Invalid JSON"); }
 *   const validation = schema.safeParse(rawData);
 *   if (!validation.success) return ApiErrors.validationError(parseZodError(...));
 *   const input = validation.data;
 *
 *   // After (1 line):
 *   const input = await parseJsonBody(request, schema);
 */
export async function parseJsonBody<T>(
  request: NextRequest,
  schema: z.ZodType<T>
): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ValidationError("Invalid JSON in request body");
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError(parseZodError(result.error));
  }

  return result.data;
}
