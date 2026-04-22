import { createRemoteJWKSet, jwtVerify } from 'jose'

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs')
)

const GOOGLE_ISS = new Set([
  'accounts.google.com',
  'https://accounts.google.com',
])

export interface GoogleClaims {
  sub: string
  email: string
  email_verified: boolean
  name?: string
  picture?: string
}

/**
 * Verify a Google-issued ID token.
 *
 * Checks the RS256 signature against Google's rotating JWKS, enforces the
 * `iss` + `aud` claims, and requires `email_verified=true`. Throws on any
 * failure — callers should treat that as "sign-in rejected".
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleClaims> {
  const audience = process.env.GOOGLE_WEB_CLIENT_ID
  if (!audience) {
    throw new Error('GOOGLE_WEB_CLIENT_ID is not set')
  }

  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    audience,
    algorithms: ['RS256'],
  })

  if (!payload.iss || !GOOGLE_ISS.has(payload.iss)) {
    throw new Error(`Invalid issuer: ${payload.iss}`)
  }

  const email = payload['email']
  const emailVerified = payload['email_verified']
  if (!payload.sub || typeof email !== 'string' || emailVerified !== true) {
    throw new Error('Missing or unverified email claim')
  }

  return {
    sub: payload.sub,
    email: email.toLowerCase().trim(),
    email_verified: true,
    name: payload['name'] as string | undefined,
    picture: payload['picture'] as string | undefined,
  }
}
