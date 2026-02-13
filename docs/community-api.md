# Community API Routes

## Context

The new "Dein Dorf in der Stadt" schema has communities, community_members, and community_invitations tables. No routes exist yet — creating the full community API from scratch.

Key DB-level features already in place:
- `add_community_creator_as_owner` trigger — auto-adds creator as owner member on INSERT
- `update_community_member_count` trigger — auto-syncs `current_members_count` on member changes
- `is_community_member()` / `is_community_admin()` — RPC helpers (used by RLS)
- RLS policies handle most authorization at the DB level

---

## Files to create

| # | File | Action |
|---|------|--------|
| 1 | `nextserver/src/types/community.ts` | New — DB types + response types |
| 2 | `nextserver/src/lib/validations/community.ts` | New — Zod schemas |
| 3 | `nextserver/src/app/api/communities/route.ts` | New — List + Create |
| 4 | `nextserver/src/app/api/communities/[communityId]/route.ts` | New — Get + Update + Delete |
| 5 | `nextserver/src/app/api/communities/[communityId]/members/route.ts` | New — List + Join |
| 6 | `nextserver/src/app/api/communities/[communityId]/members/[memberId]/route.ts` | New — Update role/status + Remove |
| 7 | `nextserver/src/app/api/communities/[communityId]/invitations/route.ts` | New — List + Create |
| 8 | `nextserver/src/app/api/communities/[communityId]/invitations/[invitationId]/route.ts` | New — Accept + Decline |
| 9 | `nextserver/src/app/api/communities/[communityId]/leave/route.ts` | New — Leave community |

---

## 1. Types: `types/community.ts`

```typescript
// DB row types from supabase
export type Community, CommunityInsert, CommunityUpdate
export type CommunityMember, CommunityMemberInsert, CommunityMemberUpdate
export type CommunityInvitation, CommunityInvitationInsert, CommunityInvitationUpdate

// Enum value arrays (for Zod validation)
export const CommunityAccessTypeValues = ["open", "request_to_join", "invite_only"] as const
export const MemberRoleValues = ["owner", "admin", "moderator", "member"] as const
export const MembershipStatusValues = ["pending", "active", "removed", "left"] as const
export const JoinMethodValues = ["invite_link", "direct_invite", "request"] as const
export const InvitationStatusValues = ["pending", "accepted", "declined", "expired"] as const

// Response types
export interface CommunityResponse { community: Community }
export interface CommunityMemberResponse { member: CommunityMember }
export interface CommunityInvitationResponse { invitation: CommunityInvitation }
```

---

## 2. Validations: `lib/validations/community.ts`

```typescript
// Create community
export const createCommunitySchema = z.object({
  community_name: z.string().min(1).max(100),
  community_description: z.string().max(1000).nullable().optional(),
  access_type: z.enum(CommunityAccessTypeValues).default("invite_only"),
  auto_approve_join_requests: z.boolean().default(false),
  allow_member_invites: z.boolean().default(true),
  max_members: z.number().int().min(2).max(10000).default(100),
  address_id: z.string().uuid().nullable().optional(),
})

// Update community (partial, owner/admin only)
export const updateCommunitySchema = createCommunitySchema.partial()

// List communities filter (extends paginationSchema)
export const communityFilterSchema = paginationSchema.extend({
  access_type: z.enum(CommunityAccessTypeValues).optional(),
  membership: z.enum(["my", "discover"]).optional(),
  // "my" = user's communities, "discover" = open communities user is not in
})

// Member management (admin/owner only)
export const updateMemberSchema = z.object({
  member_role: z.enum(["admin", "moderator", "member"]).optional(), // no "owner"
  can_post_offerings: z.boolean().optional(),
  can_invite_members: z.boolean().optional(),
  membership_status: z.enum(["active", "removed"]).optional(), // approve or remove
  admin_notes: z.string().max(500).nullable().optional(),
  removal_reason: z.string().max(500).nullable().optional(),
})

// Create invitation
export const createInvitationSchema = z.object({
  invited_profile_id: z.string().uuid().nullable().optional(),
  invited_email: z.string().email().nullable().optional(),
  invitation_message: z.string().max(500).nullable().optional(),
  max_uses: z.number().int().min(1).max(100).default(1),
  expires_in_days: z.number().int().min(1).max(30).default(7),
}).refine(
  d => d.invited_profile_id || d.invited_email,
  { message: "Either invited_profile_id or invited_email is required" }
)
```

