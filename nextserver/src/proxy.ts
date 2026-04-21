import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { log } from '@/lib/log'

export default function proxy(request: NextRequest) {
  // Log every incoming request at debug level — set LOG_LEVEL=debug to see.
  log.debug({
    req: {
      method: request.method,
      url: request.nextUrl.pathname,
    },
    origin: request.headers.get('origin'),
    userAgent: request.headers.get('user-agent'),
    hasAuthHeader: !!request.headers.get('authorization'),
  }, 'incoming proxy request')

  // Handle preflight OPTIONS requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': getAllowedOrigin(request),
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  // Add CORS headers to all responses
  const response = NextResponse.next()
  response.headers.set('Access-Control-Allow-Origin', getAllowedOrigin(request))
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
  response.headers.set('Access-Control-Allow-Credentials', 'true')

  return response
}

function getAllowedOrigin(request: NextRequest): string {
  const origin = request.headers.get('origin')
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || []

  // Check exact match
  if (origin && allowedOrigins.includes(origin)) {
    return origin
  }

  // Check wildcard patterns (e.g., exp://192.168.*, http://192.168.*:8081)
  if (origin) {
    for (const allowed of allowedOrigins) {
      if (allowed.includes('*')) {
        const pattern = new RegExp('^' + allowed.replace(/\*/g, '.*').replace(/\./g, '\\.') + '$')
        if (pattern.test(origin)) {
          return origin
        }
      }
    }
  }

  // Default: allow localhost in development
  if (process.env.NODE_ENV === 'development') {
    return origin || '*'
  }

  // Production: only allow configured origins
  return allowedOrigins[0] || ''
}

export const config = {
  matcher: '/api/:path*',
}
