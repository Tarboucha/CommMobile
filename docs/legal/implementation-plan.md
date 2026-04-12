# KoDo — Legal Compliance Implementation Plan

Technical changes needed in the database, backend, and frontend to support the legal framework.

---

## 1. Database Changes (Migration 007)

### 1.1 Terms Acceptance Tracking

```sql
-- Track when users accept terms/privacy policy (required for GDPR proof of consent)
CREATE TABLE terms_acceptances (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    document_type   TEXT NOT NULL CHECK (document_type IN ('terms_of_service', 'privacy_policy')),
    document_version TEXT NOT NULL,          -- e.g. "2026-02-25-v1"
    accepted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address      TEXT,                    -- optional, for audit
    user_agent      TEXT,                    -- optional, for audit
    UNIQUE(profile_id, document_type, document_version)
);

-- RLS: users can only read their own acceptances
ALTER TABLE terms_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own acceptances"
    ON terms_acceptances FOR SELECT
    USING (profile_id = get_current_profile_id());

CREATE POLICY "Users can insert own acceptances"
    ON terms_acceptances FOR INSERT
    WITH CHECK (profile_id = get_current_profile_id());
```

### 1.2 Account Deletion Support

```sql
-- Enhance the existing soft-delete on profiles
-- Add a scheduled cleanup function

-- Function to anonymize a deleted profile
CREATE OR REPLACE FUNCTION anonymize_deleted_profile(p_profile_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Anonymize profile data
    UPDATE profiles SET
        first_name = 'Gelöschter',
        last_name = 'Nutzer',
        display_name = NULL,
        email = 'deleted-' || p_profile_id || '@deleted.kodo.app',
        phone = NULL,
        avatar_url = NULL,
        bio = NULL,
        verification_documents = NULL,
        deleted_at = now()
    WHERE id = p_profile_id;

    -- Delete all addresses
    DELETE FROM addresses WHERE profile_id = p_profile_id;

    -- Delete push tokens
    DELETE FROM push_tokens WHERE profile_id = p_profile_id;

    -- Anonymize reviews (keep content for provider, remove author identity)
    UPDATE reviews SET
        reviewer_id = NULL
    WHERE reviewer_id = p_profile_id;

    -- Remove from conversations (but keep booking conversations for records)
    DELETE FROM conversation_participants
    WHERE profile_id = p_profile_id
      AND conversation_id IN (
          SELECT id FROM conversations WHERE conversation_type != 'booking'
      );

    -- Leave community memberships
    DELETE FROM community_members WHERE profile_id = p_profile_id;

    -- Deactivate all offerings
    UPDATE offerings SET
        status = 'archived',
        updated_at = now()
    WHERE provider_id = p_profile_id;

    -- Note: bookings and booking snapshots are KEPT for tax/legal retention
    -- Note: booking conversations are KEPT for 7-year retention
END;
$$;
```

### 1.3 Data Export Support

```sql
-- Function to export all user data as JSON (Art. 20 DSGVO - Data Portability)
CREATE OR REPLACE FUNCTION export_user_data(p_profile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    -- Verify the requesting user owns this profile
    IF p_profile_id != get_current_profile_id() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT jsonb_build_object(
        'exported_at', now(),
        'profile', (SELECT row_to_json(p.*) FROM profiles p WHERE p.id = p_profile_id),
        'addresses', (SELECT COALESCE(jsonb_agg(row_to_json(a.*)), '[]'::jsonb)
                      FROM addresses a WHERE a.profile_id = p_profile_id),
        'communities', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                            'community_id', cm.community_id,
                            'role', cm.role,
                            'joined_at', cm.joined_at
                        )), '[]'::jsonb)
                        FROM community_members cm WHERE cm.profile_id = p_profile_id),
        'offerings', (SELECT COALESCE(jsonb_agg(row_to_json(o.*)), '[]'::jsonb)
                      FROM offerings o WHERE o.provider_id = p_profile_id),
        'bookings_as_customer', (SELECT COALESCE(jsonb_agg(row_to_json(b.*)), '[]'::jsonb)
                                 FROM bookings b WHERE b.customer_id = p_profile_id),
        'bookings_as_provider', (SELECT COALESCE(jsonb_agg(row_to_json(b.*)), '[]'::jsonb)
                                 FROM bookings b WHERE b.provider_id = p_profile_id),
        'reviews_written', (SELECT COALESCE(jsonb_agg(row_to_json(r.*)), '[]'::jsonb)
                            FROM reviews r WHERE r.reviewer_id = p_profile_id),
        'reviews_received', (SELECT COALESCE(jsonb_agg(row_to_json(r.*)), '[]'::jsonb)
                             FROM reviews r WHERE r.provider_id = p_profile_id),
        'messages_sent', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                              'content', m.content,
                              'sent_at', m.created_at,
                              'conversation_id', m.conversation_id
                          )), '[]'::jsonb)
                          FROM messages m WHERE m.sender_id = p_profile_id),
        'notifications', (SELECT COALESCE(jsonb_agg(row_to_json(n.*)), '[]'::jsonb)
                          FROM notifications n WHERE n.profile_id = p_profile_id)
    ) INTO result;

    RETURN result;
END;
$$;
```

