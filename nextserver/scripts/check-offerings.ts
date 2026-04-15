import './load-env';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const offerings = await prisma.offerings.findMany({
    where: { deleted_at: null },
    select: {
      id: true,
      title: true,
      category: true,
      transaction_type: true,
      status: true,
      provider_id: true,
      community_id: true,
      requires_deposit: true,
      deposit_amount: true,
      availability_schedules: {
        where: { is_active: true },
        select: {
          id: true,
          loan_duration_days: true,
          loan_max_duration_days: true,
          slots_available: true,
          dtstart: true,
          dtend: true,
        },
      },
    },
  });
  console.log(`\n=== Offerings (${offerings.length}) ===`);
  offerings.forEach((o: any) => {
    console.log(`\n  ${o.id}`);
    console.log(`    title: ${o.title}`);
    console.log(`    category: ${o.category}  transaction_type: ${o.transaction_type}`);
    console.log(`    status: ${o.status}  deposit: ${o.requires_deposit} / ${o.deposit_amount}`);
    console.log(`    schedules: ${o.availability_schedules.length}`);
    o.availability_schedules.forEach((s: any) => {
      console.log(
        `      - ${s.id}  dur=${s.loan_duration_days}  max=${s.loan_max_duration_days}  slots=${s.slots_available}`
      );
    });
  });
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
