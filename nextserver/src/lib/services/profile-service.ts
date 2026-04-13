import { prisma } from "@/lib/prisma";
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from "@/lib/errors/domain-errors";
import {
  deleteFromStorage,
  extractStorageInfo,
} from "@/lib/utils/storage-server";
import {
  retryOperation,
  logStorageError,
  StorageErrorType,
} from "@/lib/utils/retry";

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
      "Cannot update avatar_url. Use POST /api/profiles/:profileId/avatar/upload to upload an avatar, or DELETE /api/profiles/:profileId/avatar to remove it."
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
    // No fields to update — return current profile
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
// Avatar
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

export async function deleteAvatar(profileId: string, userId: string) {
  if (userId !== profileId) {
    throw new ForbiddenError("You can only delete avatars from your own profile");
  }

  const profile = await prisma.profiles.findUnique({
    where: { id: profileId },
    select: { id: true, avatar_url: true },
  });

  if (!profile) throw new NotFoundError("Profile");

  const existingAvatarUrl = profile.avatar_url;

  await prisma.profiles.update({
    where: { id: profileId },
    data: { avatar_url: null },
  });

  // Cleanup storage file with retry logic (best effort)
  if (existingAvatarUrl) {
    const storageInfo = extractStorageInfo(existingAvatarUrl);

    if (storageInfo) {
      const cleanupResult = await retryOperation(
        async () => {
          const deleted = await deleteFromStorage(
            storageInfo.bucket,
            storageInfo.path
          );
          if (!deleted) {
            throw new Error("Storage delete returned false");
          }
          return deleted;
        },
        {
          maxAttempts: 3,
          delayMs: 100,
          backoffMultiplier: 2,
          operationName: "Delete profile avatar from storage",
        }
      );

      if (!cleanupResult.success) {
        logStorageError({
          type: StorageErrorType.CLEANUP_FAILED,
          bucket: storageInfo.bucket,
          path: storageInfo.path,
          storagePath: existingAvatarUrl,
          resourceId: profileId,
          resourceType: "profile-avatar",
          timestamp: new Date().toISOString(),
          retryCount: cleanupResult.attempts,
          originalError: cleanupResult.error?.message,
        });
      }
    }
  }
}
