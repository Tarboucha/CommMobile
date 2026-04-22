/**
 * End-to-end test for the auth-service.
 *
 * Exercises:
 *   1. Register new user
 *   2. Login (happy path + wrong password)
 *   3. Access token works on /auth/user
 *   4. Refresh token → new access + refresh (rotating)
 *   5. Old refresh token is revoked
 *   6. Change password (with Bearer)
 *   7. Login with new password works
 *   8. Login with old password fails
 *   9. Logout revokes all refresh tokens for that user
 */

import './load-env'
import { Pool } from 'pg'

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3004'
const TEST_EMAIL = `e2e-auth-${Date.now()}@kodo.com`
const PASSWORD = 'initial-pass-123'
const NEW_PASSWORD = 'rotated-pass-456'

// Direct DB access for reaching into auth.email_verifications — the
// verification token isn't returned by any API (it goes out via email),
// so the e2e consumes it straight from the table to simulate the user
// clicking the link.
const db = new Pool({ connectionString: process.env.DATABASE_URL })

// ─── Helpers ────────────────────────────────────────────────────────────────

function section(title: string) { console.log(`\n${'─'.repeat(70)}\n${title}\n${'─'.repeat(70)}`) }
function ok(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { console.log(`  ✗ ${msg}`); throw new Error(msg) }
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) fail(msg); else ok(msg)
}

async function post(path: string, body: unknown, bearer?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (bearer) headers.Authorization = `Bearer ${bearer}`
  const res = await fetch(`${AUTH_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, body: json }
}

async function get(path: string, bearer?: string) {
  const headers: Record<string, string> = {}
  if (bearer) headers.Authorization = `Bearer ${bearer}`
  const res = await fetch(`${AUTH_URL}${path}`, { headers })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, body: json }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  section('1. Health + JWKS')
  const health = await get('/health')
  assert(health.status === 200, 'GET /health → 200')
  const jwks = await get('/.well-known/jwks.json')
  assert(jwks.status === 200, 'GET /.well-known/jwks.json → 200')
  assert(Array.isArray(jwks.body?.keys) && jwks.body.keys.length > 0, 'JWKS has at least one key')

  section('2. Register new user')
  const reg = await post('/auth/register', { email: TEST_EMAIL, password: PASSWORD })
  assert(reg.status === 201, `POST /auth/register → 201 (got ${reg.status})`)

  // Duplicate registration should conflict
  const regDup = await post('/auth/register', { email: TEST_EMAIL, password: PASSWORD })
  assert(regDup.status === 409, 'Duplicate register → 409')

  section('3. Login — wrong password rejected')
  const wrongLogin = await post('/auth/login', { email: TEST_EMAIL, password: 'wrong-pass' })
  assert(wrongLogin.status === 401, 'Login with wrong password → 401')

  section('3a. Login — unverified email blocked with email_not_verified code')
  const unverifiedLogin = await post('/auth/login', { email: TEST_EMAIL, password: PASSWORD })
  assert(unverifiedLogin.status === 403, 'Unverified login → 403')
  assert(unverifiedLogin.body.code === 'email_not_verified', 'Response carries code=email_not_verified')
  assert(unverifiedLogin.body.email === TEST_EMAIL, 'Response echoes the email')

  section('3b. Verify email — consume token from DB and POST /auth/verify-email')
  const { rows: tokenRows } = await db.query(
    `SELECT ev.token
     FROM auth.email_verifications ev
     JOIN auth.users u ON u.id = ev.user_id
     WHERE u.email = $1 AND ev.used_at IS NULL
     ORDER BY ev.created_at DESC LIMIT 1`,
    [TEST_EMAIL]
  )
  assert(tokenRows.length === 1, 'Verification token row exists in DB')
  const verifyResp = await post('/auth/verify-email', { token: tokenRows[0].token })
  assert(verifyResp.status === 200, 'POST /auth/verify-email → 200')

  // Second consume must fail — token is single-use
  const verifyReplay = await post('/auth/verify-email', { token: tokenRows[0].token })
  assert(verifyReplay.status === 400, 'Replay of same token → 400')

  section('4. Login — correct password returns tokens')
  const login = await post('/auth/login', { email: TEST_EMAIL, password: PASSWORD })
  assert(login.status === 200, 'Login → 200')
  assert(typeof login.body.access_token === 'string', 'access_token returned')
  assert(typeof login.body.refresh_token === 'string', 'refresh_token returned')
  assert(login.body.expires_in > 0, 'expires_in > 0')

  const accessToken = login.body.access_token as string
  const refreshToken = login.body.refresh_token as string

  section('5. GET /auth/user with Bearer token')
  const me = await get('/auth/user', accessToken)
  assert(me.status === 200, 'GET /auth/user → 200')
  assert(me.body.email === TEST_EMAIL, 'email matches')

  const noAuth = await get('/auth/user')
  assert(noAuth.status === 401, 'GET /auth/user without token → 401')

  section('6. Refresh token → new pair')
  const refresh = await post('/auth/refresh', { refresh_token: refreshToken })
  assert(refresh.status === 200, 'Refresh → 200')
  assert(refresh.body.access_token !== accessToken, 'new access token differs')
  assert(refresh.body.refresh_token !== refreshToken, 'new refresh token differs')

  const newRefreshToken = refresh.body.refresh_token as string
  const newAccessToken = refresh.body.access_token as string

  section('7. Old refresh token is revoked')
  const replay = await post('/auth/refresh', { refresh_token: refreshToken })
  assert(replay.status === 401, 'Old refresh token → 401 (rotated)')

  section('8. Change password')
  const change = await post(
    '/auth/change-password',
    { current_password: PASSWORD, new_password: NEW_PASSWORD },
    newAccessToken
  )
  assert(change.status === 200, 'Change password → 200')

  // Old password should fail
  const oldLogin = await post('/auth/login', { email: TEST_EMAIL, password: PASSWORD })
  assert(oldLogin.status === 401, 'Login with old password → 401')

  // New password works
  const newLogin = await post('/auth/login', { email: TEST_EMAIL, password: NEW_PASSWORD })
  assert(newLogin.status === 200, 'Login with new password → 200')

  section('9. Change-password revoked all old refresh tokens')
  const staleRefresh = await post('/auth/refresh', { refresh_token: newRefreshToken })
  assert(staleRefresh.status === 401, 'Refresh token from before password change → 401')

  section('10. Logout revokes refresh tokens')
  const postChangeToken = newLogin.body.access_token as string
  const postChangeRefresh = newLogin.body.refresh_token as string

  const logout = await post('/auth/logout', {}, postChangeToken)
  assert(logout.status === 200, 'Logout → 200')

  const refreshAfterLogout = await post('/auth/refresh', { refresh_token: postChangeRefresh })
  assert(refreshAfterLogout.status === 401, 'Refresh after logout → 401')

  console.log('\n' + '═'.repeat(68))
  console.log('  ALL AUTH CHECKS PASSED')
  console.log('═'.repeat(68))
}

main()
  .then(() => db.end())
  .catch(async (err) => {
    console.error('\n✗ TEST FAILED:', err.message)
    await db.end().catch(() => {})
    process.exit(1)
  })
