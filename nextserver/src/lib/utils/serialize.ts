/**
 * Recursively converts Prisma Decimal values to plain JavaScript numbers
 * so they serialize correctly in JSON responses and match the frontend's
 * expected type (number, not string).
 *
 * Also converts Date objects to ISO strings for consistency with the
 * previous Supabase REST API response format.
 *
 * Uses duck-typing to detect Decimal (has .toNumber() method) instead of
 * instanceof to avoid coupling to the Prisma runtime import path.
 */
export function serialize<T>(value: T): T {
  if (value === null || value === undefined) return value;

  // Date
  if (value instanceof Date) {
    return value.toISOString() as any;
  }

  // Prisma Decimal (duck-typed: has toNumber method)
  if (
    typeof value === "object" &&
    typeof (value as any).toNumber === "function" &&
    typeof (value as any).toFixed === "function"
  ) {
    return (value as any).toNumber();
  }

  // Array
  if (Array.isArray(value)) {
    return value.map((item) => serialize(item)) as any;
  }

  // Plain object
  if (typeof value === "object" && (value as any).constructor === Object) {
    const result: any = {};
    for (const key in value) {
      result[key] = serialize((value as any)[key]);
    }
    return result;
  }

  return value;
}
