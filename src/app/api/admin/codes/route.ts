import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import {
  ACTIVATION_CODE_TYPES,
  generateActivationCode,
} from '@/lib/activation-codes'

export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 200
const MAX_LIMIT = 500

/**
 * GET /api/admin/codes - List activation codes (paginated)
 * Query: page (default 1), limit (default 200, max 500)
 */
export const GET = withErrorHandling(withAuth({ requiredRole: 'master' }, async (request) => {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const rawLimit = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT
  const limit = Math.min(Math.max(1, rawLimit), MAX_LIMIT)
  const skip = (page - 1) * limit

  const [codes, total] = await Promise.all([
    prisma.activationCode.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        usedBy: {
          select: {
            name: true,
            accountCode: true,
          },
        },
        creator: {
          select: {
            name: true,
            accountCode: true,
          },
        },
      },
    }),
    prisma.activationCode.count(),
  ])

  return {
    codes,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  }
}))

/**
 * POST /api/admin/codes - Generate new activation codes
 */
export const POST = withErrorHandling(withAuth({ requiredRole: 'master' }, async (request, user) => {
  const body = await request.json()
  const { type, count = 1 } = body // type: "DAYS_30" or "LIFETIME"

  if (![
    ACTIVATION_CODE_TYPES.DAYS_7,
    ACTIVATION_CODE_TYPES.DAYS_30,
    ACTIVATION_CODE_TYPES.LIFETIME,
    ACTIVATION_CODE_TYPES.PL8R,
  ].includes(type)) {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'Invalid code type', 400)
  }

  const codes = []
  for (let i = 0; i < count; i++) {
    const code = generateActivationCode()
    codes.push({
      code,
      type,
      createdById: user.id,
    })
  }

  const created = await Promise.all(
    codes.map(c => prisma.activationCode.create({ data: c }))
  )

  return created
}))

/**
 * DELETE /api/admin/codes - Invalidate a code
 */
export const DELETE = withErrorHandling(withAuth({ requiredRole: 'master' }, async (request) => {
  const { searchParams } = new URL(request.url)
  const codeId = searchParams.get('id')

  if (!codeId) {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'Code ID required', 400)
  }

  const existingCode = await prisma.activationCode.findUnique({
    where: { id: codeId }
  })

  if (!existingCode) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'Code not found', 404)
  }

  if (existingCode.isUsed) {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'Cannot invalidate already used code', 400)
  }

  if (existingCode.isInvalidated) {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'Code is already invalidated', 400)
  }

  // Soft delete by marking as invalidated
  await prisma.activationCode.update({
    where: { id: codeId },
    data: { isInvalidated: true },
  })

  return { success: true }
}))
