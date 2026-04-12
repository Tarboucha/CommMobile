import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Check that the new helper functions exist
  const fns = await prisma.$queryRawUnsafe<{ proname: string }[]>(
    `SELECT proname FROM pg_proc
     WHERE proname IN (
       'create_booking_with_items',
       'get_effective_slots',
       'get_available_slots',
       'reserve_slots_for_date',
       'reserve_slots_for_range',
       'return_loan_item',
       'insert_booking',
       'insert_booking_item'
     )
     ORDER BY proname`
  );
  console.log('\n=== Installed RPC functions ===');
  fns.forEach((f) => console.log('  ' + f.proname));

  // Check that the new columns exist on bookings
  const bookingCols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='bookings'
     AND column_name IN ('deposit_total', 'deposit_status', 'provider_id')
     ORDER BY column_name`
  );
  console.log('\n=== bookings loan columns ===');
  bookingCols.forEach((c) => console.log('  ' + c.column_name));

  // Check new booking_items columns
  const itemCols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='booking_items'
     AND column_name IN ('is_loan','loan_start_date','loan_due_date','deposit_amount','snapshot_transaction_type')
     ORDER BY column_name`
  );
  console.log('\n=== booking_items loan columns ===');
  itemCols.forEach((c) => console.log('  ' + c.column_name));

  // Check schedule loan columns
  const schedCols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='availability_schedules'
     AND column_name IN ('loan_duration_days','loan_max_duration_days')
     ORDER BY column_name`
  );
  console.log('\n=== availability_schedules loan columns ===');
  schedCols.forEach((c) => console.log('  ' + c.column_name));

  // Check booking_schedule_snapshots loan columns
  const snapCols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='booking_schedule_snapshots'
     AND column_name IN ('snapshot_loan_duration_days','snapshot_loan_max_duration_days','exception_override_loan_duration_days')
     ORDER BY column_name`
  );
  console.log('\n=== booking_schedule_snapshots loan columns ===');
  snapCols.forEach((c) => console.log('  ' + c.column_name));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
