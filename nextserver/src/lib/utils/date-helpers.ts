/**
 * Helpers for converting between API string formats and Prisma Date objects.
 * Used by schedule routes that store @db.Date and @db.Time columns.
 *
 * Prisma's @db.Date expects a JS Date (takes the date part).
 * Prisma's @db.Time expects a JS Date (takes the time part, anchored to 1970-01-01).
 */

/** "2026-04-12" → Date (midnight UTC) */
export function dateFromYMD(ymd: string): Date {
  return new Date(`${ymd}T00:00:00Z`);
}

/** "09:00" → Date (1970-01-01T09:00:00Z) */
export function timeFromHHMM(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00Z`);
}

/**
 * Converts a Prisma TIME value (Date, string, or unknown) to "HH:MM" format.
 * Handles: "09:00:00", "1970-01-01T09:00:00.000Z", Date objects.
 */
export function formatTime(value: unknown): string {
  if (typeof value === "string") {
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
      return value.slice(0, 5);
    }
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
    }
  }
  if (value instanceof Date) {
    return `${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}`;
  }
  return String(value).slice(0, 5);
}
