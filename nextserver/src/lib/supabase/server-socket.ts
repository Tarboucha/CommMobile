import { createClient } from '@supabase/supabase-js'

/**
 * Supabase client for Socket.io connections (anon key)
 *
 * Unlike the standard server client, this doesn't rely on cookies
 * because Socket.io connections don't have HTTP cookie context.
 *
 * Used exclusively for verifying JWT tokens during Socket.io handshake.
 */
export function createSocketClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_OR_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false, // Don't persist sessions (stateless verification)
      autoRefreshToken: false, // Don't auto-refresh (just verify)
    }
  })
}