---

## 2. Backend API Changes

### 2.1 Terms Acceptance Endpoint

**`POST /api/legal/accept`**

```
Body: { document_type: "terms_of_service" | "privacy_policy", document_version: string }
Response: { accepted: true }
```

- Records the user's acceptance of a legal document version
- Called during sign-up and when terms are updated

**`GET /api/legal/status`**

```
Response: {
  terms_of_service: { accepted: boolean, version: string, accepted_at: string } | null,
  privacy_policy: { accepted: boolean, version: string, accepted_at: string } | null,
  requires_acceptance: boolean  // true if new versions need acceptance
}
```

- Checks if the user has accepted the latest versions
- Frontend checks this on app launch to prompt re-acceptance after updates

### 2.2 Account Deletion Endpoint

**`DELETE /api/profiles/me`**

```
Body: { confirmation: "DELETE MY ACCOUNT" }  // explicit confirmation
Response: { deleted: true, message: "Account scheduled for deletion" }
```

- Calls `anonymize_deleted_profile()` RPC
- Invalidates the user's Supabase auth session
- Must use `withSecureAuth` (server-verified session)

### 2.3 Data Export Endpoint

**`GET /api/profiles/me/export`**

```
Response: JSON file download with all user data
Headers: Content-Disposition: attachment; filename="kodo-data-export-{date}.json"
```

- Calls `export_user_data()` RPC
- Returns all user data in machine-readable JSON format
- Rate-limited: max 1 export per 24 hours
- Must use `withSecureAuth`

### 2.4 Legal Pages Content Endpoint (Optional)

**`GET /api/legal/[document]`**

```
Params: document = "impressum" | "privacy" | "terms" | "cancellation" | "provider-terms"
Response: { content: string, version: string, updated_at: string }
```

- Serves legal text content
- Alternative: bundle legal texts in the app as static content (simpler, works offline)
- Advantage of API: can update legal texts without app store update

---

## 3. Frontend Changes

### 3.1 Sign-Up Flow — Consent Checkbox

**File:** `nativeCom/src/app/auth/sign-up.tsx`

Add before the "Sign Up" button:

```
[ ] Ich akzeptiere die [AGB] und habe die [Datenschutzerklärung] gelesen.
```

- Checkbox is required — cannot register without accepting
- "AGB" and "Datenschutzerklärung" are tappable links → open legal screens
- On submit: call `POST /api/legal/accept` for both documents
- Store acceptance with current document version

### 3.2 Legal Screens

Create new screens under `nativeCom/src/app/legal/`:

| Screen | Route | Content |
|--------|-------|---------|
| Impressum | `/legal/impressum` | Legal notice |
| Datenschutz | `/legal/privacy` | Privacy policy |
| AGB | `/legal/terms` | Terms of service |
| Widerruf | `/legal/cancellation` | Cancellation policy |
| Anbieter-AGB | `/legal/provider-terms` | Provider-specific terms |

Each screen:
- ScrollView with rendered markdown/text content
- Back navigation
- Version number and last-updated date at the bottom

### 3.3 Drawer Menu — Legal Section

**File:** `nativeCom/src/components/navigation/app-drawer.tsx`

Add a "Rechtliches" (Legal) section at the bottom of the drawer:

```
── Rechtliches ──────────────
  Impressum
  Datenschutzerklärung
  AGB
  Widerrufsbelehrung
```

### 3.4 Account Settings — Privacy & Data

Add new options to account/settings:

```
── Datenschutz & Konto ──────
  Meine Daten exportieren      → triggers data export (JSON download)
  Konto löschen                → opens deletion confirmation screen
```

### 3.5 Account Deletion Screen

**Route:** `nativeCom/src/app/account/delete-account.tsx`

Multi-step confirmation:
1. Warning screen explaining what happens:
   - Profile will be anonymized
   - Active bookings must be completed or cancelled first
   - Booking history is retained for tax compliance (anonymized)
   - Messages will be deleted per retention schedule
   - This action is irreversible
2. Must type "KONTO LÖSCHEN" to confirm
3. Final "Delete" button (red, destructive style)
4. On success: sign out and navigate to auth screen

### 3.6 Terms Re-acceptance Flow

