import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyJWT } from '@/lib/auth-jwt'
import { logger } from '@/lib/server-logger'
import { getForbiddenReason, isPublicRoute } from '@/lib/middleware-rules'

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
    })
      .then((res) => {
        // A 403 here means INTERNAL_SECURITY_KEY is missing/wrong — say so
        // instead of losing every security event silently.
        if (!res.ok) {
          logger.error('MIDDLEWARE_SECURITY', `Security log rejected with HTTP ${res.status}`, { event })
        }
      })
      .catch(err => logger.error('MIDDLEWARE_SECURITY', 'Failed to send security log', err))
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

  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const host = request.headers.get('host')
  const reason = getForbiddenReason({ pathname, origin, referer, host })
  if (reason) {
    await logSecurityEvent('FORBIDDEN_REQUEST', { reason, origin, referer, host }, request)
    return new NextResponse('Forbidden', { status: 403 })
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
