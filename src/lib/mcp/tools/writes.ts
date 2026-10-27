import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/server-logger'
import { DEFAULT_FEATURE_FLAGS } from '@/lib/feature-flags'
import { REQUIRED_SCHEDULE_SCRIPT_IDS } from '@/lib/scripts/required-schedules'
import { defineTool, McpToolError } from '../types'

/**
 * Write tools. The contract, shared by all of them:
 *  - allowlisted, single-field, reversible changes only (nothing touching ISK,
 *    payments, roles or subscriptions). The one delete, delete_orphan_user,
 *    only removes an account that holds no data at all (see its guards);
 *  - without `confirm: true` nothing is written — the tool returns the
 *    before/after it would apply;
 *  - a confirmed write and its SecurityEvent audit row (event MCP_WRITE) are
 *    committed in one transaction, so there is never an unaudited change.
 */

const confirmInput = z
  .boolean()
  .default(false)
  .describe('false (default) = dry run. Only true after the user approved this exact change.')

function auditRow(tool: string, target: Record<string, unknown>, before: unknown, after: unknown) {
  return prisma.securityEvent.create({
    data: {
      event: 'MCP_WRITE',
      path: '/api/mcp',
      userAgent: 'easyeve-mcp',
      details: { tool, target, before, after } as Prisma.InputJsonValue,
    },
  })
}

function dryRun(before: unknown, after: unknown, warnings: string[] = []) {
  return {
    dryRun: true,
    changed: false,
    wouldChange: JSON.stringify(before) !== JSON.stringify(after),
    before,
    after,
    warnings,
    next: 'Nothing was written. Call again with confirm: true once the user approves.',
  }
}

const flagNames = Object.keys(DEFAULT_FEATURE_FLAGS) as [string, ...string[]]

export const setFeatureFlag = defineTool({
  name: 'set_feature_flag',
  title: 'Set feature flag',
  description: 'Turn a known feature flag on or off (same effect as the admin Feature Flags screen). Dry run unless confirm: true.',
  input: z.object({
    name: z.enum(flagNames),
    isEnabled: z.boolean(),
    confirm: confirmInput,
  }),
  readOnly: false,
  handler: async ({ name, isEnabled, confirm }) => {
    const row = await prisma.featureFlag.findUnique({ where: { name } })
    const before = { name, isEnabled: row ? row.isEnabled : DEFAULT_FEATURE_FLAGS[name], overriddenInDb: !!row }
    const after = { name, isEnabled, overriddenInDb: true }
    if (!confirm) return dryRun(before, after)

    const [flag] = await prisma.$transaction([
      prisma.featureFlag.upsert({ where: { name }, update: { isEnabled }, create: { name, isEnabled } }),
      auditRow('set_feature_flag', { name }, before, after),
    ])
    logger.info('MCP', `Feature flag ${name} set to ${isEnabled}`)
    return { dryRun: false, changed: true, before, after: { name: flag.name, isEnabled: flag.isEnabled, updatedAt: flag.updatedAt } }
  },
})

export const setScheduleActive = defineTool({
  name: 'set_schedule_active',
  title: 'Activate/pause script schedule',
  description:
    'Activate or pause one ScriptSchedule by id (see scheduler_status). Pausing a required schedule (auto-activity detection, unified sync, PI alerts…) stops that automation. Dry run unless confirm: true.',
  input: z.object({
    id: z.string(),
    active: z.boolean(),
    confirm: confirmInput,
  }),
  readOnly: false,
  handler: async ({ id, active, confirm }) => {
    const schedule = await prisma.scriptSchedule.findUnique({
      where: { id },
      select: { id: true, scriptId: true, name: true, active: true, nextRunAt: true, interval: true, cron: true },
    })
    if (!schedule) throw new McpToolError(`ScriptSchedule ${id} not found`)

    const warnings: string[] = []
    if (!active && REQUIRED_SCHEDULE_SCRIPT_IDS.includes(schedule.scriptId)) {
      warnings.push(
        `${schedule.scriptId} is a required schedule: pausing it stops that automation and ensureRequiredSchedulesExist will NOT recreate it (the row still exists).`
      )
    }
    if (active && !schedule.active && (!schedule.nextRunAt || schedule.nextRunAt.getTime() <= Date.now())) {
      warnings.push('nextRunAt is in the past, so it will run on the next scheduler tick.')
    }

    const before = { id, scriptId: schedule.scriptId, name: schedule.name, active: schedule.active }
    const after = { ...before, active }
    if (!confirm) return dryRun(before, after, warnings)

    const [updated] = await prisma.$transaction([
      prisma.scriptSchedule.update({ where: { id }, data: { active }, select: { active: true, nextRunAt: true } }),
      auditRow('set_schedule_active', { id, scriptId: schedule.scriptId }, before, after),
    ])
    logger.info('MCP', `Schedule ${schedule.scriptId} (${id}) active=${active}`)
    return { dryRun: false, changed: true, before, after: { ...after, nextRunAt: updated.nextRunAt }, warnings }
  },
})

