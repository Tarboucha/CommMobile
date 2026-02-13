import { Socket } from 'socket.io-client'

export interface SocketContextValue {
  socket: Socket | null
  isConnected: boolean
  badgeCount: number
  setBadgeCount: (count: number) => void
}
