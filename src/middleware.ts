import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyJWT } from '@/lib/auth-jwt'
import { logger } from '@/lib/server-logger'

// Basic Rate Limiter (Memory)
const rateLimitMap = new Map<string, { count: number, timestamp: number }>()
const MAX_RATE_LIMIT_ENTRIES = 10000 
let middlewareRequestCount = 0

async function logSecurityEvent(event: string, details: any, request?: NextRequest) {
  try {
    const origin = request?.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || ''
    const body = {
      event,
      ipAddress: request?.headers.get('x-forwarded-for') || request?.headers.get('x-real-ip') || 'unknown',
      userAgent: request?.headers.get('user-agent'),
      path: request?.nextUrl.pathname,
      details
    }
    
    // We use a non-blocking fetch to not slow down the request
    fetch(`${origin}/api/admin/security`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-security-key': process.env.INTERNAL_SECURITY_KEY || ''
      },
      body: JSON.stringify(body)
    }).catch(err => logger.error('MIDDLEWARE_SECURITY', 'Failed to send security log', err))
  } catch (e) {
    logger.error('MIDDLEWARE_SECURITY', 'Fatal error in security logging', e)
  }
}


export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Rate Limiting Logic
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  const windowMs = 60 * 1000 // 1 minute
  const maxRequests = 200 // Max 200 reqs per minute
  
  const now = Date.now()
  const currentLimit = rateLimitMap.get(ip)
  
  if (currentLimit) {
    if (now - currentLimit.timestamp > windowMs) {
      rateLimitMap.set(ip, { count: 1, timestamp: now })
    } else {
      currentLimit.count += 1
      if (currentLimit.count > maxRequests) {
        if (currentLimit.count === maxRequests + 1) {
          logSecurityEvent('RATE_LIMIT_HIT', { count: currentLimit.count }, request)
        }
        return new NextResponse('Too Many Requests', { status: 429 })
      }
    }
  } else {
    // Prevent memory leak by checking size before adding new entry
    if (rateLimitMap.size >= MAX_RATE_LIMIT_ENTRIES) {
      // Improved cleanup: remove the oldest 5% of entries
      const keysToDelete = Array.from(rateLimitMap.keys()).slice(0, 500)
      keysToDelete.forEach(key => rateLimitMap.delete(key))
    }
    rateLimitMap.set(ip, { count: 1, timestamp: now })
  }
  
  // Clean up old entries periodically (every 100 requests)
  middlewareRequestCount++
  if (middlewareRequestCount >= 100) {
    middlewareRequestCount = 0
    for (const [key, val] of rateLimitMap.entries()) {
      if (now - val.timestamp > windowMs) {
        rateLimitMap.delete(key)
      }
    }
  }

  const publicRoutes = [
    '/login',
    '/api/auth/signin',
    '/api/auth/callback',
    '/api/auth/session',
    '/',
  ]
  
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Prevent external API calls directly if they are not public auth routes
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) {
    // Just a basic origin check to protect from simple external hits
    const origin = request.headers.get('origin')
    const referer = request.headers.get('referer')
    const host = request.headers.get('host')
    
    let isForbidden = false
    let reason = ''

    // In local dev, host might be localhost:3000, referer might be the same.
    // origin will also be localhost:3000.
    if (origin && host && !origin.includes(host)) {
      isForbidden = true
      reason = 'ORIGIN_MISMATCH'
    } else if (referer && host && !referer.includes(host) && !pathname.startsWith('/api/webhooks')) {
      // Stricter check: referer must also match if present
      // Exceptions for webhooks if they existed
      isForbidden = true
      reason = 'REFERER_MISMATCH'
    }

    if (isForbidden) {
      await logSecurityEvent('FORBIDDEN_REQUEST', { reason, origin, referer, host })
      return new NextResponse('Forbidden', { status: 403 })
    }
  }
  
  const protectedRoutes = ['/dashboard', '/link-character']
  
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    const token = request.cookies.get('session')?.value
    
    if (!token) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }
    
    const payload = await verifyJWT(token)
    
    if (!payload) {
      const response = NextResponse.redirect(new URL('/login', request.url))
      response.cookies.delete('session')
      return response
    }
    
    return NextResponse.next()
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/link-character/:path*', '/api/:path*'],
}
