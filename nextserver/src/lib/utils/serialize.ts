/**
 * Recursively converts Prisma Decimal values to plain JavaScript numbers
 * and Date objects to ISO strings, so JSON responses match the frontend's
 * expected types.
 *
 * Uses duck-typing to detect Decimal (has .toNumber() + .toFixed() methods)
 * instead of instanceof to avoid coupling to the Prisma runtime import path.
 */

interface DecimalLike {
  toNumber(): number;
  toFixed(digits?: number): string;
}

function isDecimalLike(value: unknown): value is DecimalLike {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).toNumber === "function" &&
    typeof (value as Record<string, unknown>).toFixed === "function"
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

export function serialize(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (value instanceof Date) return value.toISOString();

  if (isDecimalLike(value)) return value.toNumber();

  if (Array.isArray(value)) return value.map((item) => serialize(item));

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const key in value) {
      result[key] = serialize(value[key]);
    }
    return result;
  }

  return value;
}