---

## 3. Routes

### `POST /api/communities` — Create community
- `withAuth` — any authenticated user
- Validate with `createCommunitySchema`
- Insert into `communities` with `created_by_profile_id = user.id`
- Creator auto-added as owner via DB trigger
- Return 201 with community

### `GET /api/communities` — List communities
- `withAuth`
- `?membership=my` (default) — communities where user is active member (join via community_members)
- `?membership=discover` — open communities user is NOT a member of
- Cursor-based pagination

### `GET /api/communities/[communityId]` — Get single community
- `withAuth`
- RLS handles visibility (members see theirs, anyone sees open)

### `PATCH /api/communities/[communityId]` — Update community
- `withAuth`
- Check user is admin/owner via community_members query
- Validate with `updateCommunitySchema`

### `DELETE /api/communities/[communityId]` — Soft delete
- `withAuth`
- Only owner can delete
- Set `deleted_at = now()`, `is_active = false`

---

### `GET /api/communities/[communityId]/members` — List members
- `withAuth`
- RLS: only active members can see other members
- Filter `?membership_status=active|pending`
- Cursor-based pagination

### `POST /api/communities/[communityId]/members` — Join / Request to join
- `withAuth`
- Open → `membership_status = 'active'`, `join_method = 'request'`
- Request-to-join → `membership_status = 'pending'`, `join_method = 'request'`
- Invite-only → reject (must use invitation flow)
- Check not already a member
- Check `current_members_count < max_members`

### `PATCH /api/communities/[communityId]/members/[memberId]` — Update member
- `withAuth`, admin/owner only
- Update role, permissions, approve pending, remove
- Can't modify owner role or assign owner

### `DELETE /api/communities/[communityId]/members/[memberId]` — Remove member
- `withAuth`, admin/owner only
- Set `membership_status = 'removed'`, `removed_by_profile_id = user.id`

### `POST /api/communities/[communityId]/leave` — Leave community
- `withAuth`
- Set own `membership_status = 'left'`
- Owner can't leave (must transfer ownership first)

---

### `GET /api/communities/[communityId]/invitations` — List invitations
- `withAuth`
- Admin/owner or invitee can see (RLS handles it)

### `POST /api/communities/[communityId]/invitations` — Create invitation
- `withAuth`
- Check invite permission (`can_invite_members = true` OR role owner/admin/moderator)
- Generate `invitation_token` via `crypto.randomUUID()`
- Set `expires_at` from `expires_in_days`

### `PATCH /api/communities/[communityId]/invitations/[invitationId]` — Accept / Decline
- `withAuth`, invitee only
- Accept → create community_members with `join_method = 'direct_invite'`, `membership_status = 'active'`
- Decline → `invitation_status = 'declined'`, `declined_at = now()`
- Check not expired, not already used (`current_uses < max_uses`)

---

## Existing code to reuse

- `withAuth` — `lib/utils/api-route-helper.ts`
- `successResponse`, `ApiErrors.*` — `lib/utils/api-response.ts`
- `createClient()` — `lib/supabase/server.ts`
- `applyCursorPagination`, `buildPaginatedResponse` — `lib/utils/pagination.ts`
- `paginationSchema` — `lib/validations/pagination.ts`

---

## Verification

1. Create community → creator auto-added as owner, `current_members_count = 1`
2. List my communities → only returns communities where user is active member
3. Discover → shows open communities user is not in
4. Join open community → `membership_status = 'active'` immediately
5. Request to join → `membership_status = 'pending'`
6. Admin approves → member becomes active, count increments
7. Admin removes → `membership_status = 'removed'`, count decrements
8. Leave → `membership_status = 'left'`, count decrements
9. Owner can't leave → error
10. Create invitation → token generated, expires_at set
11. Accept invitation → member created, invitation status updated
12. Decline → invitation status updated
