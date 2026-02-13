import { NextRequest } from "next/server";
import { successResponse, handleUnsupportedMethod, ApiErrors } from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";
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
 * Users can only access their own profile
 */
export const GET = withAuth<ProfileAvatarParams>(async (user, _request, params) => {
  const { profileId } = params!;

  // Verify user has permission
  if (user.id !== profileId) {
    return ApiErrors.forbidden("You can only access your own profile");
  }

  const supabase = await createClient();

  // Verify profile exists
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, avatar_url")
    .eq("id", profileId)
    .single();

  if (profileError || !profile) {
    return ApiErrors.notFound("Profile not found");
  }

  return successResponse({
    avatar_url: profile.avatar_url,
  });
});

/**
 * DELETE /api/profiles/[profileId]/avatar
 * Delete avatar for a profile (sets avatar_url to null and deletes storage file)
 * Users can only delete from their own profile
 */
export const DELETE = withAuth<ProfileAvatarParams>(
  async (user, _request, params) => {
    const { profileId } = params!;

    // Verify user has permission
    if (user.id !== profileId) {
      return ApiErrors.forbidden("You can only delete avatars from your own profile");
    }

    const supabase = await createClient();

    // Verify profile exists
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, avatar_url")
      .eq("id", profileId)
      .single();

    if (profileError || !profile) {
      return ApiErrors.notFound("Profile not found");
    }

    // Get existing avatar URL for cleanup (BEFORE database update)
    const existingAvatarUrl = profile.avatar_url;

    // Update database (set avatar_url to null) - do this FIRST like meal images
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", profileId);

    if (updateError) {
      console.error("Failed to delete profile avatar:", updateError);
      return ApiErrors.serverError();
    }

    // Cleanup storage file with retry logic (best effort - don't fail if cleanup fails)
    // This happens AFTER database update, same order as meal images
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
          // Cleanup failed after retries - log structured error for monitoring
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

          // Don't fail the request - DB record is already updated
          // The orphaned file can be cleaned up manually or via a cleanup job
        }
      }
    }

    return successResponse(
      {
        message: "Avatar deleted successfully",
      },
      undefined,
      200
    );
  }
);

// Catch unsupported methods
export async function POST() {
  return handleUnsupportedMethod(["GET", "DELETE"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["GET", "DELETE"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["GET", "DELETE"]);
}

