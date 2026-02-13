import { successResponse, handleUnsupportedMethod, ApiErrors } from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";
import { baseProfileSchema } from "@/lib/validations/profile";
import { withAuth } from "@/lib/utils/api-route-helper";

/**
 * GET /api/profiles/[profileId]
 * Get a specific profile by ID
 * Users can only access their own profile
 */
export const GET = withAuth(async (user, _request, params) => {
  const { profileId } = params!;

  // Users can only access their own profile
  if (user.id !== profileId) {
    return ApiErrors.forbidden("You can only access your own profile");
  }

  const supabase = await createClient();

  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .is("deleted_at", null)
    .single();

  if (fetchError || !profile) {
    return ApiErrors.notFound("Profile not found");
  }

  return successResponse({ profile });
});

/**
 * PATCH /api/profiles/[profileId]
 * Update a specific profile by ID
 * Users can only update their own profile
 * Editable fields: first_name, last_name, display_name, bio, phone, preferred_language
 */
export const PATCH = withAuth(async (user, request, params) => {
  const { profileId } = params!;

  // Users can only update their own profile
  if (user.id !== profileId) {
    return ApiErrors.forbidden("You can only update your own profile");
  }

  // Parse request body
  let rawData: Record<string, any>;
  try {
    rawData = await request.json();
  } catch (error) {
    return ApiErrors.badRequest("Invalid JSON in request body");
  }

  // Block avatar_url updates via this endpoint
  if (rawData.avatar_url !== undefined) {
    return ApiErrors.badRequest(
      "Cannot update avatar_url. Use POST /api/profiles/:profileId/avatar/upload to upload an avatar, or DELETE /api/profiles/:profileId/avatar to remove it."
    );
  }

  // Validate profile fields
  const validation = baseProfileSchema.partial().safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return ApiErrors.badRequest(firstError.message);
  }

  const updateData = validation.data;

  // Build update object with only the fields that were sent
  const updateFields: Record<string, any> = {};
  const editableFields = ["first_name", "last_name", "display_name", "bio", "phone", "preferred_language"] as const;

  for (const field of editableFields) {
    if (updateData[field] !== undefined) {
      // Normalize empty strings to null for nullable fields
      const value = updateData[field];
      updateFields[field] = value === "" ? null : value;
    }
  }

  // If no fields to update, return current profile
  if (Object.keys(updateFields).length === 0) {
    return successResponse({ profile: user });
  }

  const supabase = await createClient();

  // Update profile
  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update({
      ...updateFields,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId)
    .is("deleted_at", null)
    .select()
    .single();

  if (updateError) {
    console.error("Failed to update profile:", updateError);
    return ApiErrors.serverError();
  }

  return successResponse({ profile: updatedProfile });
});

// Catch unsupported methods
export async function POST() {
  return handleUnsupportedMethod(["GET", "PATCH"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["GET", "PATCH"]);
}

export async function DELETE() {
  return handleUnsupportedMethod(["GET", "PATCH"]);
}
