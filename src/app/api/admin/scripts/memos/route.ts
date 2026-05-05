import { withAuth } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  withAuth({ requiredRole: 'master' }, async (_request, user) => {
    const memos = await prisma.customScriptMemo.findMany({
      where: {
        OR: [{ userId: user.id }, { isShared: true }],
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    })
    return { memos }
  })
)

export const POST = withErrorHandling(
  withAuth({ requiredRole: 'master' }, async (request, user) => {
    const body = (await request.json().catch(() => ({}))) as {
      name?: string
      description?: string
      code?: string
      args?: unknown
      isShared?: boolean
    }
    const name = (body.name || '').trim()
    const code = (body.code || '').trim()
    if (!name) throw new AppError(ErrorCodes.INVALID_INPUT, 'Memo name is required', 400)
    if (!code) throw new AppError(ErrorCodes.INVALID_INPUT, 'Memo code is required', 400)

    const memo = await prisma.customScriptMemo.create({
      data: {
        userId: user.id,
        name,
        description: body.description?.trim() || null,
        code,
        args:
          body.args && typeof body.args === 'object' && !Array.isArray(body.args)
            ? (body.args as Prisma.InputJsonValue)
            : ({} as Prisma.InputJsonValue),
        isShared: body.isShared === true,
      },
    })
    return { memo }
  })
)
