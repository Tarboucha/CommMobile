import { Socket } from 'socket.io'
import type { AuthenticatedSocket } from '@/types/socket'

/**
 * Socket.io authentication middleware
 *
 * Verifies Supabase JWT tokens during connection handshake.
 * Attaches userId to socket for use in event handlers.
 *
 * Usage in custom-server.ts:
 *   io.use(authenticateSocket)
 */
export async function authenticateSocket(
  socket: Socket,
  next: (err?: Error) => void
) {
  try {
    // 1. Extract JWT token and profile ID sent by client during handshake
    // Client sends: io({ auth: { token, profileId } })
    // Server receives in socket.handshake.auth
    const token = socket.handshake.auth?.token
    const clientProfileId = socket.handshake.auth?.profileId

    if (!token) {
      console.log(`[Auth] ❌ No token provided from ${socket.id}`)
      return next(new Error('Authentication token required'))
    }

    if (!clientProfileId) {
      console.log(`[Auth] ❌ No profile ID provided from ${socket.id}`)
      return next(new Error('Profile ID required'))
    }

    // 2. Verify Bearer token (sent by client) with backend API
    // Client got this token from Supabase login and sends it during Socket.io connection
    // We validate it the same way as normal API requests (via /api/auth/me)
    const apiUrl = process.env.NEXT_PUBLIC_APP_URL 

    const response = await fetch(`${apiUrl}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,  // Use client-provided token
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.log(`[Auth] ❌ Invalid token from ${socket.id}: HTTP ${response.status}`)
      return next(new Error('Invalid authentication token'))
    }

    const authData = await response.json()

    if (!authData.success || !authData.data?.profile) {
      console.log(`[Auth] ❌ Auth failed from ${socket.id}: No profile in response`)
      return next(new Error('Authentication failed'))
    }

    const profile = authData.data.profile

    // 3. SECURITY: Validate that client-sent profile ID matches the token's actual owner
    // Client sends both token AND profileId, but we trust ONLY what the backend returns
    // This prevents a malicious client from using a stolen token with a different profile ID
    if (clientProfileId !== profile.id) {
      console.error(`[Auth] 🚨 SECURITY: Profile ID mismatch! Client sent: ${clientProfileId}, Token belongs to: ${profile.id}`)
      return next(new Error('Invalid profile ID'))
    }

    // 4. Attach VERIFIED profile ID to socket (from backend, NOT from client claim)
    const authSocket = socket as AuthenticatedSocket
    authSocket.userId = profile.id  // Use verified ID from backend API, not client-sent ID

    console.log(`[Auth] ✅ Socket ${socket.id} → Profile ${profile.id}`)

    // 5. Allow connection
    next()

  } catch (error) {
    console.error('[Auth] ❌ Unexpected error:', error)
    next(new Error('Authentication failed'))
  }
}
