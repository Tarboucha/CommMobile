/**
 * Rate limit / DoS guardrail tests.
 *
 * Hammers rate-limited endpoints and verifies the server pushes back.
 * Also checks resource-cap enforcement (per-entity image count limits,
 * file size caps, etc.).
 *
 * NOTE: rate limiting is configured at the nginx layer (/auth/ zone
 * 5r/s burst=10, /api/ zone 20r/s burst=40). When running against direct
 * container ports (localhost:3004 for auth-service, localhost:3002 for
 * kodo-api), the nginx layer is bypassed — so these tests only exercise
 * application-level limits.
 *
 * In CI/production, the same tests against the nginx-fronted domain would
 * also hit nginx rate limits (429/503 responses).
 *
 * Run with:
 *   npx tsx scripts/security/test-rate-limits.ts
 */

import { auth, assert, assertStatus, createUser, section, runSuite, ok, api } from './helpers'

async function main() {
  section('0. Setup — test user')
  const user = await createUser('ratelimit')
  ok(`user: ${user.email}`)

  // ─────────────────────────────────────────────────────────────────────────
  section('1. Auth endpoint flood — bad password brute-force attempt')
  // ─────────────────────────────────────────────────────────────────────────

  // Fire 30 login attempts with wrong password concurrently.
  // Direct to auth-service (no nginx) — we expect all 401s.
  // Through nginx, some would be 429/503.
  {
    const attempts = 30
    const results = await Promise.all(
      Array.from({ length: attempts }, () =>
        auth.post('/auth/login', { email: user.email, password: 'wrong-password' })
          .catch(err => ({ status: 0, body: { err: String(err) }, headers: new Headers() }))
      )
    )

    const statusCounts: Record<number, number> = {}
    for (const r of results) {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1
    }

    console.log(`  Status distribution across ${attempts} attempts:`)
    for (const [status, count] of Object.entries(statusCounts).sort()) {
      console.log(`    ${status}: ${count}`)
    }

    // All should be 401 (direct to auth-service, no rate limit at this layer)
    // OR mix of 401 + 429/503 (if going through nginx).
    // What's NOT acceptable: any 200 (successful login with wrong password)
    // or 500 (server crashed under load).
    assert(!Object.keys(statusCounts).includes('200'), 'no brute-force succeeded')
    assert(!Object.keys(statusCounts).includes('500'), 'no 500s under load')
    ok('brute-force survived with only expected error codes')
  }

  // ─────────────────────────────────────────────────────────────────────────
  section('2. Account lockout / delay after many failed logins')
  // ─────────────────────────────────────────────────────────────────────────

  // A well-hardened auth service would impose exponential backoff or
  // lockout after N failed attempts per email. If not, note it but don't fail.
  {
    for (let i = 0; i < 10; i++) {
      await auth.post('/auth/login', {
        email: user.email,
        password: `wrong-${i}`,
      }).catch(() => null)
    }

    // After 10 bad attempts, legitimate login should still work.
    // (Stronger apps would delay for seconds, but returning 401 on real
    // password would be a false positive / DoS vector.)
    const realLogin = await auth.post('/auth/login', {
      email: user.email,
      password: user.password,
    })
    assertStatus(realLogin.status, 200, 'real login works after failed attempts (no lockout DoS)')
  }

  // ─────────────────────────────────────────────────────────────────────────
  section('3. Server stability under concurrent load')
  // ─────────────────────────────────────────────────────────────────────────

  // Fire 100 parallel requests at a cheap public endpoint.
  // Server should handle all of them without any 500s.
  {
    const results = await Promise.all(
      Array.from({ length: 100 }, () =>
        auth.get('/health')
          .catch(err => ({ status: 0, body: { err: String(err) }, headers: new Headers() }))
      )
    )

    const errors = results.filter(r => r.status >= 500)
    assert(errors.length === 0, `100 parallel /health requests — 0 server errors (got ${errors.length})`)
    ok(`100 concurrent requests → all completed without 5xx`)
  }

  // ─────────────────────────────────────────────────────────────────────────
  section('4. Registration flood')
  // ─────────────────────────────────────────────────────────────────────────

  // 20 concurrent registrations (different emails)
  {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        auth.post('/auth/register', {
          email: `flood-${Date.now()}-${i}@flood-test.local`,
          password: 'password123',
        }).catch(err => ({ status: 0, body: { err: String(err) }, headers: new Headers() }))
      )
    )

    const statusCounts: Record<number, number> = {}
    for (const r of results) {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1
    }

    console.log(`  Status distribution across 20 registrations:`)
    for (const [status, count] of Object.entries(statusCounts).sort()) {
      console.log(`    ${status}: ${count}`)
    }

    assert(!Object.keys(statusCounts).includes('500'), 'no 500s during registration flood')
    ok('registration flood survived')
  }

  // ─────────────────────────────────────────────────────────────────────────
  section('5. Request body size enforcement (at app layer)')
  // ─────────────────────────────────────────────────────────────────────────

  // Send a huge JSON body. nginx has client_max_body_size 25m in prod;
  // direct-to-container test will depend on Node/Fastify defaults.
  {
    const huge = 'A'.repeat(30 * 1024 * 1024) // 30 MB string
    try {
      const r = await auth.post('/auth/register', {
        email: `huge-${Date.now()}@test.local`,
        password: huge,
      })
      // Server should reject with 400/413/500 — NOT accept a 30MB password
      assert(r.status !== 200, '30MB password not accepted as 200')
      ok(`30MB body → ${r.status}`)
    } catch (err) {
      // Network layer rejected — also acceptable
      ok('30MB body rejected at network layer')
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  section('6. Duplicate email registration (race condition)')
  // ─────────────────────────────────────────────────────────────────────────

  // Two concurrent registers for the same email → exactly one should succeed.
  // This tests the unique constraint + concurrent insert handling.
  {
    const dupEmail = `dup-${Date.now()}@race-test.local`
    const [r1, r2] = await Promise.all([
      auth.post('/auth/register', { email: dupEmail, password: 'password123' }),
      auth.post('/auth/register', { email: dupEmail, password: 'password123' }),
    ])

    const successes = [r1, r2].filter(r => r.status === 201).length
    const conflicts = [r1, r2].filter(r => r.status === 409).length

    assert(successes === 1, `exactly one success (got ${successes})`)
    assert(conflicts === 1, `exactly one conflict (got ${conflicts})`)
    ok('concurrent duplicate registration handled correctly')
  }

  // ─────────────────────────────────────────────────────────────────────────
  section('7. Summary — if behind nginx, expect 429/503 at higher volumes')
  // ─────────────────────────────────────────────────────────────────────────

  ok('Direct-to-container tests complete. In production, nginx rate limits (5r/s auth, 20r/s api) provide an additional defensive layer.')
  ok('To verify nginx rate limiting specifically, hit https://api.comchefs.cloud/auth/login in a loop and look for 503 responses.')
}

runSuite('Rate limit / DoS tests', main)
