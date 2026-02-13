import { z } from "zod";
import {
  CommunityAccessTypeValues,
  MembershipStatusValues,
} from "@/types/community";
import { paginationSchema } from "@/lib/validations/pagination";

// ============================================================================
// Community Schemas
// ============================================================================

export const createCommunitySchema = z.object({
  community_name: z.string().min(1, "Community name is required").max(100),
  community_description: z.string().max(1000).nullable().optional(),
  access_type: z.enum(CommunityAccessTypeValues).default("invite_only"),
  auto_approve_join_requests: z.boolean().default(false),
  allow_member_invites: z.boolean().default(true),
  max_members: z.number().int().min(2).max(10000).default(100),
  address_id: z.string().uuid().nullable().optional(),
});

export const updateCommunitySchema = createCommunitySchema.partial();

export const communityFilterSchema = paginationSchema;

export const browseFilterSchema = paginationSchema.extend({
  search: z.string().max(100).optional(),
});

export type CreateCommunityInput = z.infer<typeof createCommunitySchema>;
export type UpdateCommunityInput = z.infer<typeof updateCommunitySchema>;
export type CommunityFilterInput = z.infer<typeof communityFilterSchema>;
export type BrowseFilterInput = z.infer<typeof browseFilterSchema>;

// ============================================================================
// Member Schemas
// ============================================================================

const membershipStatusEnum = z.enum(["active", "pending"] as const);

export const memberFilterSchema = paginationSchema.extend({
  membership_status: membershipStatusEnum.optional(),
});

export const updateMemberSchema = z.object({
  member_role: z.enum(["admin", "moderator", "member"] as const).optional(),
  can_post_offerings: z.boolean().optional(),
  can_invite_members: z.boolean().optional(),
  membership_status: z.enum(["active", "removed"] as const).optional(),
  admin_notes: z.string().max(500).nullable().optional(),
  removal_reason: z.string().max(500).nullable().optional(),
});

export type MemberFilterInput = z.infer<typeof memberFilterSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

// ============================================================================
// Invitation Schemas
// ============================================================================

export const createInvitationSchema = z
  .object({
    invited_profile_id: z.string().uuid().nullable().optional(),
    invited_email: z.string().email().nullable().optional(),
    invitation_message: z.string().max(500).nullable().optional(),
    max_uses: z.number().int().min(1).max(100).default(1),
    expires_in_days: z.number().int().min(1).max(30).default(7),
  })
  .refine((d) => d.invited_profile_id || d.invited_email, {
    message: "Either invited_profile_id or invited_email is required",
  });

export const respondInvitationSchema = z.object({
  action: z.enum(["accept", "decline"]),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type RespondInvitationInput = z.infer<typeof respondInvitationSchema>;
