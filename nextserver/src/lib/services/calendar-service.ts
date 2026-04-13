import { prisma } from "@/lib/prisma";

interface CalendarEntry {
  booking_id: string;
  booking_number: string;
  title: string;
  category: string;
  status: string;
  time: string | null;
  role: "customer" | "provider";
  other_party_name: string;
  is_loan: boolean;
  loan_due_date: string | null;
  loan_returned_at: string | null;
}

interface CalendarResult {
  dates: Record<string, CalendarEntry[]>;
  event_counts: Record<string, number>;
}

/**
 * Fetches all bookings for a user in a given month, grouped by date.
 * Returns both as-customer and as-provider bookings.
 */
export async function getCalendarMonth(
  userId: string,
  year: number,
  month: number
): Promise<CalendarResult> {
  const fromDate = new Date(Date.UTC(year, month - 1, 1));
  const toDate = new Date(Date.UTC(year, month, 0)); // last day of month

  // Fetch all bookings where user is customer or provider
  // that have items overlapping with this month
  const bookings = await prisma.bookings.findMany({
    where: {
      OR: [{ customer_id: userId }, { provider_id: userId }],
      booking_items: {
        some: {
          OR: [
            // Services/events: instance_date in month
            {
              instance_date: { gte: fromDate, lte: toDate },
              is_loan: false,
            },
            // Loans: loan period overlaps with month
            {
              is_loan: true,
              loan_start_date: { lte: toDate },
              loan_due_date: { gte: fromDate },
            },
          ],
        },
      },
    },
    include: {
      booking_items: {
        select: {
          snapshot_title: true,
          snapshot_category: true,
          is_loan: true,
          instance_date: true,
          instance_start_time: true,
          instance_end_time: true,
          loan_start_date: true,
          loan_due_date: true,
          loan_returned_at: true,
          booking_provider_snapshots: {
            select: { snapshot_display_name: true },
          },
        },
        take: 1,
      },
      booking_customer_snapshots: {
        select: {
          snapshot_display_name: true,
          snapshot_first_name: true,
          snapshot_last_name: true,
        },
      },
    },
    orderBy: { created_at: "desc" },
  });

  const dates: Record<string, CalendarEntry[]> = {};
  const eventCounts: Record<string, number> = {};

  function addEntry(dateStr: string, entry: CalendarEntry) {
    if (!dates[dateStr]) dates[dateStr] = [];
    dates[dateStr].push(entry);
    eventCounts[dateStr] = (eventCounts[dateStr] || 0) + 1;
  }

  function formatYMD(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  for (const b of bookings) {
    const item = b.booking_items[0];
    if (!item) continue;

    const isCustomer = b.customer_id === userId;
    const role: "customer" | "provider" = isCustomer ? "customer" : "provider";

    // Determine other party name
    let otherPartyName = "Unknown";
    if (isCustomer) {
      // Show provider name (from booking_items → booking_provider_snapshots)
      const provSnap = item.booking_provider_snapshots;
      if (provSnap?.snapshot_display_name) otherPartyName = provSnap.snapshot_display_name;
    } else {
      // Show customer name
      const custSnap = b.booking_customer_snapshots;
      if (custSnap?.snapshot_display_name) {
        otherPartyName = custSnap.snapshot_display_name;
      } else if (custSnap?.snapshot_first_name || custSnap?.snapshot_last_name) {
        otherPartyName = [custSnap.snapshot_first_name, custSnap.snapshot_last_name].filter(Boolean).join(" ");
      }
    }

    // Format time
    const time = item.instance_start_time
      ? (item.instance_start_time instanceof Date
          ? `${String(item.instance_start_time.getUTCHours()).padStart(2, "0")}:${String(item.instance_start_time.getUTCMinutes()).padStart(2, "0")}`
          : String(item.instance_start_time).slice(0, 5))
      : null;

    const entry: CalendarEntry = {
      booking_id: b.id,
      booking_number: b.booking_number,
      title: item.snapshot_title,
      category: item.is_loan ? "loan" : (item.snapshot_category ?? "product"),
      status: b.booking_status ?? "pending",
      time,
      role,
      other_party_name: otherPartyName,
      is_loan: item.is_loan,
      loan_due_date: item.loan_due_date ? formatYMD(new Date(item.loan_due_date as any)) : null,
      loan_returned_at: item.loan_returned_at ? new Date(item.loan_returned_at).toISOString() : null,
    };

    if (item.is_loan && item.loan_start_date && item.loan_due_date) {
      // Loans: add entry for each day of loan period within the month
      const loanStart = new Date(item.loan_start_date as any);
      const loanEnd = new Date(item.loan_due_date as any);
      const rangeStart = loanStart < fromDate ? fromDate : loanStart;
      const rangeEnd = loanEnd > toDate ? toDate : loanEnd;

      const cursor = new Date(rangeStart);
      while (cursor <= rangeEnd) {
        addEntry(formatYMD(cursor), entry);
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    } else if (item.instance_date) {
      // Services/events: single date
      addEntry(formatYMD(new Date(item.instance_date as any)), entry);
    } else {
      // Products without date: use created_at
      if (b.created_at) {
        const createdDate = formatYMD(new Date(b.created_at));
        // Only add if within the month
        if (createdDate >= formatYMD(fromDate) && createdDate <= formatYMD(toDate)) {
          addEntry(createdDate, entry);
        }
      }
    }
  }

  // Sort entries within each date by time (timed first, then by time, then untimed)
  for (const dateStr of Object.keys(dates)) {
    dates[dateStr].sort((a, b) => {
      if (a.time && !b.time) return -1;
      if (!a.time && b.time) return 1;
      if (a.time && b.time) return a.time.localeCompare(b.time);
      return 0;
    });
  }

  return { dates, event_counts: eventCounts };
}
