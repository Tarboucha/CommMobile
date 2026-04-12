import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  for (const table of ['offerings', 'community_posts']) {
    console.log(`\n=== ${table} ===`);
    const rows = await prisma.$queryRawUnsafe<{ conname: string; def: string }[]>(
      `SELECT conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint
       WHERE conrelid = $1::regclass AND contype = 'c'`,
      `public.${table}`
    );
    rows.forEach((r) => console.log(`  ${r.conname}: ${r.def}`));
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
