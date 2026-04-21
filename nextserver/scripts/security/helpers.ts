/**
 * Shared helpers for security test scripts.
 *
 * Assumes a running local stack (docker compose up). Provides:
 *   - fresh user registration (random email per test run → no collision)
 *   - HTTP helpers with auth
 *   - assertion helpers matching the existing e2e script style
 */

import '../load-env'

export const API = process.env.API_BASE || 'http://localhost:3002'
export const AUTH = process.env.AUTH_SERVICE_URL || 'http://localhost:3004'

// ─── Console helpers ───────────────────────────────────────────────────────

export function section(title: string) {
  console.log(`\n${'─'.repeat(70)}\n${title}\n${'─'.repeat(70)}`)
}

export function ok(msg: string) {
  console.log(`  ✓ ${msg}`)
}

export function fail(msg: string): never {
  console.log(`  ✗ ${msg}`)
  throw new Error(msg)
}

export function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) fail(msg)
  else ok(msg)
}

export function assertStatus(
  actual: number,
  expected: number | number[],
  msg: string
) {
  const expectedArr = Array.isArray(expected) ? expected : [expected]
  if (!expectedArr.includes(actual)) {
    fail(`${msg} (got ${actual}, expected ${expectedArr.join(' or ')})`)
  }
  ok(`${msg} (got ${actual})`)
}

// ─── HTTP helpers ──────────────────────────────────────────────────────────

export interface HttpResponse<T = any> {
  status: number
  body: T
  headers: Headers
}

export async function http<T = any>(
  method: string,
  url: string,
  opts: { token?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<HttpResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...opts.headers,
  }
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`

  const res = await fetch(url, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })

  const text = await res.text()
  let parsed: any
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = { raw: text }
  }

  return { status: res.status, body: parsed, headers: res.headers }
}

export const api = {
  get: <T = any>(token: string | undefined, path: string) =>
    http<T>('GET', `${API}${path}`, { token }),
  post: <T = any>(token: string | undefined, path: string, body?: unknown) =>
    http<T>('POST', `${API}${path}`, { token, body }),
  patch: <T = any>(token: string | undefined, path: string, body?: unknown) =>
    http<T>('PATCH', `${API}${path}`, { token, body }),
  put: <T = any>(token: string | undefined, path: string, body?: unknown) =>
    http<T>('PUT', `${API}${path}`, { token, body }),
  delete: <T = any>(token: string | undefined, path: string) =>
    http<T>('DELETE', `${API}${path}`, { token }),
}

export const auth = {
  post: <T = any>(path: string, body?: unknown) =>
    http<T>('POST', `${AUTH}${path}`, { body }),
  postWithToken: <T = any>(token: string, path: string, body?: unknown) =>
    http<T>('POST', `${AUTH}${path}`, { token, body }),
  get: <T = any>(path: string) => http<T>('GET', `${AUTH}${path}`),
  getWithToken: <T = any>(token: string, path: string) =>
    http<T>('GET', `${AUTH}${path}`, { token }),
}

// ─── User registration + login ─────────────────────────────────────────────

export interface TestUser {
  email: string
  password: string
  userId: string
  accessToken: string
  refreshToken: string
}

function randomEmail(prefix: string): string {
  // Use high-entropy suffix so parallel tests don't collide
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return `${prefix}-${suffix}@security-test.local`
}

export async function createUser(prefix = 'sec'): Promise<TestUser> {
  const email = randomEmail(prefix)
  const password = 'security-test-password-123'

  const reg = await auth.post('/auth/register', { email, password })
  if (reg.status !== 201) {
    throw new Error(`register failed: ${reg.status} ${JSON.stringify(reg.body)}`)
  }

  const login = await auth.post('/auth/login', { email, password })
  if (login.status !== 200) {
    throw new Error(`login failed: ${login.status} ${JSON.stringify(login.body)}`)
  }

  const me = await auth.getWithToken(login.body.access_token, '/auth/user')
  if (me.status !== 200) {
    throw new Error(`me failed: ${me.status}`)
  }

  return {
    email,
    password,
    userId: me.body.id,
    accessToken: login.body.access_token,
    refreshToken: login.body.refresh_token,
  }
}

export async function createUsers(count: number, prefix = 'sec'): Promise<TestUser[]> {
  return Promise.all(Array.from({ length: count }, () => createUser(prefix)))
}

// ─── Suite runner ──────────────────────────────────────────────────────────

export async function runSuite(name: string, fn: () => Promise<void>) {
  console.log('\n' + '═'.repeat(70))
  console.log(`  ${name}`)
  console.log('═'.repeat(70))

  try {
    await fn()
  } catch (err) {
    console.error(`\n✗ SUITE FAILED: ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  }

  console.log('\n' + '═'.repeat(70))
  console.log(`  ${name} — ALL PASSED`)
  console.log('═'.repeat(70))
}
