import { NextRequest } from "next/server";
import { successResponse, handleUnsupportedMethod, ApiErrors } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  deleteFromStorage,
  extractStorageInfo,
  STORAGE_BUCKETS,
} from "@/lib/utils/storage-server";
import {
  retryOperation,
  logStorageError,
  StorageErrorType,
} from "@/lib/utils/retry";

interface ProfileAvatarParams {
  profileId: string;
}

/**
 * GET /api/profiles/[profileId]/avatar
 * Get current avatar URL for a profile
 */
export const GET = withAuth<ProfileAvatarParams>(async (user, _request, params) => {
  const { profileId } = params!;

  if (user.id !== profileId) {
    return ApiErrors.forbidden("You can only access your own profile");
  }

  const profile = await prisma.profiles.findUnique({
    where: { id: profileId },
    select: { id: true, avatar_url: true },
  });

  if (!profile) {
    return ApiErrors.notFound("Profile not found");
  }

  return successResponse({
    avatar_url: profile.avatar_url,
  });
});

/**
 * DELETE /api/profiles/[profileId]/avatar
 * Delete avatar for a profile (sets avatar_url to null and deletes storage file)
 */
export const DELETE = withAuth<ProfileAvatarParams>(
  async (user, _request, params) => {
    const { profileId } = params!;

    if (user.id !== profileId) {
      return ApiErrors.forbidden("You can only delete avatars from your own profile");
    }

    const profile = await prisma.profiles.findUnique({
      where: { id: profileId },
      select: { id: true, avatar_url: true },
    });

    if (!profile) {
      return ApiErrors.notFound("Profile not found");
    }

    const existingAvatarUrl = profile.avatar_url;

    try {
      await prisma.profiles.update({
        where: { id: profileId },
        data: { avatar_url: null },
      });
    } catch (error) {
      console.error("Failed to delete profile avatar:", error);
      return ApiErrors.serverError();
    }

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

    return successResponse(
      { message: "Avatar deleted successfully" },
      undefined,
      200
    );
  }
);

export async function POST() {
  return handleUnsupportedMethod(["GET", "DELETE"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["GET", "DELETE"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["GET", "DELETE"]);
}
