import { prisma } from '@/lib/prisma'
import { SCRIPT_REGISTRY as registry, ScriptContext } from './registry'

/**
 * Executes a script by ID, managing state, logs, and progress.
 * Can be called from API or Scheduler.
 */
export async function runScript(executionId: string, dryRun: boolean = false) {
  const execution = await prisma.scriptExecution.findUnique({
    where: { id: executionId }
  })

  if (!execution) throw new Error('Execution record not found')

  const script = registry[execution.scriptId]
  if (!script) {
    await prisma.scriptExecution.update({
      where: { id: executionId },
      data: { status: 'failed', logs: [{ level: 'error', message: `Script ${execution.scriptId} not found in registry`, timestamp: new Date().toISOString() }] as any }
    })
    return
  }

  // Update status to running
  await prisma.scriptExecution.update({
    where: { id: executionId },
    data: { status: 'running', startedAt: new Date() }
  })

  // Handlers call addLog synchronously (no await). Without serialization, concurrent
  // read-modify-write on `logs` JSON drops most entries — only a few "win".
  let logWriteChain: Promise<void> = Promise.resolve()
  const enqueueLog = (level: 'info' | 'success' | 'error' | 'warning', message: string) => {
    logWriteChain = logWriteChain.then(async () => {
      const current = await prisma.scriptExecution.findUnique({
        where: { id: executionId },
        select: { logs: true },
      })
      const prev = (current?.logs as Array<{ level: string; message: string; timestamp: string }>) || []
      const next = [...prev, { level, message, timestamp: new Date().toISOString() }]
      await prisma.scriptExecution.update({
        where: { id: executionId },
        data: { logs: next as unknown as object },
      })
    })
  }

  // Context injection
  const ctx: ScriptContext = {
    executionId,
    params: (execution.params as Record<string, any>) || {},
    dryRun: execution.dryRun ?? dryRun,
    addLog: (level, message) => {
      enqueueLog(level, message)
    },
    updateProgress: async (progress) => {
      await prisma.scriptExecution.update({
        where: { id: executionId },
        data: { progress }
      })
    },
    shouldStop: async () => {
      const current = await prisma.scriptExecution.findUnique({
        where: { id: executionId },
        select: { status: true }
      })
      return current?.status === 'cancelled'
    }
  }

  try {
    await script.handler(ctx)
    await logWriteChain

    // Final status check (might have been cancelled)
    const final = await prisma.scriptExecution.findUnique({ where: { id: executionId }, select: { status: true } })
    if (final?.status !== 'cancelled') {
      await prisma.scriptExecution.update({
        where: { id: executionId },
        data: { status: 'completed', completedAt: new Date() }
      })
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    await logWriteChain.catch(() => {})
    enqueueLog('error', `Fatal Error: ${msg}`)
    await logWriteChain
    await prisma.scriptExecution.update({
      where: { id: executionId },
      data: {
        status: 'failed',
        completedAt: new Date(),
      },
    })
  }
}
