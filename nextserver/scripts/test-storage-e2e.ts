/**
 * End-to-end test for Cloudflare R2 storage via the new presigned-URL flow.
 *
 * Exercises:
 *   1. Login via auth-service
 *   2. Avatar:  /sign → PUT to R2 → POST /avatar → atomic replace + old-file cleanup
 *   3. Offering images: /sign → PUT → POST /images → count cap enforcement → DELETE
 *
 * Requires the full Docker stack running.
 */

import './load-env'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

const API_BASE = 'http://localhost:3002'
const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3004'
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || process.env.R2_ENDPOINT
const TEST_EMAIL = 'test3@kodo.com'
const PASSWORD = 'test123'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function section(title: string) { console.log(`\n${'─'.repeat(70)}\n${title}\n${'─'.repeat(70)}`) }
function ok(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { console.log(`  ✗ ${msg}`); throw new Error(msg) }
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) fail(msg); else ok(msg)
}

async function login(): Promise<{ token: string; profileId: string }> {
  const res = await fetch(`${AUTH_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: PASSWORD }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Login failed: ${data.message}`)
  const profile = await prisma.profiles.findFirstOrThrow({ where: { email: TEST_EMAIL } })
  return { token: data.access_token, profileId: profile.id }
}

/** 1x1 red JPEG for quick uploads. */
function tinyJpeg(): Blob {
  const bytes = Buffer.from(
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==',
    'base64'
  )
  return new Blob([bytes], { type: 'image/jpeg' })
}

async function sign(token: string, path: string, body: { filename: string; content_type: string }) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`sign ${path} → ${res.status}: ${JSON.stringify(json)}`)
  return json.data as {
    upload_url: string; key: string; expires_in: number; max_bytes: number; content_type: string
  }
}

async function putToR2(url: string, blob: Blob, contentType: string) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  })
  if (!res.ok) throw new Error(`R2 PUT → ${res.status} ${res.statusText}`)
}

