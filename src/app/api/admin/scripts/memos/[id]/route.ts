import { withAuth } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export const PUT = withErrorHandling(
  withAuth({ requiredRole: 'master' }, async (request, user, context) => {
    const { id } = await context.params
    const existing = await prisma.customScriptMemo.findUnique({ where: { id } })
    if (!existing) throw new AppError(ErrorCodes.API_NOT_FOUND, 'Memo not found', 404)
    if (existing.userId !== user.id) {
      throw new AppError(ErrorCodes.API_FORBIDDEN, 'You can only edit your own memos', 403)
    }

    const body = (await request.json().catch(() => ({}))) as {
      name?: string
      description?: string
      code?: string
      args?: unknown
      isShared?: boolean
    }
    const nextName = (body.name || existing.name).trim()
    const nextCode = (body.code || existing.code).trim()
    if (!nextName) throw new AppError(ErrorCodes.INVALID_INPUT, 'Memo name is required', 400)
    if (!nextCode) throw new AppError(ErrorCodes.INVALID_INPUT, 'Memo code is required', 400)

    const memo = await prisma.customScriptMemo.update({
      where: { id },
      data: {
        name: nextName,
        description: body.description?.trim() ?? existing.description,
        code: nextCode,
        args:
          body.args && typeof body.args === 'object' && !Array.isArray(body.args)
            ? (body.args as Prisma.InputJsonValue)
            : ((existing.args ?? {}) as Prisma.InputJsonValue),
        },
    })
    return { memo }
  })
)

export const DELETE = withErrorHandling(
  withAuth({ requiredRole: 'master' }, async (_request, user, context) => {
    const { id } = await context.params
    const existing = await prisma.customScriptMemo.findUnique({ where: { id } })
    if (!existing) throw new AppError(ErrorCodes.API_NOT_FOUND, 'Memo not found', 404)
    if (existing.userId !== user.id) {
      throw new AppError(ErrorCodes.API_FORBIDDEN, 'You can only delete your own memos', 403)
    }
    await prisma.customScriptMemo.delete({ where: { id } })
    return { success: true }
  })
)
