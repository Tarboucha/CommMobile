import { successResponse, handleUnsupportedMethod, ApiErrors } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  STORAGE_BUCKETS,
  FILE_SIZE_LIMITS,
  buildAvatarPath,
  uploadToStorage,
  deleteByKey,
  listFiles,
  validateImageFile,
  parseFormDataWithFile,
} from "@/lib/utils/storage-server";
import {
  retryOperation,
  logStorageError,
  StorageErrorType,
} from "@/lib/utils/retry";

interface ProfileAvatarUploadParams {
  profileId: string;
}

/**
 * POST /api/profiles/[profileId]/avatar/upload
 * Upload a new avatar image file for a profile (replaces existing if any)
 * Users can only upload to their own profile
 */
export const POST = withAuth<ProfileAvatarUploadParams>(
  async (user, request, params) => {
    const { profileId } = params!;

    if (user.id !== profileId) {
      return ApiErrors.forbidden("You can only upload avatars to your own profile");
    }

    const profile = await prisma.profiles.findUnique({
      where: { id: profileId },
      select: { id: true, avatar_url: true },
    });

    if (!profile) {
      return ApiErrors.notFound("Profile not found");
    }

    const parseResult = await parseFormDataWithFile(request);
    if (parseResult.error) {
      return ApiErrors.badRequest(parseResult.error);
    }

    const { file } = parseResult;
    if (!file) {
      return ApiErrors.badRequest("No file provided");
    }

    const validation = await validateImageFile(file, FILE_SIZE_LIMITS.AVATAR);
    if (!validation.valid) {
      return ApiErrors.badRequest(validation.error || "Invalid file");
    }

    const timestamp = Date.now();
    const profileIdForPath = profile.id;
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filename = `${profileIdForPath}-${timestamp}.${extension}`;
    const filePath = buildAvatarPath(profileIdForPath, filename);

    // Delete old avatar files (best effort)
    const cleanupResult = await retryOperation(
      async () => {
        const oldKeys = await listFiles(STORAGE_BUCKETS.PROFILE_AVATARS, profileIdForPath);
        for (const key of oldKeys) {
          await deleteByKey(key);
        }
        return true;
      },
      {
        maxAttempts: 3,
        delayMs: 100,
        backoffMultiplier: 2,
        operationName: "Cleanup old avatar files",
      }
    );

    if (!cleanupResult.success) {
      console.warn(
        `[Avatar Upload] Failed to cleanup old files after ${cleanupResult.attempts} attempts`
      );
      logStorageError({
        type: StorageErrorType.CLEANUP_FAILED,
        bucket: STORAGE_BUCKETS.PROFILE_AVATARS,
        path: profileIdForPath,
        storagePath: `${STORAGE_BUCKETS.PROFILE_AVATARS}/${profileIdForPath}`,
        resourceId: profileIdForPath,
        resourceType: "profile-avatar",
        timestamp: new Date().toISOString(),
        retryCount: cleanupResult.attempts,
        originalError: cleanupResult.error?.message,
      });
    }

    const fileBuffer = await file.arrayBuffer();
    let lastUploadedPath: string | null = null;

    const uploadResult = await retryOperation(
      async () => {
        const storagePath = await uploadToStorage(
          STORAGE_BUCKETS.PROFILE_AVATARS,
          filePath,
          fileBuffer,
          file.type
        );

        if (!storagePath) {
          throw new Error("Failed to upload file to storage");
        }

        lastUploadedPath = storagePath;

        const updatedProfile = await prisma.profiles.update({
          where: { id: profileId },
          data: { avatar_url: storagePath },
        });

        return { updatedProfile, storagePath, filePath };
      },
      {
        maxAttempts: 3,
        delayMs: 100,
        backoffMultiplier: 2,
        operationName: "Upload profile avatar",
      }
    );

    if (!uploadResult.success) {
      if (lastUploadedPath) {
        const orphanCleanup = await retryOperation(
          async () => {
            const deleted = await deleteByKey(lastUploadedPath!);
            if (!deleted) throw new Error("Storage delete returned false");
            return deleted;
          },
          {
            maxAttempts: 3,
            delayMs: 100,
            backoffMultiplier: 2,
            operationName: "Cleanup orphaned avatar file",
          }
        );

        if (orphanCleanup.success) {
          return ApiErrors.serverError("Failed to save avatar. Please try again.");
        } else {
          logStorageError({
            type: StorageErrorType.ORPHANED_FILE,
            bucket: STORAGE_BUCKETS.PROFILE_AVATARS,
            path: lastUploadedPath,
            storagePath: lastUploadedPath,
            resourceId: profileIdForPath,
            resourceType: "profile-avatar",
            timestamp: new Date().toISOString(),
            retryCount: orphanCleanup.attempts,
            originalError: uploadResult.error?.message,
          });
          return ApiErrors.serverError(
            "Failed to save avatar. Please contact support if this issue persists."
          );
        }
      } else {
        logStorageError({
          type: StorageErrorType.DB_INSERT_FAILED,
          bucket: STORAGE_BUCKETS.PROFILE_AVATARS,
          path: "unknown",
          storagePath: "unknown",
          resourceId: profileIdForPath,
          resourceType: "profile-avatar",
          timestamp: new Date().toISOString(),
          retryCount: uploadResult.attempts,
          originalError: uploadResult.error?.message,
        });
        return ApiErrors.serverError("Failed to save avatar. Please try again.");
      }
    }

    return successResponse(
      { profile: uploadResult.result!.updatedProfile },
      undefined,
      201
    );
  }
);

export async function GET() {
  return handleUnsupportedMethod(["POST"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["POST"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["POST"]);
}

export async function DELETE() {
  return handleUnsupportedMethod(["POST"]);
}
