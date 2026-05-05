import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeScriptParams, SCRIPT_REGISTRY } from '@/lib/scripts/registry'
import { runScript } from '@/lib/scripts/runner'
import { withAuth } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

export const dynamic = 'force-dynamic'

export const POST = withErrorHandling(
  withAuth(
    { requiredRole: 'master' },
    async (_request, user, context: { params: { id: string } }) => {
      const { id } = context.params

      const schedule = await prisma.scriptSchedule.findUnique({
        where: { id },
      })
      if (!schedule) {
        throw new AppError(ErrorCodes.API_NOT_FOUND, 'Schedule not found', 404)
      }

      const scriptId = schedule.scriptId
      const scriptDef = SCRIPT_REGISTRY[scriptId]
      if (!scriptDef) {
        throw new AppError(ErrorCodes.INVALID_INPUT, 'Invalid script ID for schedule', 400)
      }

      if (scriptDef.executionPolicy === 'elevated') {
        const allowedIds = (process.env.ADMIN_SCRIPT_ELEVATED_USER_IDS || '')
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean)
        if (allowedIds.length > 0 && !allowedIds.includes(user.id)) {
          throw new AppError(
            ErrorCodes.API_FORBIDDEN,
            'This script requires elevated script permissions.',
            403
          )
        }
      }

      const existingRunning = await prisma.scriptExecution.findFirst({
        where: { scriptId, status: { in: ['pending', 'running'] } },
      })
      if (existingRunning) {
        const scriptName = SCRIPT_REGISTRY[scriptId].name
        throw new AppError(ErrorCodes.API_CONFLICT, `${scriptName} is already running`, 409)
      }

      const incoming =
        schedule.params && typeof schedule.params === 'object' && schedule.params !== null
          ? (schedule.params as Record<string, unknown>)
          : {}
      const normalized = normalizeScriptParams(scriptId, incoming)
      if (!normalized.ok) {
        throw new AppError(
          ErrorCodes.INVALID_INPUT,
          `Invalid script params: ${normalized.errors.join('; ')}`,
          400
        )
      }

      const execution = await prisma.scriptExecution.create({
        data: {
          scriptId,
          scheduleId: schedule.id,
          userId: user.id,
          status: 'pending',
          logs: [],
          progress: {},
          params: normalized.params as Prisma.InputJsonValue,
          dryRun: schedule.dryRun,
        },
      })

      await prisma.securityEvent.create({
        data: {
          event: 'ADMIN_SCHEDULE_RUN_NOW',
          userId: user.id,
          path: `/api/admin/scripts/schedules/${id}/run-now`,
          details: {
            scheduleId: id,
            scriptId,
            executionId: execution.id,
            dryRun: schedule.dryRun,
          },
        },
      })

      runScript(execution.id, schedule.dryRun).catch((err) => {
        console.error(`[ScriptRunner] Critical background failure for ${execution.id}:`, err)
      })

      return { executionId: execution.id, status: 'pending' as const }
    }
  )
)
