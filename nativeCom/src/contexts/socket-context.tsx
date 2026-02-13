import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { AppState, AppStateStatus } from 'react-native'
import { io, Socket } from 'socket.io-client'
import Toast from 'react-native-toast-message'
import { useAuthStore } from '@/lib/stores/auth-store'
import { supabase } from '@/lib/supabase/client'
import type { SocketContextValue } from '@/types/socket'
import { handleError } from '@/lib/services/error-service'

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  badgeCount: 0,
  setBadgeCount: () => {},
})

export const useSocket = () => useContext(SocketContext)

interface SocketProviderProps {
  children: React.ReactNode
}

/**
 * SocketProvider
 *
 * Manages Socket.io connection lifecycle based on:
 * - User authentication status (only connect when logged in)
 * - App state (disconnect when app goes to background, reconnect when active)
 */
export function SocketProvider({ children }: SocketProviderProps) {
  const user = useAuthStore((state) => state.user)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [badgeCount, setBadgeCount] = useState(0)
  const appState = useRef(AppState.currentState)

  const socketUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3002'

  // Handle badge update — just update the count
  const handleBadgeUpdate = useCallback((event: { badge_count: number }) => {
    setBadgeCount(event.badge_count)
  }, [])

  // Handle new notification — show toast with actual content
  const handleNewNotification = useCallback((event: {
    id: string
    type: string
    title: string
    body?: string
    data?: Record<string, unknown>
    created_at: string
  }) => {
    Toast.show({
      type: 'success',
      text1: event.title,
      text2: event.body || undefined,
      position: 'top',
      visibilityTime: 4000,
      autoHide: true,
      topOffset: 60,
    })
  }, [])

  useEffect(() => {
    if (!user) return

    let currentSocket: Socket | null = null

    const connectSocket = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.access_token) {
          console.log('[Socket] No access token, skipping connection')
          return
        }

        console.log('[Socket] Connecting to', socketUrl, '— user:', user.id)
        currentSocket = io(socketUrl, {
          auth: {
            token: session.access_token,
            profileId: user.id,
          },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5,
        })

        currentSocket.on('connect', () => {
          console.log('[Socket] Connected — id:', currentSocket?.id)
          setIsConnected(true)
        })

        currentSocket.on('connected', (data) => {
          console.log('[Socket] Server confirmed connection:', data)
        })

        currentSocket.on('connect_error', (err) => {
          console.log('[Socket] Connect error:', err.message)
          setIsConnected(false)
        })

        currentSocket.on('disconnect', (reason) => {
          console.log('[Socket] Disconnected — reason:', reason)
          setIsConnected(false)
        })

        currentSocket.on('reconnect_attempt', (attempt) => {
          console.log('[Socket] Reconnect attempt:', attempt)
        })

        currentSocket.on('reconnect', () => {
          console.log('[Socket] Reconnected')
          setIsConnected(true)
        })

        currentSocket.on('reconnect_failed', () => {
          console.log('[Socket] Reconnect failed')
          setIsConnected(false)
        })

        // Notification events
        currentSocket.on('notification:badge_update', handleBadgeUpdate)
        currentSocket.on('notification:new', handleNewNotification)

        setSocket(currentSocket)
      } catch (error) {
        handleError(error, { severity: 'silent', screen: 'socket' })
      }
    }

    connectSocket()

    return () => {
      if (currentSocket) {
        currentSocket.disconnect()
        setSocket(null)
        setIsConnected(false)
      }
    }
  }, [user, socketUrl, handleBadgeUpdate, handleNewNotification])

  // Handle app state changes (foreground/background)
  useEffect(() => {
    if (!socket || !user) return

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/active/) &&
        nextAppState.match(/inactive|background/)
      ) {
        socket.disconnect()
        setIsConnected(false)
      }

      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        socket.connect()
      }

      appState.current = nextAppState
    })

    return () => {
      subscription.remove()
    }
  }, [socket, user])

  const contextValue = useMemo(() => ({
    socket,
    isConnected,
    badgeCount,
    setBadgeCount,
  }), [socket, isConnected, badgeCount])

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  )
}