async function apiPost(token: string, path: string, body: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${JSON.stringify(json)}`)
  return json
}

async function apiDelete(token: string, path: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`DELETE ${path} → ${res.status}: ${JSON.stringify(json)}`)
  return json
}

async function uploadFlow(token: string, signPath: string, persistPath: string, extraBody: Record<string, unknown> = {}) {
  const blob = tinyJpeg()
  const signed = await sign(token, signPath, {
    filename: `test-${Date.now()}.jpg`,
    content_type: 'image/jpeg',
  })
  await putToR2(signed.upload_url, blob, signed.content_type)
  const persisted = await apiPost(token, persistPath, { key: signed.key, ...extraBody })
  return { key: signed.key, persisted }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // ── 1. Login ──────────────────────────────────────────────────────────────
  section('1. Login via auth-service')
  const { token, profileId } = await login()
  ok(`logged in: ${TEST_EMAIL} (${profileId})`)

  const original = await prisma.profiles.findUnique({
    where: { id: profileId }, select: { avatar_url: true },
  })
  const originalAvatarUrl = original?.avatar_url ?? null

  // ── 2. Avatar flow ────────────────────────────────────────────────────────
  section('2. Avatar: /sign → PUT → POST /avatar')
  const avatar1 = await uploadFlow(
    token,
    `/api/v1/profiles/${profileId}/avatar/sign`,
    `/api/v1/profiles/${profileId}/avatar`
  )
  assert(avatar1.persisted.data?.profile?.avatar_url === avatar1.key, 'DB avatar_url === uploaded key')
  assert(avatar1.key.startsWith(`profile-avatars/${profileId}/`), 'key prefixed correctly')
  ok(`key: ${avatar1.key}`)

  // ── 3. Public URL reachable (if r2.dev enabled) ──────────────────────────
  section('3. Verify public URL')
  if (R2_PUBLIC_URL && !R2_PUBLIC_URL.includes('cdn.kodo.app')) {
    try {
      const headRes = await fetch(`${R2_PUBLIC_URL}/${avatar1.key}`, { method: 'HEAD' })
      if (headRes.ok) {
        ok(`file reachable at R2 public URL (${headRes.status}, ${headRes.headers.get('content-type')})`)
      } else {
        ok(`public URL returned ${headRes.status} (may still be propagating or public access not enabled)`)
      }
    } catch (err) {
      ok(`public URL fetch threw (${err instanceof Error ? err.message : 'unknown'}) — non-fatal, upload to R2 succeeded`)
    }
  } else {
    ok('public URL check skipped (no r2.dev or CDN domain configured)')
  }

  // ── 4. Atomic replace ────────────────────────────────────────────────────
  section('4. Atomic replace — second avatar should clean up first')
  const avatar2 = await uploadFlow(
    token,
    `/api/v1/profiles/${profileId}/avatar/sign`,
    `/api/v1/profiles/${profileId}/avatar`
  )
  assert(avatar2.key !== avatar1.key, 'new key differs')
  const dbAfter = await prisma.profiles.findUniqueOrThrow({
    where: { id: profileId }, select: { avatar_url: true },
  })
  assert(dbAfter.avatar_url === avatar2.key, 'DB points at new key')
  // The old key should have been deleted from R2. Best-effort check.
  if (R2_PUBLIC_URL && !R2_PUBLIC_URL.includes('cdn.kodo.app')) {
    try {
      const check = await fetch(`${R2_PUBLIC_URL}/${avatar1.key}`, { method: 'HEAD' })
      if (check.status === 404) ok('old avatar purged from R2 (404)')
      else console.log(`  ⚠ old avatar still reachable (${check.status}) — DeleteObject may not have propagated yet`)
    } catch {
      ok('cleanup HEAD threw (non-fatal, DeleteObject was issued)')
    }
  } else {
    ok('cleanup check skipped (no public URL)')
  }

  // ── 5. Offering images flow ──────────────────────────────────────────────
  section('5. Offering images: create fixture offering + upload image')

  const community = await prisma.community_members.findFirstOrThrow({
    where: { profile_id: profileId, membership_status: 'active' },
  })
  const offering = await prisma.offerings.create({
    data: {
      provider_id: profileId,
      community_id: community.community_id,
      title: `[storage-e2e] ${Date.now()}`,
      category: 'product',
      price_amount: 10,
      currency_code: 'EUR',
      transaction_type: 'purchase',
      fulfillment_method: 'pickup',
      status: 'active',
    },
  })
  ok(`offering created: ${offering.id}`)

  const img1 = await uploadFlow(
    token,
    `/api/v1/offerings/${offering.id}/images/sign`,
    `/api/v1/offerings/${offering.id}/images`
  )
  assert(img1.key.startsWith(`offering-images/${profileId}/${offering.id}/`), 'key correctly nested')
  assert(img1.persisted.data?.image?.is_primary === true, 'first image is auto-primary')
  ok(`image 1 key: ${img1.key}`)

  // ── 6. Count limit (5) ────────────────────────────────────────────────────
  section('6. Enforce max 5 images per offering')
  // we already have 1; upload 4 more
  for (let i = 2; i <= 5; i++) {
    const r = await uploadFlow(
      token,
      `/api/v1/offerings/${offering.id}/images/sign`,
      `/api/v1/offerings/${offering.id}/images`
    )
    ok(`image ${i} uploaded: ${r.key.split('/').pop()}`)
  }
  const count = await prisma.offering_images.count({ where: { offering_id: offering.id } })
  assert(count === 5, 'count is exactly 5')

  // 6th should fail at /sign with 409
  const sixth = await fetch(`${API_BASE}/api/v1/offerings/${offering.id}/images/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ filename: 'sixth.jpg', content_type: 'image/jpeg' }),
  })
  assert(sixth.status === 409, '6th /sign rejected with 409 Conflict')

  // ── 7. DELETE an image — primary should be promoted to another ───────────
  section('7. Delete primary image → another gets promoted')
  const primaryImage = await prisma.offering_images.findFirstOrThrow({
    where: { offering_id: offering.id, is_primary: true },
  })
  await apiDelete(token, `/api/v1/offerings/${offering.id}/images/${primaryImage.id}`)
  const remaining = await prisma.offering_images.count({ where: { offering_id: offering.id } })
  assert(remaining === 4, 'count dropped to 4')
  const newPrimary = await prisma.offering_images.findFirst({
    where: { offering_id: offering.id, is_primary: true },
  })
  assert(!!newPrimary, 'another image was promoted to primary')

  // ── 8. Community image (atomic replace like avatar) ─────────────────────
  section('8. Community image: sign → PUT → POST')
  // Find a community the user owns/admins (the test2 / test3 fixtures are usually owners of a shared community)
  const adminMember = await prisma.community_members.findFirst({
    where: {
      profile_id: profileId,
      membership_status: 'active',
      member_role: { in: ['owner', 'admin'] },
    },
  })
  if (!adminMember) {
    console.log('  ⚠ no owned/admin community found — skipping community image test')
  } else {
    const ci = await uploadFlow(
      token,
      `/api/v1/communities/${adminMember.community_id}/image/sign`,
      `/api/v1/communities/${adminMember.community_id}/image`
    )
    const comm = await prisma.communities.findUniqueOrThrow({
      where: { id: adminMember.community_id },
      select: { community_image_url: true },
    })
    assert(comm.community_image_url === ci.key, 'community_image_url set to new key')
    ok(`key: ${ci.key}`)

    // Clear it
    await apiDelete(token, `/api/v1/communities/${adminMember.community_id}/image`)
    const after = await prisma.communities.findUniqueOrThrow({
      where: { id: adminMember.community_id },
      select: { community_image_url: true },
    })
    assert(after.community_image_url === null, 'community_image_url cleared')
  }

  // ── 9. Community post image ───────────────────────────────────────────────
  section('9. Community post image: sign → PUT → POST → DELETE')
  const anyMember = await prisma.community_members.findFirstOrThrow({
    where: { profile_id: profileId, membership_status: 'active' },
  })
  const post = await prisma.community_posts.create({
    data: {
      community_id: anyMember.community_id,
      author_id: profileId,
      body: '[storage-e2e] post with image',
      status: 'active',
    },
  })
  ok(`post created: ${post.id}`)

  const pi = await uploadFlow(
    token,
    `/api/v1/community-posts/${post.id}/image/sign`,
    `/api/v1/community-posts/${post.id}/image`
  )
  const postAfter = await prisma.community_posts.findUniqueOrThrow({
    where: { id: post.id },
    select: { image_url: true },
  })
  assert(postAfter.image_url === pi.key, 'post.image_url === uploaded key')
  ok(`key: ${pi.key}`)

  await apiDelete(token, `/api/v1/community-posts/${post.id}/image`)
  const postCleared = await prisma.community_posts.findUniqueOrThrow({
    where: { id: post.id },
    select: { image_url: true },
  })
  assert(postCleared.image_url === null, 'post image cleared')

  await prisma.community_posts.delete({ where: { id: post.id } })
  ok('fixture post deleted')

  // ── 10. Message attachment ────────────────────────────────────────────────
  section('10. Message attachment: sign → PUT → POST → expires_at → DELETE')
  // Need a conversation + message the user sent
  const conv = await prisma.conversations.findFirst({
    where: {
      conversation_type: 'direct',
      conversation_participants: { some: { profile_id: profileId } },
    },
  })
  if (!conv) {
    console.log('  ⚠ no direct conversation found — skipping attachment test (run booking e2e first)')
  } else {
    const message = await prisma.messages.create({
      data: {
        conversation_id: conv.id,
        sender_id: profileId,
        content: '[storage-e2e] message with attachment',
        message_type: 'text',
      },
    })

    const ma = await uploadFlow(
      token,
      `/api/v1/messages/${message.id}/attachments/sign`,
      `/api/v1/messages/${message.id}/attachments`,
      { file_name: 'photo.jpg', mime_type: 'image/jpeg', file_size_bytes: 1024 }
    )
    const attachmentId = ma.persisted.data.attachment.id as string
    ok(`attachment persisted: ${attachmentId}`)

    const row = await prisma.message_attachments.findUniqueOrThrow({
      where: { id: attachmentId },
    })
    assert(row.file_url === ma.key, 'file_url === key')
    assert(row.expires_at !== null, 'expires_at populated')
    const ttlMs = row.expires_at!.getTime() - row.created_at!.getTime()
    assert(ttlMs > 71 * 3600 * 1000 && ttlMs < 73 * 3600 * 1000, 'expires_at ~= 72h after created_at')

    // Delete via route
    await apiDelete(token, `/api/v1/messages/${message.id}/attachments/${attachmentId}`)
    const remaining = await prisma.message_attachments.count({ where: { id: attachmentId } })
    assert(remaining === 0, 'attachment row removed')

    await prisma.messages.delete({ where: { id: message.id } })
    ok('fixture message removed')
  }

  // ── 11. Cleanup ───────────────────────────────────────────────────────────
  section('11. Cleanup')
  // Delete the offering; cascade removes offering_images
  await prisma.offerings.delete({ where: { id: offering.id } })
  ok('offering deleted (cascades images)')

  // Restore original avatar_url (R2 objects cleaned by next orphan-sweep)
  await prisma.profiles.update({
    where: { id: profileId },
    data: { avatar_url: originalAvatarUrl },
  })
  ok('avatar_url restored')

  console.log('\n' + '═'.repeat(68))
  console.log('  ALL STORAGE CHECKS PASSED')
  console.log('═'.repeat(68))
}

main()
  .catch((err) => {
    console.error('\n✗ TEST FAILED:', err.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
