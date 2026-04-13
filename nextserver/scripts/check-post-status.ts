import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
async function main() {
  const rows = await prisma.$queryRawUnsafe<{ conname: string; def: string }[]>(
    `SELECT conname, pg_get_constraintdef(oid) AS def
     FROM pg_constraint
     WHERE conrelid = 'public.community_posts'::regclass AND contype = 'c'`
  );
  console.log(rows);
}
main().then(()=>process.exit(0));
