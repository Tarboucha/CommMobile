import { prisma } from "@/lib/prisma";
import { NotCommunityMemberError, ForbiddenError } from "@/lib/errors/domain-errors";

interface MemberResult {
  id: string;
  profile_id: string;
  community_id: string;
  member_role: string;
  membership_status: string;
  can_post_offerings: boolean | null;
  can_invite_members: boolean | null;
}

interface Options {
  /** Require one of these roles (e.g., ['owner', 'admin']) */
  requiredRoles?: string[];
  /** Require the can_post_offerings permission */
  requireCanPost?: boolean;
  /** Require the can_invite_members permission */
  requireCanInvite?: boolean;
}

/**
 * Asserts that the user is an active member of the community.
 * Optionally checks role and permission flags.
 * Throws NotCommunityMemberError or ForbiddenError on failure.
 * Returns the membership record on success.
 */
export async function assertCommunityMember(
  communityId: string,
  userId: string,
  options?: Options
): Promise<MemberResult> {
  const member = await prisma.community_members.findFirst({
    where: {
      community_id: communityId,
      profile_id: userId,
      membership_status: "active",
    },
    select: {
      id: true,
      profile_id: true,
      community_id: true,
      member_role: true,
      membership_status: true,
      can_post_offerings: true,
      can_invite_members: true,
    },
  });

  if (!member) throw new NotCommunityMemberError();

  if (options?.requiredRoles && !options.requiredRoles.includes(member.member_role ?? '')) {
    throw new ForbiddenError(
      `This action requires one of the following roles: ${options.requiredRoles.join(", ")}`
    );
  }

  if (options?.requireCanPost && !member.can_post_offerings) {
    throw new ForbiddenError("You do not have permission to post offerings in this community");
  }

  if (options?.requireCanInvite && !member.can_invite_members) {
    throw new ForbiddenError("You do not have permission to invite members");
  }

  return member as MemberResult;
}