export const setNewsPublished = defineTool({
  name: 'set_news_published',
  title: 'Publish/unpublish news',
  description: 'Publish or unpublish one News post by id (see list_news). Dry run unless confirm: true.',
  input: z.object({
    id: z.string(),
    published: z.boolean(),
    confirm: confirmInput,
  }),
  readOnly: false,
  handler: async ({ id, published, confirm }) => {
    const news = await prisma.news.findUnique({ where: { id }, select: { id: true, title: true, published: true } })
    if (!news) throw new McpToolError(`News ${id} not found`)

    const before = { id, title: news.title, published: news.published }
    const after = { ...before, published }
    if (!confirm) return dryRun(before, after)

    await prisma.$transaction([
      prisma.news.update({ where: { id }, data: { published } }),
      auditRow('set_news_published', { id }, before, after),
    ])
    logger.info('MCP', `News ${id} published=${published}`)
    return { dryRun: false, changed: true, before, after }
  },
})

export const setPromoBannerActive = defineTool({
  name: 'set_promo_banner_active',
  title: 'Activate/deactivate promo banner',
  description: 'Activate or deactivate one PromoBanner by id (see list_promo_banners). Dry run unless confirm: true.',
  input: z.object({
    id: z.string(),
    isActive: z.boolean(),
    confirm: confirmInput,
  }),
  readOnly: false,
  handler: async ({ id, isActive, confirm }) => {
    const banner = await prisma.promoBanner.findUnique({
      where: { id },
      select: { id: true, title: true, isActive: true, startsAt: true, endsAt: true },
    })
    if (!banner) throw new McpToolError(`PromoBanner ${id} not found`)

    const warnings: string[] = []
    if (isActive && banner.endsAt && banner.endsAt.getTime() < Date.now()) {
      warnings.push('endsAt is in the past, so the banner stays hidden even when active.')
    }

    const before = { id, title: banner.title, isActive: banner.isActive }
    const after = { ...before, isActive }
    if (!confirm) return dryRun(before, after, warnings)

    await prisma.$transaction([
      prisma.promoBanner.update({ where: { id }, data: { isActive } }),
      auditRow('set_promo_banner_active', { id }, before, after),
    ])
    logger.info('MCP', `PromoBanner ${id} isActive=${isActive}`)
    return { dryRun: false, changed: true, before, after, warnings }
  },
})

export const deleteOrphanUser = defineTool({
  name: 'delete_orphan_user',
  title: 'Delete orphan user',
  description:
    'Delete one User that holds no data: no characters, payments, activities, ISK history or used activation codes, iskBalance 0, role user. These are left behind by failed first logins (before 2026-10-26). Refuses anything else. Dry run unless confirm: true; the deleted row is kept in the MCP_WRITE audit event.',
  input: z.object({
    userId: z.string(),
    confirm: confirmInput,
  }),
  readOnly: false,
  handler: async ({ userId, confirm }) => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        accountCode: true,
        name: true,
        role: true,
        iskBalance: true,
        subscriptionEnd: true,
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { characters: true, payments: true, activities: true, iskHistory: true, activationCodes: true } },
      },
    })
    if (!user) throw new McpToolError(`User ${userId} not found`)

    const blockers: string[] = []
    if (user.role !== 'user') blockers.push(`role is ${user.role}`)
    if (user.iskBalance !== 0) blockers.push(`iskBalance is ${user.iskBalance}`)
    for (const [relation, count] of Object.entries(user._count)) {
      if (count > 0) blockers.push(`${count} ${relation}`)
    }
    if (blockers.length > 0) {
      throw new McpToolError(`Not an orphan, refusing to delete: ${blockers.join(', ')}`)
    }

    const { _count: _ignored, ...snapshot } = user
    const before = { ...snapshot, exists: true }
    const after = { id: userId, exists: false }
    if (!confirm) return dryRun(before, after)

    await prisma.$transaction([
      prisma.user.delete({ where: { id: userId } }),
      auditRow('delete_orphan_user', { userId }, before, after),
    ])
    logger.info('MCP', `Deleted orphan user ${userId} (${user.name ?? 'no name'})`)
    return { dryRun: false, changed: true, before, after }
  },
})

