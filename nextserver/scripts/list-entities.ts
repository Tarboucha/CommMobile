import './load-env';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const profiles = await prisma.profiles.findMany({
    select: { id: true, first_name: true, last_name: true, email: true },
    take: 20,
  });
  console.log('\n=== Profiles ===');
  profiles.forEach((p: any) =>
    console.log(`  ${p.id}  ${p.first_name ?? '?'} ${p.last_name ?? '?'}  <${p.email ?? '-'}>`)
  );

  const communities = await prisma.communities.findMany({
    where: { deleted_at: null },
    select: {
      id: true,
      community_name: true,
      created_by_profile_id: true,
      access_type: true,
    },
    take: 20,
  });
  console.log('\n=== Communities ===');
  communities.forEach((c: any) =>
    console.log(
      `  ${c.id}  "${c.community_name}"  owner=${c.created_by_profile_id}  access=${c.access_type}`
    )
  );

  const members = await prisma.community_members.findMany({
    where: { membership_status: 'active' },
    select: {
      community_id: true,
      profile_id: true,
      member_role: true,
      can_post_offerings: true,
    },
    take: 30,
  });
  console.log('\n=== Active members ===');
  members.forEach((m: any) =>
    console.log(
      `  community=${m.community_id}  profile=${m.profile_id}  role=${m.member_role}  can_post=${m.can_post_offerings}`
    )
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
