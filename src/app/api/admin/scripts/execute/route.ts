import { NextResponse } from 'next/server'
import { normalizeScriptParams, SCRIPT_REGISTRY } from '@/lib/scripts/registry'
import { prisma } from '@/lib/prisma'
import { runScript } from '@/lib/scripts/runner'
import { withAuth } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  withAuth({ requiredRole: 'master' }, async (request) => {
    const { searchParams } = new URL(request.url)
    const executionId = searchParams.get('executionId')

    if (executionId) {
      const exec = await prisma.scriptExecution.findUnique({
        where: { id: executionId }
      })
      if (!exec) throw new AppError(ErrorCodes.API_NOT_FOUND, 'Execution not found', 404)
      return { execution: exec }
    }

    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50)
    const executions = await prisma.scriptExecution.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' }
    })

    return { executions }
  })
)

export const POST = withErrorHandling(
  withAuth({ requiredRole: 'master' }, async (request, user) => {
    const { searchParams } = new URL(request.url)
    const scriptId = searchParams.get('scriptId')

    if (!scriptId || !SCRIPT_REGISTRY[scriptId]) {
      throw new AppError(ErrorCodes.INVALID_INPUT, 'Invalid script ID', 400)
    }

    // Check for duplicate running script
    const existingRunning = await prisma.scriptExecution.findFirst({
      where: { scriptId, status: { in: ['pending', 'running'] } }
    })
    if (existingRunning) {
      const scriptName = SCRIPT_REGISTRY[scriptId].name
      throw new AppError(ErrorCodes.API_CONFLICT, `${scriptName} is already running`, 409)
    }

    // Get params from body if available
    let body: any = {}
    try {
      const clonedReq = request.clone()
      body = await clonedReq.json()
    } catch {
      // Not a JSON request or empty body
    }

    const incomingParams =
      body && typeof body.params === 'object' && body.params !== null
        ? (body.params as Record<string, unknown>)
        : {}
    const normalized = normalizeScriptParams(scriptId, incomingParams)
    if (!normalized.ok) {
      throw new AppError(
        ErrorCodes.INVALID_INPUT,
        `Invalid script params: ${normalized.errors.join('; ')}`,
        400
      )
    }
    const params = normalized.params as Prisma.InputJsonValue

    const scriptDef = SCRIPT_REGISTRY[scriptId]
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
    const dryRunRequested = body?.dryRun === true || searchParams.get('dryRun') === 'true'
    const dryRun = scriptDef.supportsDryRun === false ? false : dryRunRequested

    // Create execution record
    const execution = await prisma.scriptExecution.create({
      data: {
        scriptId,
        userId: user.id,
        status: 'pending',
        logs: [],
        progress: {},
        params,
        dryRun
      }
    })

    // Audit log
    await prisma.securityEvent.create({
      data: {
        event: 'ADMIN_SCRIPT_STARTED',
        userId: user.id,
        path: `/api/admin/scripts/execute?scriptId=${scriptId}`,
        details: {
          scriptId,
          executionId: execution.id,
          dryRun,
          params
        }
      }
    })

    // Trigger execution asynchronously
    runScript(execution.id, dryRun).catch(err => {
      console.error(`[ScriptRunner] Critical background failure for ${execution.id}:`, err)
    })

    return { executionId: execution.id, status: 'pending' }
  })
)

/**
 * PATCH to cancel an execution
 */
export const PATCH = withErrorHandling(
  withAuth({ requiredRole: 'master' }, async (request) => {
    const { executionId, action } = await request.json()

    if (action === 'cancel') {
      const exec = await prisma.scriptExecution.findUnique({
        where: { id: executionId },
        select: { status: true }
      })

      if (!exec) throw new AppError(ErrorCodes.API_NOT_FOUND, 'Execution not found', 404)
      
      if (exec.status === 'running' || exec.status === 'pending') {
        await prisma.scriptExecution.update({
          where: { id: executionId },
          data: { status: 'cancelled' }
        })
        return { success: true, message: 'Cancellation requested' }
      }
      
      return { success: false, message: `Cannot cancel execution in status: ${exec.status}` }
    }

    throw new AppError(ErrorCodes.INVALID_INPUT, 'Invalid action', 400)
  })
)
