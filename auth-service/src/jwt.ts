import { SignJWT, jwtVerify } from 'jose'
import { loadKeys } from './keys.js'

const ACCESS_TOKEN_TTL = 60 * 60          // 1 hour (seconds)
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60  // 30 days (seconds)

export interface AccessTokenPayload {
  sub: string    // profile ID
  email: string
  role: string
}

/**
 * Sign an ES256 access token.
 * sub = profile ID (not auth user ID)
 */
export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  const { privateKey } = await loadKeys()
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: 'ES256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL}s`)
    .sign(privateKey)
}

/**
 * Verify an ES256 access token using the in-process public key.
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { publicKey } = await loadKeys()
  const { payload } = await jwtVerify(token, publicKey, { algorithms: ['ES256'] })
  return {
    sub: payload.sub!,
    email: payload['email'] as string,
    role: payload['role'] as string,
  }
}

/** Generate a cryptographically random refresh token (64-byte hex). */
export function generateRefreshToken(): string {
  const bytes = new Uint8Array(64)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL }
