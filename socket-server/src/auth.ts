import { Socket } from 'socket.io'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { AuthenticatedSocket } from './types/socket'
import { log } from './log'

const authLog = log.child({ component: 'socket-auth' })

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3004'

// Fetch and cache auth-service's public keys from JWKS endpoint.
// Keys are cached in-process — no refetch per connection.
const JWKS = createRemoteJWKSet(
  new URL(`${AUTH_SERVICE_URL}/.well-known/jwks.json`)
)

/**
 * Socket.io authentication middleware
 *
 * Verifies JWT locally using auth-service's public JWKS key (ES256).
 * sub = profile ID directly — no DB lookup needed.
 */
export async function authenticateSocket(
  socket: Socket,
  next: (err?: Error) => void
) {
  try {
    const token = socket.handshake.auth?.token
    const clientProfileId = socket.handshake.auth?.profileId

    if (!token) {
      authLog.warn({ socketId: socket.id }, 'auth rejected: no token')
      return next(new Error('Authentication token required'))
    }

    if (!clientProfileId) {
      authLog.warn({ socketId: socket.id }, 'auth rejected: no profileId')
      return next(new Error('Profile ID required'))
    }

    // Verify JWT using auth-service public JWKS (ES256)
    let payload: { sub?: string }
    try {
      const result = await jwtVerify(token, JWKS, { algorithms: ['ES256'] })
      payload = result.payload
    } catch {
      authLog.warn({ socketId: socket.id }, 'auth rejected: invalid JWT')
      return next(new Error('Invalid authentication token'))
    }

    if (!payload.sub) {
      return next(new Error('Invalid token: missing sub claim'))
    }

    // sub = profile ID directly (no DB lookup needed)
    const profileId = payload.sub

    // Security: client-sent profileId must match the token's sub
    if (clientProfileId !== profileId) {
      authLog.error(
        { socketId: socket.id, clientProfileId, tokenProfileId: profileId },
        'profile ID mismatch — possible token misuse'
      )
      return next(new Error('Invalid profile ID'))
    }

    // Attach verified profile ID from token
    ;(socket as AuthenticatedSocket).userId = profileId
    authLog.info({ socketId: socket.id, profileId }, 'socket authenticated')
    next()

  } catch (err) {
    authLog.error({ err, socketId: socket.id }, 'unexpected auth error')
    next(new Error('Authentication failed'))
  }
}
