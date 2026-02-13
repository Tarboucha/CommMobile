import { createServerClient } from '@supabase/ssr'
import { headers } from 'next/headers'
import type { NextRequest } from 'next/server'
import { Database } from '@/types/supabase'

/**
 * Extract Bearer token from Authorization header
 */
export function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }
  return authHeader.substring(7)
}

/**
 * Create Supabase client from NextRequest (reads token from Authorization header)
 * Use this for mobile app requests that send JWT tokens via headers
 */
export function createClientFromRequest(request: NextRequest) {
  const bearerToken = extractBearerToken(request)

  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('[createClientFromRequest] Authorization header:', request.headers.get('authorization') ? 'Present' : 'Missing')
    console.log('[createClientFromRequest] Bearer token extracted:', bearerToken ? 'Yes' : 'No')
  }

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_OR_PUBLISHABLE_KEY!,
    {
      cookies: {
        // Mobile-only backend - no cookies needed
        getAll() {
          return []
        },
        setAll() {
          // No-op for mobile
        },
      },
      // Use JWT token from Authorization header
      // IMPORTANT: Must include apikey header along with Authorization
      global: bearerToken ? {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_OR_PUBLISHABLE_KEY!,
        },
      } : undefined,
    }
  )
}

/**
 * Create Supabase client using headers() from Next.js context
 * This is the legacy method - use createClientFromRequest() instead for mobile
 */
export async function createClient() {
  const headerStore = await headers()

  // Mobile apps send JWT token in Authorization header
  const authHeader = headerStore.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : null

  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('[createClient] Authorization header:', authHeader ? 'Present' : 'Missing')
    console.log('[createClient] Bearer token extracted:', bearerToken ? 'Yes' : 'No')
  }

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_OR_PUBLISHABLE_KEY!,
    {
      cookies: {
        // Mobile-only backend - no cookies needed
        getAll() {
          return []
        },
        setAll() {
          // No-op for mobile
        },
      },
      // Use JWT token from Authorization header
      // IMPORTANT: Must include apikey header along with Authorization
      global: bearerToken ? {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_OR_PUBLISHABLE_KEY!,
        },
      } : undefined,
    }
  )
}