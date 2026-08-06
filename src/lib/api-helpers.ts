import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { AppError } from './app-error'
import { ErrorCodes } from './error-codes'
import { User } from '@prisma/client'

export async function getCurrentSession() {
  return await getSession()
}

/**
 * Enhanced user type including relation and roles
 */
export type UserWithCharacters = User & {
  characters: any[]
}

export async function getCurrentUser(): Promise<UserWithCharacters | null> {
  const session = await getSession()
  
  if (!session?.user?.ownerHash) {
    return null
  }
  
  const user = await prisma.user.findFirst({
    where: {
      characters: {
        some: {
          ownerHash: session.user.ownerHash
        }
      }
    },
    include: {
      characters: true
    }
  })
  
  if (!user) return null
  
  return user as UserWithCharacters
}

interface AuthOptions {
  requiredRole?: 'user' | 'master'
}

type AuthenticatedHandler = (
  req: any, 
  user: UserWithCharacters, 
  ...args: any[]
) => Promise<Response | NextResponse | any>

/**
 * HOC to wrap API handlers with authentication and role checking.
 * Should be used in conjunction with withErrorHandling.
 */
export function withAuth(handler: AuthenticatedHandler): AuthenticatedHandler
export function withAuth(options: AuthOptions, handler: AuthenticatedHandler): AuthenticatedHandler
export function withAuth(
  optionsOrHandler: AuthOptions | AuthenticatedHandler,
  maybeHandler?: AuthenticatedHandler
): AuthenticatedHandler {
  const options = typeof optionsOrHandler === 'object' ? optionsOrHandler : {}
  const handler = typeof optionsOrHandler === 'function' ? optionsOrHandler : maybeHandler

  if (!handler) {
    throw new Error('Handler is required for withAuth')
  }

  return async (req: Request, ...args: any[]) => {
    const user = await getCurrentUser()

    if (!user) {
      throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
    }

    if (options.requiredRole) {
      // If master role is required, only allow masters
      if (options.requiredRole === 'master' && user.role !== 'master') {
        throw new AppError(ErrorCodes.API_FORBIDDEN, 'Insufficient permissions for this action', 403)
      }
      // Note: If 'user' role is required, masters are technically allowed as they usually have higher privilege
      // and 'user' is the default lowest privileged role.
    }

    return await handler(req, user, ...args)
  }
}
