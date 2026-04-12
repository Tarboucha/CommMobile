import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

/**
 * Simulates what the POST /api/bookings route sends to
 * create_booking_with_items for a loan. Requires an existing loan offering
 * with an active schedule.
 */
async function main() {
  // Find a loan offering with an active schedule
  const loanOffering = await prisma.offerings.findFirst({
    where: {
      transaction_type: 'loan',
      deleted_at: null,
      status: 'active',
      availability_schedules: { some: { is_active: true } },
    },
    include: {
      availability_schedules: { where: { is_active: true }, take: 1 },
    },
  });

  if (!loanOffering) {
    console.log('No loan offering found. Create one via the app first.');
    return;
  }

  const schedule = loanOffering.availability_schedules[0];
  console.log('\n=== Test loan offering ===');
  console.log(`  id: ${loanOffering.id}`);
  console.log(`  title: ${loanOffering.title}`);
  console.log(`  provider_id: ${loanOffering.provider_id}`);
  console.log(`  price_amount: ${loanOffering.price_amount}`);
  console.log(`  requires_deposit: ${loanOffering.requires_deposit}`);
  console.log(`  deposit_amount: ${loanOffering.deposit_amount}`);
  console.log(`  schedule_id: ${schedule.id}`);
  console.log(`  loan_duration_days: ${schedule.loan_duration_days}`);

  // Find a customer profile (not the provider)
  const customer = await prisma.profiles.findFirst({
    where: { id: { not: loanOffering.provider_id } },
  });
  if (!customer) {
    console.log('No other profile found for customer');
    return;
  }
  console.log(`\n=== Using customer ===`);
  console.log(`  id: ${customer.id}`);

  // Build dates
  const today = new Date();
  const startDate = today.toISOString().split('T')[0];
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + (schedule.loan_duration_days ?? 1) - 1);
  const dueDateStr = dueDate.toISOString().split('T')[0];

  const price = Number(loanOffering.price_amount ?? 0);
  const deposit = loanOffering.requires_deposit && loanOffering.deposit_amount
    ? Number(loanOffering.deposit_amount)
    : 0;

  const bookingData = {
    customer_id: customer.id,
    provider_id: loanOffering.provider_id,
    community_id: loanOffering.community_id,
    idempotency_key: crypto.randomUUID(),
    payment_method: 'cash',
    delivery_address_id: null,
    special_instructions: null,
    currency_code: loanOffering.currency_code ?? 'EUR',
    subtotal_amount: price,
    service_fee_amount: 0,
    total_amount: price + deposit,
    deposit_total: deposit,
    deposit_status: deposit > 0 ? 'held' : 'none',
  };

  const itemsData = [
    {
      offering_id: loanOffering.id,
      offering_version: loanOffering.version ?? 1,
      quantity: 1,
      fulfillment_method: loanOffering.fulfillment_method ?? 'pickup',
      schedule_id: schedule.id,
      instance_date: startDate,
      unit_price_amount: price,
      total_amount: price,
      delivery_fee_amount: 0,
      currency_code: loanOffering.currency_code ?? 'EUR',
      snapshot_title: loanOffering.title,
      snapshot_description: loanOffering.description ?? null,
      snapshot_image_url: null,
      snapshot_category: loanOffering.category,
      snapshot_transaction_type: 'loan',
      special_instructions: null,
      is_loan: true,
      loan_start_date: startDate,
      loan_due_date: dueDateStr,
      deposit_amount: deposit,
    },
  ];

  console.log('\n=== Calling create_booking_with_items ===');
  console.log('booking:', JSON.stringify(bookingData, null, 2));
  console.log('items:', JSON.stringify(itemsData, null, 2));

  try {
    const result = await prisma.$queryRawUnsafe(
      `SELECT create_booking_with_items($1::jsonb, $2::jsonb) AS booking_id`,
      JSON.stringify(bookingData),
      JSON.stringify(itemsData)
    );
    console.log('\n=== SUCCESS ===');
    console.log(result);
  } catch (e: any) {
    console.log('\n=== RPC ERROR ===');
    console.log('Message:', e.message);
    if (e.meta) console.log('Meta:', e.meta);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
