import { createRemoteJWKSet, jwtVerify } from 'jose'

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3004'

const JWKS = createRemoteJWKSet(
  new URL(`${AUTH_SERVICE_URL}/.well-known/jwks.json`)
)

export interface JWTClaims {
  sub: string    // profile ID (not auth user ID)
  email: string
  role: string
}

/**
 * Verify an ES256 JWT from auth-service using its JWKS endpoint.
 * The public key is fetched once and cached in-process.
 */
export async function verifyToken(token: string): Promise<JWTClaims> {
  const { payload } = await jwtVerify(token, JWKS, { algorithms: ['ES256'] })
  return {
    sub: payload.sub!,
    email: payload['email'] as string,
    role: payload['role'] as string,
  }
}
