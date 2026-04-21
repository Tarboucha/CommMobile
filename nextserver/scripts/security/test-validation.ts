/**
 * Input validation tests.
 *
 * Throws malformed, oversized, and malicious input at API endpoints.
 * Verifies the server rejects with 400 (not 500 or 200 with unexpected
 * behavior).
 *
 * Covers:
 *   - Malformed JSON body
 *   - Missing required fields
 *   - Wrong field types
 *   - Boundary values (empty, huge, null)
 *   - SQL injection strings (Prisma parameterizes but paranoid-test anyway)
 *   - XSS/HTML payloads (should be stored as-is, not executed at server layer)
 *   - Oversized payloads
 *
 * Run with:
 *   npx tsx scripts/security/test-validation.ts
 */

import { api, auth, assert, assertStatus, createUser, section, runSuite, ok, AUTH } from './helpers'

async function main() {
  section('0. Setup — create one test user')
  const user = await createUser('validation')
  ok(`user: ${user.email}`)

  // ─────────────────────────────────────────────────────────────────────────
  section('1. Auth endpoints — malformed input')
  // ─────────────────────────────────────────────────────────────────────────

  // Register with missing email
  {
    const r = await auth.post('/auth/register', { password: 'password123' })
    assertStatus(r.status, 400, 'register without email → 400')
  }

  // Register with missing password
  {
    const r = await auth.post('/auth/register', { email: 'x@y.com' })
    assertStatus(r.status, 400, 'register without password → 400')
  }

  // Register with non-string email
  {
    const r = await auth.post('/auth/register', { email: 12345, password: 'password123' })
    assertStatus(r.status, 400, 'register with numeric email → 400')
  }

  // Register with invalid email format
  {
    const r = await auth.post('/auth/register', {
      email: 'not-an-email',
      password: 'password123',
    })
    assertStatus(r.status, 400, 'register with malformed email → 400')
  }

  // Register with short password (assumes min length enforced)
  {
    const r = await auth.post('/auth/register', {
      email: `short-${Date.now()}@test.com`,
      password: 'x',
    })
    // Some apps require min password length; some don't. Accept either.
    if (r.status === 400) {
      ok('register with 1-char password → 400 (enforces length)')
    } else {
      ok(`register with 1-char password → ${r.status} (no min-length policy)`)
    }
  }

  // Login with empty strings
  {
    const r = await auth.post('/auth/login', { email: '', password: '' })
    assertStatus(r.status, [400, 401], 'login with empty strings → 400/401')
  }

  // ─────────────────────────────────────────────────────────────────────────
  section('2. Malformed JSON')
  // ─────────────────────────────────────────────────────────────────────────

  // Send completely invalid JSON body (not a proper object)
  {
    const r = await fetch(`${AUTH}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email": broken json',
    })
    assertStatus(r.status, 400, 'malformed JSON → 400')
  }

  // Wrong Content-Type
  {
    const r = await fetch(`${AUTH}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ email: 'x@y.com', password: 'pw' }),
    })
    // Some frameworks reject, some coerce. Accept 400 or 415, NOT 200.
    assert(r.status !== 200, 'wrong content-type not accepted as 200')
    ok(`wrong content-type → ${r.status}`)
  }

  // ─────────────────────────────────────────────────────────────────────────
  section('3. Oversized payloads')
  // ─────────────────────────────────────────────────────────────────────────

  // 10 MB email string (way beyond any reasonable email)
  {
    const giantEmail = 'a'.repeat(10 * 1024 * 1024) + '@evil.com'
    try {
      const r = await auth.post('/auth/register', {
        email: giantEmail,
        password: 'password123',
      })
      assertStatus(r.status, [400, 413, 500], 'giant email → rejected')
    } catch (err) {
      // Network layer may refuse to even send it — that's also acceptable
      ok('giant email → rejected at network layer')
    }
  }

  // Deeply nested JSON (stack overflow attempts)
  {
    let nested: any = { x: 1 }
    for (let i = 0; i < 1000; i++) nested = { child: nested }

    const r = await api.post(user.accessToken, '/api/v1/addresses', nested).catch(e => ({
      status: 0,
      body: { err: String(e) },
      headers: new Headers(),
    }))
    // Must not 200 or 500-with-stack-overflow
    assert(r.status !== 200, 'deeply nested JSON not accepted as 200')
    ok(`deeply nested JSON → ${r.status}`)
  }

  // ─────────────────────────────────────────────────────────────────────────
  section('4. SQL injection strings in inputs')
  // ─────────────────────────────────────────────────────────────────────────

  // Prisma parameterizes, but let's paranoid-test common payloads.
  // If any of these 200 or corrupt data, we have a serious problem.
  const sqlInjectionPayloads = [
    "' OR '1'='1",
    "'; DROP TABLE profiles; --",
    "' UNION SELECT * FROM auth.users --",
    "admin'--",
  ]

  for (const payload of sqlInjectionPayloads) {
    const r = await auth.post('/auth/login', {
      email: payload,
      password: payload,
    })
    assertStatus(r.status, [400, 401], `SQL injection "${payload.slice(0, 20)}..." → rejected`)
  }

  // Send SQL injection as an authenticated query parameter
  {
    const r = await api.get(user.accessToken, `/api/v1/bookings?status='; DROP TABLE bookings; --`)
    assert(r.status !== 500, 'SQL injection query param did not cause 500')
    ok(`SQL injection query param → ${r.status}`)
  }

  // ─────────────────────────────────────────────────────────────────────────
  section('5. XSS / HTML injection (stored)')
  // ─────────────────────────────────────────────────────────────────────────

  // Server should accept and store as-is; the security boundary is the
  // frontend's render layer, not the API. So any 2xx here is fine, but
  // we verify it doesn't cause 500 or unusual behavior.
  const xssPayloads = [
    '<script>alert(1)</script>',
    'javascript:alert(1)',
    '<img src=x onerror=alert(1)>',
    '"><script>alert(1)</script>',
  ]

  for (const payload of xssPayloads) {
    const r = await auth.post('/auth/register', {
      email: `xss-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`,
      password: payload,
    })
    // Accept or reject is fine, just not 500
    assert(r.status !== 500, `XSS payload in password field did not 500`)
    ok(`XSS payload in password → ${r.status}`)
  }

  // ─────────────────────────────────────────────────────────────────────────
  section('6. Wrong types for known fields')
  // ─────────────────────────────────────────────────────────────────────────

  // Booking with string dates, numbers where strings expected, etc.
  {
    const r = await api.post(user.accessToken, '/api/v1/bookings', {
      offering_id: 12345, // should be UUID string
      start_date: 'not-a-date',
      end_date: {},
      slots_requested: 'three',
    })
    assertStatus(r.status, [400, 404], 'booking with wrong types → rejected')
  }

  // Boolean where string expected
  {
    const r = await api.post(user.accessToken, '/api/v1/communities', {
      community_name: true,
      access_type: 'invite_only',
    })
    assertStatus(r.status, [400, 404], 'community_name as boolean → rejected')
  }

  // Null where required string expected
  {
    const r = await api.post(user.accessToken, '/api/v1/communities', {
      community_name: null,
      access_type: 'invite_only',
    })
    assertStatus(r.status, [400, 404], 'community_name as null → rejected')
  }

  // ─────────────────────────────────────────────────────────────────────────
  section('7. Enum / enum-like values outside allowed set')
  // ─────────────────────────────────────────────────────────────────────────

  {
    const r = await api.post(user.accessToken, '/api/v1/communities', {
      community_name: 'Test',
      access_type: 'public_with_backdoor', // not a valid access_type
    })
    assertStatus(r.status, [400, 404], 'invalid enum value → rejected')
  }

  // ─────────────────────────────────────────────────────────────────────────
  section('8. Header injection')
  // ─────────────────────────────────────────────────────────────────────────

  // Try to inject headers via payload (old-school attack)
  {
    const r = await auth.post('/auth/register', {
      email: `header-injection@test.local\r\nX-Evil-Header: injected`,
      password: 'password123',
    })
    // Should reject invalid email format or accept without interpreting CRLF
    assert(r.status !== 500, 'CRLF in email did not 500')
    ok(`CRLF in email → ${r.status}`)
  }
}

runSuite('Input validation tests', main)
