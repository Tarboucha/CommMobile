import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';

const isDev = __DEV__;
const SOCKET_URL = isDev
  ? Constants.expoConfig?.extra?.socketUrl || process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3002'
  : Constants.expoConfig?.extra?.socketUrlProd || process.env.EXPO_PUBLIC_SOCKET_URL_PROD || 'https://api.kodo.app';

interface UseSocketOptions {
  token?: string;
  profileId?: string;
  autoConnect?: boolean;
}

export function useSocket(options: UseSocketOptions = {}) {
  const { token, profileId, autoConnect = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!autoConnect || !token || !profileId) {
      return;
    }

    // Create socket connection
    const socket = io(SOCKET_URL, {
      auth: {
        token,
        profileId,
      },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      setError(err);
      setIsConnected(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, profileId, autoConnect]);

  const emit = (event: string, data: unknown) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  };

  const on = (event: string, callback: (...args: unknown[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  };

  const off = (event: string, callback?: (...args: unknown[]) => void) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback);
    }
  };

  return {
    socket: socketRef.current,
    isConnected,
    error,
    emit,
    on,
    off,
  };
}
