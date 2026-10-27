import os from 'os'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getEnrichedSchedulesList } from '@/lib/admin/script-schedules-enrichment'
import { deployedCommit } from '@/lib/health'
import { defineTool } from '../types'
import { pageArgs, pageInput, sinceInput, toPage, truncate } from './common'

/** Host and database name from DATABASE_URL — never the credentials. */
function describeDatabaseUrl(): { host: string | null; database: string | null } {
  try {
    const url = new URL(process.env.DATABASE_URL ?? '')
    return { host: url.hostname || null, database: url.pathname.replace(/^\//, '') || null }
  } catch {
    return { host: null, database: null }
  }
}

export const envInfo = defineTool({
  name: 'env_info',
  title: 'Environment info',
  description:
    'Which EasyEve environment this server is (production/development), app URL, deployed commit, DB host (no credentials) and a DB round-trip check. Call this first.',
  input: z.object({}),
  readOnly: true,
  handler: async () => {
    const started = Date.now()
    const [{ now }] = await prisma.$queryRaw<{ now: Date }[]>`SELECT now() AS now`
    return {
      appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? null,
      nodeEnv: process.env.NODE_ENV ?? null,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
      commit: deployedCommit(),
      // Presence only, never values: a missing one fails silently elsewhere
      // (e.g. no INTERNAL_SECURITY_KEY = middleware security events dropped).
      secretsConfigured: {
        CRON_SECRET: !!process.env.CRON_SECRET,
        INTERNAL_SECURITY_KEY: !!process.env.INTERNAL_SECURITY_KEY,
        HOLDING_EVE_CLIENT_ID: !!process.env.HOLDING_EVE_CLIENT_ID,
        EXTERNAL_API_KEY: !!process.env.EXTERNAL_API_KEY,
      },
      // Rollout flags (not secrets): PI_V2 is off / 'all' / a userId allowlist.
      rolloutFlags: {
        PI_V2: process.env.PI_V2 ?? null,
        PI_PROJECTION_ENGINE: process.env.PI_PROJECTION_ENGINE ?? null,
      },
      database: { ...describeDatabaseUrl(), serverTime: now, roundTripMs: Date.now() - started },
      processUptimeSeconds: Math.round(process.uptime()),
      nodeVersion: process.version,
    }
  },
})

export const overviewStats = defineTool({
  name: 'overview_stats',
  title: 'Overview stats',
  description:
    'Headline counts: users (total, with subscriptionEnd in the future, blocked, testers), characters, active activities, pending payments and approved ISK in the last 30 days.',
  input: z.object({}),
  readOnly: true,
  handler: async () => {
    const now = new Date()
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const [users, subscribed, blocked, testers, characters, activeActivities, pendingPayments, approved30d] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { subscriptionEnd: { gt: now } } }),
        prisma.user.count({ where: { isBlocked: true } }),
        prisma.user.count({ where: { isTester: true } }),
        prisma.character.count(),
        prisma.activity.count({ where: { status: 'active', isDeleted: false } }),
        prisma.payment.count({ where: { status: 'pending' } }),
        prisma.payment.aggregate({
          where: { status: 'approved', createdAt: { gte: monthAgo } },
          _sum: { amount: true },
          _count: true,
        }),
      ])
    return {
      users: { total: users, subscriptionActive: subscribed, blocked, testers },
      characters,
      activeActivities,
      payments: {
        pending: pendingPayments,
        approvedLast30d: { count: approved30d._count, iskTotal: approved30d._sum.amount ?? 0 },
      },
      generatedAt: now,
    }
  },
})

export const schedulerStatus = defineTool({
  name: 'scheduler_status',
  title: 'Scheduler status',
  description:
    'Scheduler health (last tick, stale/never, overdue count, missing required schedules) plus every ScriptSchedule with its last execution and 24h run/failure stats — same data as the admin Scripts screen.',
  input: z.object({}),
  readOnly: true,
  handler: async () => getEnrichedSchedulesList(),
})

