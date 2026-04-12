import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { createOfferingSchema, createScheduleSchema } from '../src/lib/validations/offering';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

/**
 * Simulates the route logic (validation + insertion) for creating a loan
 * offering with a schedule. Must match what src/app/api/... does.
 */
async function main() {
  const member = await prisma.community_members.findFirst({
    where: { membership_status: 'active', can_post_offerings: true },
  });
  if (!member) {
    console.log('No member with posting permissions found');
    return;
  }
  console.log(`Using member ${member.profile_id} in community ${member.community_id}`);

  // ─── Offering ────────────────────────────────────────────────────────────
  const offeringInput = {
    title: 'Test Drill (Loan)',
    description: 'A loaner drill for community members',
    category: 'product',
    transaction_type: 'loan',
    price_type: 'free',
    fulfillment_method: 'pickup',
    requires_deposit: true,
    deposit_amount: 50,
    currency_code: 'EUR',
  };

  const offeringValidation = createOfferingSchema.safeParse(offeringInput);
  if (!offeringValidation.success) {
    console.log('\n=== OFFERING VALIDATION FAILED ===');
    console.log(JSON.stringify(offeringValidation.error.issues, null, 2));
    return;
  }
  console.log('\n=== Offering validation passed ===');

  const offering = await prisma.offerings.create({
    data: {
      ...offeringValidation.data,
      community_id: member.community_id,
      provider_id: member.profile_id,
      status: 'active',
      version: 1,
    },
  });
  console.log(`Offering created: ${offering.id}`);

  // ─── Schedule (mirrors the route logic exactly) ──────────────────────────
  const scheduleInput = {
    rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
    dtstart: new Date().toISOString().split('T')[0],
    dtend: null,
    start_time: '09:00',
    end_time: '18:00',
    slots_available: 1,
    is_active: true,
    loan_duration_days: 7,
    loan_max_duration_days: 14,
  };

  const scheduleValidation = createScheduleSchema.safeParse(scheduleInput);
  if (!scheduleValidation.success) {
    console.log('\n=== SCHEDULE VALIDATION FAILED ===');
    console.log(JSON.stringify(scheduleValidation.error.issues, null, 2));
    return;
  }
  console.log('\n=== Schedule validation passed ===');

  const input = scheduleValidation.data;
  const schedule = await prisma.availability_schedules.create({
    data: {
      offering_id: offering.id,
      rrule: input.rrule,
      dtstart: new Date(`${input.dtstart}T00:00:00Z`),
      dtend: input.dtend ? new Date(`${input.dtend}T00:00:00Z`) : null,
      start_time: new Date(`1970-01-01T${input.start_time}:00Z`),
      end_time: new Date(`1970-01-01T${input.end_time}:00Z`),
      slots_available: input.slots_available,
      is_active: input.is_active,
      ...(input.loan_duration_days !== undefined && {
        loan_duration_days: input.loan_duration_days,
      }),
      ...(input.loan_max_duration_days !== undefined && {
        loan_max_duration_days: input.loan_max_duration_days,
      }),
    },
  });

  console.log(`\n=== Schedule created ===`);
  console.log(`  id: ${schedule.id}`);
  console.log(`  dtstart: ${schedule.dtstart}`);
  console.log(`  start_time: ${schedule.start_time}`);
  console.log(`  loan_duration_days: ${schedule.loan_duration_days}`);
  console.log(`  loan_max_duration_days: ${schedule.loan_max_duration_days}`);

  console.log('\n=== ALL SUCCESS ===');
  console.log(`Offering ID: ${offering.id}`);
  console.log(`Schedule ID: ${schedule.id}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
