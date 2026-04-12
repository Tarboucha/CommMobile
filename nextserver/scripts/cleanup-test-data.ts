import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Find offerings to delete
  const offerings = await prisma.offerings.findMany({
    where: { title: 'Test Drill (Loan)' },
    select: { id: true },
  });
  const offeringIds = offerings.map((o) => o.id);

  // Find related bookings (via booking_items)
  const bookingItems = await prisma.booking_items.findMany({
    where: { offering_id: { in: offeringIds } },
    select: { booking_id: true },
  });
  const bookingIds = [...new Set(bookingItems.map((i) => i.booking_id))];

  // Delete in dependency order
  const deletedStatusHistory = await prisma.booking_status_history.deleteMany({
    where: { booking_id: { in: bookingIds } },
  });
  const deletedScheduleSnapshots = await prisma.booking_schedule_snapshots.deleteMany({
    where: { booking_item_id: { in: bookingItems.map((_, i) => bookingItems[i].booking_id) } },
  });
  const deletedProviderSnapshots = await prisma.booking_provider_snapshots.deleteMany({
    where: { booking_item_id: { in: bookingItems.map((_, i) => bookingItems[i].booking_id) } },
  });
  const deletedItems = await prisma.booking_items.deleteMany({
    where: { booking_id: { in: bookingIds } },
  });
  const deletedCustomerSnapshots = await prisma.booking_customer_snapshots.deleteMany({
    where: { booking_id: { in: bookingIds } },
  });
  const deletedDeliverySnapshots = await prisma.booking_delivery_snapshots.deleteMany({
    where: { booking_id: { in: bookingIds } },
  });
  const deletedCommunitySnapshots = await prisma.booking_community_snapshots.deleteMany({
    where: { booking_id: { in: bookingIds } },
  });
  const deletedBookings = await prisma.bookings.deleteMany({
    where: { id: { in: bookingIds } },
  });

  // Clear schedule_instances for the test offering's schedules
  const schedules = await prisma.availability_schedules.findMany({
    where: { offering_id: { in: offeringIds } },
    select: { id: true },
  });
  const scheduleIds = schedules.map((s) => s.id);
  const deletedInstances = await prisma.schedule_instances.deleteMany({
    where: { schedule_id: { in: scheduleIds } },
  });
  const deletedSchedules = await prisma.availability_schedules.deleteMany({
    where: { offering_id: { in: offeringIds } },
  });

  const deletedOfferings = await prisma.offerings.deleteMany({
    where: { id: { in: offeringIds } },
  });

  console.log(`Deleted:
  - ${deletedOfferings.count} offering(s)
  - ${deletedSchedules.count} schedule(s)
  - ${deletedInstances.count} schedule_instance(s)
  - ${deletedBookings.count} booking(s)
  - ${deletedItems.count} booking_item(s)
  - ${deletedStatusHistory.count} status history entries
  - ${deletedCustomerSnapshots.count} customer snapshots
  - ${deletedDeliverySnapshots.count} delivery snapshots
  - ${deletedCommunitySnapshots.count} community snapshots
  - ${deletedProviderSnapshots.count} provider snapshots
  - ${deletedScheduleSnapshots.count} schedule snapshots`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