/** Newest `data.logs[].date` of an activity, or null when it has no dated log. */
function latestLogDate(data: Record<string, unknown>): Date | null {
  const logs = Array.isArray(data.logs) ? (data.logs as Array<{ date?: unknown }>) : []
  let max = 0
  for (const log of logs) {
    const t = typeof log?.date === 'string' ? new Date(log.date).getTime() : NaN
    if (Number.isFinite(t) && t > max) max = t
  }
  return max > 0 ? new Date(max) : null
}

const PROGRESS_INFLATION_MIN_MS = 60 * 60 * 1000

export const repairRattingProgress = defineTool({
  name: 'repair_ratting_progress',
  title: 'Repair inflated ratting progress',
  description:
    'For an ACTIVE ratting session whose lastDataAt/lastSyncWithChangesAt were pushed forward with no new income (the float-compare bug fixed in 8b36149e), moves them back to the newest real log, so auto-pause/complete end the session at its last income instead of hours or days later. If the session is already paused at the inflated instant, pausedAt is moved back too. Refuses anything else. Dry run unless confirm: true.',
  input: z.object({
    activityId: z.string(),
    confirm: confirmInput,
  }),
  readOnly: false,
  handler: async ({ activityId, confirm }) => {
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { id: true, type: true, status: true, isDeleted: true, isPaused: true, pausedAt: true, startTime: true, data: true },
    })
    if (!activity) throw new McpToolError(`Activity ${activityId} not found`)
    if (activity.type.toLowerCase() !== 'ratting') throw new McpToolError(`Not a ratting session (${activity.type})`)
    if (activity.status !== 'active' || activity.isDeleted) {
      throw new McpToolError(`Only active sessions are repaired (status ${activity.status}, deleted ${activity.isDeleted})`)
    }

    const data = (activity.data as Record<string, unknown> | null) ?? {}
    const lastLog = latestLogDate(data)
    if (!lastLog) throw new McpToolError('Session has no dated income log to anchor to')

    const progressMs = Math.max(
      ...[data.lastDataAt, data.lastSyncWithChangesAt].map((v) => (typeof v === 'string' ? new Date(v).getTime() : 0))
    )
    const inflationMs = progressMs - lastLog.getTime()
    if (!(inflationMs > PROGRESS_INFLATION_MIN_MS)) {
      throw new McpToolError(
        `Progress is not inflated (newest progress ${new Date(progressMs).toISOString()} vs last log ${lastLog.toISOString()})`
      )
    }

    const lastLogIso = lastLog.toISOString()
    const movePause = activity.isPaused && !!activity.pausedAt && activity.pausedAt.getTime() > lastLog.getTime()
    const before = {
      id: activityId,
      lastDataAt: data.lastDataAt ?? null,
      lastSyncWithChangesAt: data.lastSyncWithChangesAt ?? null,
      isPaused: activity.isPaused,
      pausedAt: activity.pausedAt,
    }
    const after = {
      id: activityId,
      lastDataAt: lastLogIso,
      lastSyncWithChangesAt: lastLogIso,
      isPaused: activity.isPaused,
      pausedAt: movePause ? lastLog : activity.pausedAt,
    }
    const warnings = [
      `Inflated by ${Math.round(inflationMs / 3600000)}h past the last income (${lastLogIso}).`,
      activity.isPaused
        ? 'Already paused: pausedAt moves back so the 6h auto-complete ends the session at its last income.'
        : 'Not paused yet: the next audit (every 15 min) will pause it at the last income.',
    ]
    if (!confirm) return dryRun(before, after, warnings)

    const [updated] = await prisma.$transaction([
      prisma.activity.update({
        where: { id: activityId },
        data: {
          data: { ...data, lastDataAt: lastLogIso, lastSyncWithChangesAt: lastLogIso } as Prisma.InputJsonValue,
          ...(movePause ? { pausedAt: lastLog } : {}),
        },
        select: { isPaused: true, pausedAt: true },
      }),
      auditRow('repair_ratting_progress', { activityId }, before, after),
    ])
    logger.info('MCP', `Repaired ratting progress of ${activityId} back to ${lastLogIso}`)
    return { dryRun: false, changed: true, before, after: { ...after, pausedAt: updated.pausedAt }, warnings }
  },
})
