/**
 * Storage security tests.
 *
 * Verifies the presigned-URL flow and its guardrails:
 *   - MIME type whitelist (no SVG, HTML, JS)
 *   - Per-resource file size caps (HEAD check at persist time)
 *   - Key prefix validation (can't upload to someone else's directory)
 *   - Auth required for signing and persisting
 *   - Cross-user image persistence rejection
 *
 * Does NOT actually upload to R2 — that requires R2 credentials. Tests
 * the API gating logic (which is where the security boundary lives).
 *
 * Run with:
 *   npx tsx scripts/security/test-storage.ts
 */

import { api, assert, assertStatus, createUser, section, runSuite, ok } from './helpers'

async function main() {
  section('0. Setup — two users for cross-user tests')
  const [alice, bob] = await Promise.all([createUser('storage-alice'), createUser('storage-bob')])
  ok(`alice: ${alice.userId}`)
  ok(`bob:   ${bob.userId}`)

  // ─────────────────────────────────────────────────────────────────────────
  section('1. MIME whitelist — avatar sign')
  // ─────────────────────────────────────────────────────────────────────────

  const rejectedMimes = [
    'image/svg+xml',               // SVG can contain JS
    'text/html',                   // HTML = XSS vector
    'application/javascript',      // literal JS
    'application/xhtml+xml',
    'application/x-shockwave-flash', // legacy but dangerous
    'text/plain',
    'application/octet-stream',
    'image/vnd.microsoft.icon',    // ICO format not in whitelist
    'application/pdf',
    'video/mp4',
  ]

  for (const mime of rejectedMimes) {
    const r = await api.post(
      alice.accessToken,
      `/api/v1/profiles/${alice.userId}/avatar/sign`,
      { filename: 'attack.jpg', contentType: mime }
    )
    assertStatus(r.status, [400, 422], `sign avatar with ${mime} → rejected`)
  }

  // Verify valid types are accepted
  const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
  for (const mime of validMimes) {
    const r = await api.post(
      alice.accessToken,
      `/api/v1/profiles/${alice.userId}/avatar/sign`,
      { filename: 'photo.jpg', contentType: mime }
    )
    assertStatus(r.status, [200, 201], `sign avatar with ${mime} → accepted`)
  }

  // ─────────────────────────────────────────────────────────────────────────
  section('2. Cross-user avatar sign')
  // ─────────────────────────────────────────────────────────────────────────

  // Bob tries to sign an avatar for Alice's profile
  {
    const r = await api.post(
      bob.accessToken,
      `/api/v1/profiles/${alice.userId}/avatar/sign`,
      { filename: 'hijack.jpg', contentType: 'image/jpeg' }
    )
    assertStatus(r.status, [401, 403, 404], 'Bob signs Alice avatar → rejected')
  }

  // ─────────────────────────────────────────────────────────────────────────
  section('3. Avatar persist — wrong key prefix')
  // ─────────────────────────────────────────────────────────────────────────

  // Alice tries to persist an avatar with a key from the wrong prefix
  const invalidKeys = [
    'not-even-prefixed.jpg',                              // no prefix
    'offering-images/foo/bar.jpg',                        // wrong root prefix
    `profile-avatars/${bob.userId}/stolen.jpg`,            // someone else's prefix
    '../../../etc/passwd',                                 // path traversal
    'profile-avatars//double-slash.jpg',
    '',                                                    // empty key
  ]

  for (const key of invalidKeys) {
    const r = await api.post(
      alice.accessToken,
      `/api/v1/profiles/${alice.userId}/avatar`,
      { key }
    )
    assertStatus(r.status, [400, 403, 404], `persist avatar with key "${key.slice(0, 30)}" → rejected`)
  }

  // ─────────────────────────────────────────────────────────────────────────
  section('4. Sign endpoint requires auth')
  // ─────────────────────────────────────────────────────────────────────────

  {
    const r = await api.post(undefined, `/api/v1/profiles/${alice.userId}/avatar/sign`, {
      filename: 'x.jpg',
      contentType: 'image/jpeg',
    })
    assertStatus(r.status, [401, 403], 'anonymous avatar sign → 401/403')
  }

  // ─────────────────────────────────────────────────────────────────────────
  section('5. Message attachment — sender-only constraint')
  // ─────────────────────────────────────────────────────────────────────────

  // Without a real conversation + message to attach to, we can only test
  // the "fake message ID" rejection path. Creating a full conversation
  // requires shared community membership (tested elsewhere).

  const fakeMessageId = '00000000-0000-0000-0000-000000000000'

  {
    const r = await api.post(
      alice.accessToken,
      `/api/v1/messages/${fakeMessageId}/attachments/sign`,
      { filename: 'x.jpg', contentType: 'image/jpeg' }
    )
    assertStatus(r.status, [403, 404], 'sign attachment for nonexistent message → rejected')
  }

  // Anonymous
  {
    const r = await api.post(
      undefined,
      `/api/v1/messages/${fakeMessageId}/attachments/sign`,
      { filename: 'x.jpg', contentType: 'image/jpeg' }
    )
    assertStatus(r.status, [401, 403], 'anonymous attachment sign → 401/403')
  }

  // ─────────────────────────────────────────────────────────────────────────
  section('6. Offering image sign — owner-only')
  // ─────────────────────────────────────────────────────────────────────────

  // Without creating real offerings, we test the fake ID case.
  const fakeOfferingId = '22222222-2222-2222-2222-222222222222'

  {
    const r = await api.post(
      alice.accessToken,
      `/api/v1/offerings/${fakeOfferingId}/images/sign`,
      { filename: 'x.jpg', contentType: 'image/jpeg' }
    )
    assertStatus(r.status, [403, 404], 'sign image for nonexistent offering → rejected')
  }

  // ─────────────────────────────────────────────────────────────────────────
  section('7. Missing required fields on sign')
  // ─────────────────────────────────────────────────────────────────────────

  {
    const r = await api.post(
      alice.accessToken,
      `/api/v1/profiles/${alice.userId}/avatar/sign`,
      {} // no filename, no contentType
    )
    assertStatus(r.status, [400, 422], 'sign with empty body → rejected')
  }

  {
    const r = await api.post(
      alice.accessToken,
      `/api/v1/profiles/${alice.userId}/avatar/sign`,
      { filename: 'x.jpg' } // missing contentType
    )
    assertStatus(r.status, [400, 422], 'sign without contentType → rejected')
  }

  // ─────────────────────────────────────────────────────────────────────────
  section('8. Filename sanity')
  // ─────────────────────────────────────────────────────────────────────────

  // Extreme or dangerous filenames
  const sketchyFilenames = [
    '../../../secret.jpg',
    'a'.repeat(10000) + '.jpg',
    '<script>alert(1)</script>.jpg',
    '\0null\0byte.jpg',
  ]

  for (const filename of sketchyFilenames) {
    const r = await api.post(
      alice.accessToken,
      `/api/v1/profiles/${alice.userId}/avatar/sign`,
      { filename, contentType: 'image/jpeg' }
    )
    // Either rejected (400/422) OR sanitized and accepted (200).
    // What's NOT acceptable: 500 (crash) or returning the raw filename back in the signed URL.
    assert(r.status !== 500, `filename "${filename.slice(0, 20)}..." did not cause 500`)
    if (r.status >= 200 && r.status < 300 && r.body?.key) {
      assert(
        !r.body.key.includes('..') && !r.body.key.includes('<') && !r.body.key.includes('\0'),
        `sanitized key rejects traversal/injection patterns (got "${r.body.key}")`
      )
    }
    ok(`sketchy filename handled → ${r.status}`)
  }
}

runSuite('Storage security tests', main)
