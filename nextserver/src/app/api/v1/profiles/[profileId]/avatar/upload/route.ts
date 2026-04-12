import { successResponse, handleUnsupportedMethod, ApiErrors } from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  STORAGE_BUCKETS,
  FILE_SIZE_LIMITS,
  buildAvatarPath,
  uploadToStorage,
  deleteFromStorage,
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

    // Verify user has permission
    if (user.id !== profileId) {
      return ApiErrors.forbidden("You can only upload avatars to your own profile");
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

    // Parse multipart/form-data
    const parseResult = await parseFormDataWithFile(request);
    if (parseResult.error) {
      return ApiErrors.badRequest(parseResult.error);
    }

    const { file } = parseResult;

    // Validate file is present
    if (!file) {
      return ApiErrors.badRequest("No file provided");
    }

    // Validate file (size and type)
    const validation = await validateImageFile(file, FILE_SIZE_LIMITS.AVATAR);
    if (!validation.valid) {
      return ApiErrors.badRequest(validation.error || "Invalid file");
    }

    // Generate timestamp ONCE before retry (like UUID for meal images)
    // CRITICAL: Generate before retry to ensure consistency
    const timestamp = Date.now(); // Unix timestamp in milliseconds
    const profileIdForPath = profile.id;
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filename = `${profileIdForPath}-${timestamp}.${extension}`;
    const filePath = buildAvatarPath(profileIdForPath, filename);
    // Example: 75f619a2-3b50-490f-ae03-f92d6f15131c-1735689600000.webp

    // Delete all old avatar files for this profile (with retry logic, best effort)
    const cleanupResult = await retryOperation(
      async () => {
        const supabase = await createClient();
        const { data: oldFiles, error: listError } = await supabase.storage
          .from(STORAGE_BUCKETS.PROFILE_AVATARS)
          .list(profileIdForPath);

        if (listError) {
          throw listError;
        }

        if (oldFiles && oldFiles.length > 0) {
          for (const file of oldFiles) {
            const deleted = await deleteFromStorage(
              STORAGE_BUCKETS.PROFILE_AVATARS,
              `${profileIdForPath}/${file.name}`
            );
            if (!deleted) {
              throw new Error(`Failed to delete old file: ${file.name}`);
            }
          }
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

    // Log cleanup result (best effort - don't fail upload if cleanup fails)
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
      // Continue anyway - upload will proceed
    }

    // Convert file to buffer
    const fileBuffer = await file.arrayBuffer();

    // Retry operation: Upload to storage, update database
    let lastUploadedPath: string | null = null;

    const uploadResult = await retryOperation(
      async () => {
        // Check if file already exists in storage (from previous failed attempt)
        const supabase = await createClient();
        const { data: existingFile } = await supabase.storage
          .from(STORAGE_BUCKETS.PROFILE_AVATARS)
          .list(filePath.split("/").slice(0, -1).join("/") || "", {
            search: filename,
            limit: 1,
          });

        const fileExists =
          existingFile &&
          existingFile.length > 0 &&
          existingFile[0].name === filename;

        let storagePath: string;

        if (!fileExists) {
          // Upload to storage
          const uploadedPath = await uploadToStorage(
            STORAGE_BUCKETS.PROFILE_AVATARS,
            filePath,
            fileBuffer,
            file.type
          );

          if (!uploadedPath) {
            throw new Error("Failed to upload file to storage");
          }

          storagePath = uploadedPath;
          // Track uploaded file for cleanup if needed
          lastUploadedPath = filePath;
        } else {
          // File already exists from previous attempt, construct storage path
          storagePath = `${STORAGE_BUCKETS.PROFILE_AVATARS}/${filePath}`;
          // Track for cleanup
          lastUploadedPath = filePath;
        }

        // Update database with storage path
        // No need for updated_at - timestamp in filename ensures unique path
        const { data: updatedProfile, error: updateError } = await supabase
          .from("profiles")
          .update({ 
            avatar_url: storagePath
          })
          .eq("id", profileId)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        return { updatedProfile, storagePath, filePath };
      },
      {
        maxAttempts: 3,
        delayMs: 100,
        backoffMultiplier: 2,
        operationName: "Upload profile avatar",
      }
    );

    // Handle retry result
    if (!uploadResult.success) {
      // If storage upload succeeded but DB update failed, attempt cleanup
      if (lastUploadedPath) {
        const cleanupResult = await retryOperation(
          async () => {
            const deleted = await deleteFromStorage(
              STORAGE_BUCKETS.PROFILE_AVATARS,
              lastUploadedPath!
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
            operationName: "Cleanup orphaned avatar file",
          }
        );

        if (cleanupResult.success) {
          return ApiErrors.serverError("Failed to save avatar. Please try again.");
        } else {
          // Cleanup failed - log structured error for monitoring
          logStorageError({
            type: StorageErrorType.ORPHANED_FILE,
            bucket: STORAGE_BUCKETS.PROFILE_AVATARS,
            path: lastUploadedPath,
            storagePath: `${STORAGE_BUCKETS.PROFILE_AVATARS}/${lastUploadedPath}`,
            resourceId: profileIdForPath,
            resourceType: "profile-avatar",
            timestamp: new Date().toISOString(),
            retryCount: cleanupResult.attempts,
            originalError: uploadResult.error?.message,
          });

          return ApiErrors.serverError(
            "Failed to save avatar. Please contact support if this issue persists."
          );
        }
      } else {
        // No file was uploaded, log the DB update failure
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

// Catch unsupported methods
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