When legal documents are updated (new version):
1. On app launch, call `GET /api/legal/status`
2. If `requires_acceptance: true`, show a modal/screen:
   - "Unsere AGB/Datenschutzerklärung wurden aktualisiert"
   - Show summary of changes
   - "Akzeptieren" button (required to continue using the app)
3. Record new acceptance via `POST /api/legal/accept`

### 3.7 Data Export Screen

**Route:** `nativeCom/src/app/account/export-data.tsx`

- Button: "Daten exportieren"
- Shows explanation of what's included
- Triggers `GET /api/profiles/me/export`
- Downloads/shares JSON file via `expo-sharing` or `expo-file-system`
- Shows "last exported" timestamp
- Disabled for 24 hours after last export

---

## 4. App Store Requirements

### 4.1 iOS App Privacy Labels (App Store Connect)

Apple requires privacy nutrition labels. Based on KoDo's data collection:

| Data Type | Collection | Usage |
|-----------|-----------|-------|
| Contact Info (email, phone, name) | Collected | App Functionality |
| User Content (messages, reviews, photos) | Collected | App Functionality |
| Identifiers (user ID) | Collected | App Functionality |
| Location (addresses) | Collected | App Functionality |
| Usage Data | NOT collected | — |
| Diagnostics | NOT collected | — |
| Tracking | NOT collected | — |

- Data linked to identity: Yes (email, name, phone)
- Data used to track: No
- Third-party sharing for tracking: No

### 4.2 Google Play Data Safety

Similar declarations for Google Play Console:
- Data collected: Name, email, phone, address, photos, messages
- Data shared with third parties: No (Supabase is a processor, not a third party)
- Data encrypted in transit: Yes
- Data deletion available: Yes (account deletion feature)

---

## 5. Implementation Priority

### Phase 1 — Must Have Before Launch (Legal Requirement)
1. Legal text screens (Impressum, Privacy, Terms, Cancellation)
2. Drawer links to legal screens
3. Consent checkbox on sign-up
4. Terms acceptance tracking (DB + API)
5. Account deletion (DB function + API + screen)

### Phase 2 — Should Have Within 30 Days of Launch
6. Data export (DB function + API + screen)
7. Terms re-acceptance flow (for future updates)
8. App Store privacy labels

### Phase 3 — Nice to Have
9. Server-side legal content API (for updating without app release)
10. Automated data retention cleanup (cron job for message expiry)
11. Cookie/consent banner (if web version is added)
12. DAC7 reporting infrastructure

---

## 6. Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `docs/newdb/migrations/007_legal_compliance.sql` | DB migration |
| `nextserver/src/app/api/legal/accept/route.ts` | Terms acceptance API |
| `nextserver/src/app/api/legal/status/route.ts` | Terms status check API |
| `nextserver/src/app/api/profiles/me/route.ts` | Account deletion API |
| `nextserver/src/app/api/profiles/me/export/route.ts` | Data export API |
| `nativeCom/src/app/legal/impressum.tsx` | Impressum screen |
| `nativeCom/src/app/legal/privacy.tsx` | Privacy policy screen |
| `nativeCom/src/app/legal/terms.tsx` | Terms screen |
| `nativeCom/src/app/legal/cancellation.tsx` | Cancellation policy screen |
| `nativeCom/src/app/legal/provider-terms.tsx` | Provider terms screen |
| `nativeCom/src/app/account/delete-account.tsx` | Account deletion screen |
| `nativeCom/src/app/account/export-data.tsx` | Data export screen |
| `nativeCom/src/lib/api/legal/index.ts` | Legal API client |

### Modified Files
| File | Change |
|------|--------|
| `nativeCom/src/app/auth/sign-up.tsx` | Add consent checkbox |
| `nativeCom/src/components/navigation/app-drawer.tsx` | Add legal section |
| `nativeCom/src/types/supabase.ts` | Add RPC types |
| `nextserver/src/types/supabase.ts` | Add RPC types |
| `nextserver/src/app/api/profiles/[profileId]/route.ts` | Enable DELETE |

---

## 7. Testing Checklist

- [ ] Sign-up blocked without accepting terms
- [ ] Terms acceptance recorded in database with correct version
- [ ] All legal screens render correctly and scroll properly
- [ ] Account deletion anonymizes profile data
- [ ] Account deletion preserves booking records (tax compliance)
- [ ] Account deletion invalidates auth session
- [ ] Data export includes all user data categories
- [ ] Data export rate limiting works (1 per 24h)
- [ ] Drawer shows legal links
- [ ] Legal screen links in sign-up work
- [ ] Terms re-acceptance modal appears when version changes
- [ ] App Store privacy labels match actual data collection
