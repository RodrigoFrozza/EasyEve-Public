import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { ErrorCodes } from './error-codes'

/**
 * Authentication options for the withAuth HOC
 */
export interface AuthOptions {
  requiredRole?: 'user' | 'master'
}

/**
 * Higher-order component to protect API routes with session-based authentication.
 * 
 * Usage:
 * export const GET = withAuth(async (req) => { ... }, { requiredRole: 'master' })
 */
export function withAuth(
  handler: (request: Request, ...args: any[]) => Promise<Response | NextResponse | any>,
  options: AuthOptions = {}
) {
  return async (request: Request, ...args: any[]) => {
    try {
      const session = await getSession()

      if (!session?.user) {
        return NextResponse.json(
          { 
            error: 'Authentication required', 
            code: ErrorCodes.API_UNAUTHORIZED 
          }, 
          { status: 401 }
        )
      }

      // Check if user is blocked (redundant as getSession already handles this, but safe)
      if (session.user.isBlocked) {
        return NextResponse.json(
          { 
            error: 'Access denied: account blocked', 
            code: ErrorCodes.API_FORBIDDEN,
            details: session.user.blockReason
          }, 
          { status: 403 }
        )
      }

      // Role authorization
      if (options.requiredRole === 'master' && session.user.role !== 'master') {
        return NextResponse.json(
          { 
            error: 'Insufficient permissions', 
            code: ErrorCodes.API_FORBIDDEN 
          }, 
          { status: 403 }
        )
      }

      // Execute original handler
      const result = await handler(request, ...args)
      
      if (result instanceof Response) {
        return result
      }
      
      return NextResponse.json(result)
    } catch (error) {
      console.error('[AuthMiddleware] Unexpected error:', error)
      return NextResponse.json(
        { 
          error: 'Internal authentication error', 
          code: ErrorCodes.API_SERVER_ERROR 
        }, 
        { status: 500 }
      )
    }
  }
}
