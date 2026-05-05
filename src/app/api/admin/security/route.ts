import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { withAuth } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

export const GET = withErrorHandling(withAuth({ requiredRole: 'master' }, async (request) => {
  const { searchParams } = new URL(request.url)
  const limitParam = parseInt(searchParams.get('limit') || '100', 10)
  const pageParam = parseInt(searchParams.get('page') || '1', 10)
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 100)) : 100
  const page = Number.isFinite(pageParam) ? Math.max(1, pageParam) : 1
  const skip = (page - 1) * limit

  const [events, total] = await Promise.all([
    prisma.securityEvent.findMany({
      take: limit,
      skip,
      orderBy: {
        createdAt: 'desc'
      }
    }),
    prisma.securityEvent.count(),
  ])

  return {
    events,
    pagination: {
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit))
    }
  }
}))

export const POST = withErrorHandling(async (request: Request) => {
  const authHeader = request.headers.get('x-security-key')
  const secretKey = process.env.INTERNAL_SECURITY_KEY
  let isAuthorized = false

  if (secretKey && authHeader === secretKey) {
    isAuthorized = true
  } else {
    const session = await getSession()
    if (session?.user.role === 'master') {
      isAuthorized = true
    }
  }

  if (!isAuthorized) {
    throw new AppError(ErrorCodes.API_FORBIDDEN, 'Unauthorized', 403)
  }

  const { event, ipAddress, userAgent, path, userId, details } = await request.json()
  if (!event || typeof event !== 'string') {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'Event is required', 400)
  }

  const newEvent = await prisma.securityEvent.create({
    data: {
      event,
      ipAddress,
      userAgent,
      path,
      userId,
      details: details || {}
    }
  })

  return newEvent
})
