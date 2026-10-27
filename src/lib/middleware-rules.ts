/**
 * Pure routing decisions of src/middleware.ts, kept free of NextRequest so they
 * can be unit-tested (the jsdom Jest environment has no Request/Response).
 */

const PUBLIC_ROUTE_PREFIXES = ['/login', '/api/auth/signin', '/api/auth/callback', '/api/auth/session']

/**
 * '/' must match exactly: as a prefix it matched every path, so the origin
 * check and the /dashboard session redirect never ran (zero FORBIDDEN_REQUEST
 * events ever recorded; found 2026-10-26).
 */
export function isPublicRoute(pathname: string): boolean {
  return pathname === '/' || PUBLIC_ROUTE_PREFIXES.some((route) => pathname.startsWith(route))
}

/**
 * Basic cross-site check for internal API routes: a browser request whose
 * Origin (or Referer) is another host is refused. Server-to-server callers
 * (cron, MCP, ESI) send neither header and pass. /api/auth is the SSO flow and
 * /api/external is the key-authenticated API meant for other sites/tools.
 */
export function getForbiddenReason(input: {
  pathname: string
  origin: string | null
  referer: string | null
  host: string | null
}): 'ORIGIN_MISMATCH' | 'REFERER_MISMATCH' | null {
  const { pathname, origin, referer, host } = input
  if (!pathname.startsWith('/api/')) return null
  if (pathname.startsWith('/api/auth/') || pathname.startsWith('/api/external/')) return null
  if (!host) return null

  if (origin && !origin.includes(host)) return 'ORIGIN_MISMATCH'
  if (referer && !referer.includes(host) && !pathname.startsWith('/api/webhooks')) return 'REFERER_MISMATCH'
  return null
}
