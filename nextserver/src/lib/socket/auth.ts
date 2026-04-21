import { Socket } from 'socket.io'
import type { AuthenticatedSocket } from '@/types/socket'
import { log } from '@/lib/log'

const socketAuthLog = log.child({ component: 'socket-auth' })

/**
 * Socket.io authentication middleware
 *
 * Verifies JWT tokens during connection handshake.
 * Attaches userId to socket for use in event handlers.
 */
export async function authenticateSocket(
  socket: Socket,
  next: (err?: Error) => void
) {
  try {
    const token = socket.handshake.auth?.token
    const clientProfileId = socket.handshake.auth?.profileId

    if (!token) {
      socketAuthLog.warn({ socketId: socket.id }, 'auth rejected: no token')
      return next(new Error('Authentication token required'))
    }

    if (!clientProfileId) {
      socketAuthLog.warn({ socketId: socket.id }, 'auth rejected: no profileId')
      return next(new Error('Profile ID required'))
    }

    const apiUrl = process.env.NEXT_PUBLIC_APP_URL

    const response = await fetch(`${apiUrl}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      socketAuthLog.warn({
        socketId: socket.id,
        status: response.status,
      }, 'auth rejected: invalid token')
      return next(new Error('Invalid authentication token'))
    }

    const authData = await response.json()

    if (!authData.success || !authData.data?.profile) {
      socketAuthLog.warn({ socketId: socket.id }, 'auth rejected: no profile in response')
      return next(new Error('Authentication failed'))
    }

    const profile = authData.data.profile

    if (clientProfileId !== profile.id) {
      socketAuthLog.error({
        socketId: socket.id,
        clientProfileId,
        tokenProfileId: profile.id,
      }, 'profile ID mismatch — possible token misuse')
      return next(new Error('Invalid profile ID'))
    }

    const authSocket = socket as AuthenticatedSocket
    authSocket.userId = profile.id

    socketAuthLog.info({ socketId: socket.id, profileId: profile.id }, 'socket authenticated')

    next()

  } catch (err) {
    socketAuthLog.error({ err, socketId: socket.id }, 'unexpected auth error')
    next(new Error('Authentication failed'))
  }
}
