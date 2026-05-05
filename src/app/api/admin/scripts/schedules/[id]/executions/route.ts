import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  withAuth(
    { requiredRole: 'master' },
    async (request, _user, context: { params: { id: string } }) => {
      const { id } = context.params
      const { searchParams } = new URL(request.url)
      const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)
      const includeLogs = searchParams.get('includeLogs') === 'true'

      const schedule = await prisma.scriptSchedule.findUnique({
        where: { id },
        select: { id: true },
      })
      if (!schedule) {
        throw new AppError(ErrorCodes.API_NOT_FOUND, 'Schedule not found', 404)
      }

      const select: Prisma.ScriptExecutionSelect = {
        id: true,
        scriptId: true,
        scheduleId: true,
        status: true,
        params: true,
        dryRun: true,
        error: true,
        progress: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
      }
      if (includeLogs) {
        select.logs = true
      }

      const executions = await prisma.scriptExecution.findMany({
        where: { scheduleId: id },
        take: limit,
        orderBy: { createdAt: 'desc' },
        select,
      })

      return { executions }
    }
  )
)