export const listScriptExecutions = defineTool({
  name: 'list_script_executions',
  title: 'List script executions',
  description:
    'Recent ScriptExecution rows, newest first. Filter by scriptId, scheduleId or status (pending/running/completed/failed). Logs are omitted unless includeLogs (then only the last 50 entries).',
  input: z.object({
    scriptId: z.string().optional(),
    scheduleId: z.string().optional(),
    status: z.string().optional(),
    since: sinceInput,
    includeLogs: z.boolean().default(false),
    ...pageInput,
  }),
  readOnly: true,
  handler: async ({ scriptId, scheduleId, status, since, includeLogs, limit, cursor }) => {
    const rows = await prisma.scriptExecution.findMany({
      where: {
        ...(scriptId ? { scriptId } : {}),
        ...(scheduleId ? { scheduleId } : {}),
        ...(status ? { status } : {}),
        ...(since ? { createdAt: { gte: new Date(since) } } : {}),
      },
      select: {
        id: true,
        scriptId: true,
        scheduleId: true,
        userId: true,
        status: true,
        params: true,
        dryRun: true,
        progress: true,
        error: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        logs: includeLogs,
      },
      ...pageArgs(limit, cursor),
    })
    const page = toPage(rows, limit)
    return {
      ...page,
      items: page.items.map((row) => ({
        ...row,
        error: truncate(row.error, 2000),
        ...(includeLogs && Array.isArray(row.logs) ? { logs: row.logs.slice(-50) } : {}),
      })),
    }
  },
})

export const listDebugLogs = defineTool({
  name: 'list_debug_logs',
  title: 'List debug logs',
  description:
    'Client/server DebugLog rows, newest first. Filter by level (info/warn/error/debug), userId, characterId, since, or a case-insensitive substring of the message. Stack traces only with includeStack.',
  input: z.object({
    level: z.enum(['info', 'warn', 'error', 'debug']).optional(),
    userId: z.string().optional(),
    characterId: z.number().int().optional(),
    contains: z.string().min(2).optional(),
    since: sinceInput,
    includeStack: z.boolean().default(false),
    ...pageInput,
  }),
  readOnly: true,
  handler: async ({ level, userId, characterId, contains, since, includeStack, limit, cursor }) => {
    const rows = await prisma.debugLog.findMany({
      where: {
        ...(level ? { level } : {}),
        ...(userId ? { userId } : {}),
        ...(characterId ? { characterId } : {}),
        ...(contains ? { message: { contains, mode: 'insensitive' as const } } : {}),
        ...(since ? { createdAt: { gte: new Date(since) } } : {}),
      },
      select: {
        id: true,
        userId: true,
        characterId: true,
        level: true,
        message: true,
        stack: includeStack,
        url: true,
        context: true,
        createdAt: true,
      },
      ...pageArgs(limit, cursor),
    })
    const page = toPage(rows, limit)
    return {
      ...page,
      items: page.items.map((row) => ({
        ...row,
        message: truncate(row.message, 2000),
        ...(includeStack ? { stack: truncate(row.stack, 4000) } : {}),
      })),
    }
  },
})

export const listSecurityEvents = defineTool({
  name: 'list_security_events',
  title: 'List security events',
  description:
    'SecurityEvent rows, newest first (rate limits, forbidden requests, admin changes, MCP_WRITE audit entries). Filter by exact event name, userId or since.',
  input: z.object({
    event: z.string().optional(),
    userId: z.string().optional(),
    since: sinceInput,
    ...pageInput,
  }),
  readOnly: true,
  handler: async ({ event, userId, since, limit, cursor }) => {
    const rows = await prisma.securityEvent.findMany({
      where: {
        ...(event ? { event } : {}),
        ...(userId ? { userId } : {}),
        ...(since ? { createdAt: { gte: new Date(since) } } : {}),
      },
      ...pageArgs(limit, cursor),
    })
    return toPage(rows, limit)
  },
})

export const systemHealth = defineTool({
  name: 'system_health',
  title: 'System health',
  description:
    'Host load as seen from the app container — the same numbers as the admin "Elevated load" badge: 1/5/15-min load averages, cores, load per core, memory, and this process\'s memory. The container shares the VPS with Coolify builds, Postgres and other apps, so a spike right after a deploy is usually the image build.',
  input: z.object({}),
  readOnly: true,
  handler: async () => {
    const cores = os.cpus().length
    const [load1, load5, load15] = os.loadavg()
    const total = os.totalmem()
    const free = os.freemem()
    const mem = process.memoryUsage()
    const mb = (n: number) => Math.round(n / 1024 / 1024)
    return {
      cores,
      loadAverage: { '1m': load1, '5m': load5, '15m': load15 },
      // What the admin badge shows as "CPU %": load1 / cores, capped at 100.
      loadPerCorePct: { '1m': Math.round((load1 / cores) * 100), '5m': Math.round((load5 / cores) * 100), '15m': Math.round((load15 / cores) * 100) },
      memoryMb: { total: mb(total), used: mb(total - free), usedPct: Math.round(((total - free) / total) * 100) },
      processMemoryMb: { rss: mb(mem.rss), heapUsed: mb(mem.heapUsed) },
      hostUptimeHours: Math.round(os.uptime() / 360) / 10,
      processUptimeSeconds: Math.round(process.uptime()),
    }
  },
})
