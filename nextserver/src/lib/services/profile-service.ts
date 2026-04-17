import { prisma } from "@/lib/prisma";
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from "@/lib/errors/domain-errors";

// ============================================================================
// Profile CRUD
// ============================================================================

export async function getProfile(profileId: string, userId: string) {
  if (userId !== profileId) {
    throw new ForbiddenError("You can only access your own profile");
  }

  const profile = await prisma.profiles.findFirst({
    where: { id: profileId, deleted_at: null },
  });

  if (!profile) throw new NotFoundError("Profile");
  return profile;
}

export async function updateProfile(
  profileId: string,
  userId: string,
  rawData: Record<string, any>
) {
  if (userId !== profileId) {
    throw new ForbiddenError("You can only update your own profile");
  }

  if (rawData.avatar_url !== undefined) {
    throw new ValidationError(
      "Cannot update avatar_url directly. Use POST /api/v1/profiles/:profileId/avatar/sign + POST /api/v1/profiles/:profileId/avatar."
    );
  }

  const editableFields = [
    "first_name",
    "last_name",
    "display_name",
    "bio",
    "phone",
    "preferred_language",
  ] as const;

  const updateFields: Record<string, any> = {};
  for (const field of editableFields) {
    if (rawData[field] !== undefined) {
      const value = rawData[field];
      updateFields[field] = value === "" ? null : value;
    }
  }

  if (Object.keys(updateFields).length === 0) {
    const profile = await prisma.profiles.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundError("Profile");
    return profile;
  }

  return prisma.profiles.update({
    where: { id: profileId },
    data: {
      ...updateFields,
      updated_at: new Date(),
    },
  });
}

// ============================================================================
// Avatar — read-only accessor; mutation lives in storage-service
// ============================================================================

export async function getAvatar(profileId: string, userId: string) {
  if (userId !== profileId) {
    throw new ForbiddenError("You can only access your own profile");
  }

  const profile = await prisma.profiles.findUnique({
    where: { id: profileId },
    select: { id: true, avatar_url: true },
  });

  if (!profile) throw new NotFoundError("Profile");
  return { avatar_url: profile.avatar_url };
}
