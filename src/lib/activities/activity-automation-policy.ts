import type { Activity } from '@prisma/client'

/** 1 hour — no ESI/data movement past this window pauses tracking time. */
export const ACTIVITY_STALE_PAUSE_THRESHOLD_MS = 60 * 60 * 1000

/** 6 hours — activities paused for this long are automatically marked as completed. */
export const ACTIVITY_TERMINATION_THRESHOLD_MS = 6 * 60 * 60 * 1000

const START_TIME_EPSILON_MS = 60_000

function parseCappedMs(raw: unknown, now: number): number {
  if (raw == null || raw === '') return 0
  const t = new Date(String(raw)).getTime()
  if (!Number.isFinite(t)) return 0
  return Math.min(now, t)
}

function latestLogMs(activityData: Record<string, unknown> | null, now: number): number {
  const logs = activityData?.logs
  if (!Array.isArray(logs) || logs.length === 0) return 0

  let max = 0
  for (const entry of logs) {
    if (!entry || typeof entry !== 'object') continue
    const raw = (entry as Record<string, unknown>).date
    const t = parseCappedMs(raw, now)
    if (t > max) max = t
  }
  return max
}

/**
 * Last instant of real progress for stale detection and retrospective auto-pause.
 * Uses lastDataAt, then lastSyncWithChangesAt, then newest log date.
 * Does not use lastSyncAt/updatedAt (automated syncs refresh those without player progress).
 */
export function getLastActivityInstantForAudit(activity: {
  startTime: Date
  data: unknown
  updatedAt: Date
}): Date {
  const instant = resolveProgressInstantForPause(activity)
  return instant ?? new Date(activity.startTime)
}

/**
 * Best-effort progress instant for auto-pause, including log-derived proxy for legacy sessions.
 * Returns null only when no progress signal exists beyond session start.
 */
export function resolveProgressInstantForPause(activity: {
  startTime: Date
  data: unknown
}): Date | null {
  const now = Date.now()
  const activityData = activity.data as Record<string, unknown> | null
  const startMs = activity.startTime ? Math.min(now, new Date(activity.startTime).getTime()) : 0

  const lastDataAtMs = parseCappedMs(activityData?.lastDataAt, now)
  const lastSyncWithChangesMs = parseCappedMs(activityData?.lastSyncWithChangesAt, now)
  const latestLog = latestLogMs(activityData, now)
  const progressMs = Math.max(lastDataAtMs, lastSyncWithChangesMs, latestLog)

  if (progressMs > startMs + START_TIME_EPSILON_MS) {
    return new Date(Math.max(progressMs, startMs))
  }

  if (progressMs > 0) {
    return new Date(Math.max(progressMs, startMs))
  }

  return null
}

/**
 * Auto-pause must not set pausedAt to session start on long-running sessions
 * (missing lastDataAt would zero the timer and ISK/h).
 */
export function isSafeAutoPauseInstant(
  activity: { startTime: Date },
  pauseInstant: Date,
  nowMs: number = Date.now()
): boolean {
  const startMs = new Date(activity.startTime).getTime()
  const pauseMs = pauseInstant.getTime()

  if (pauseMs < startMs + START_TIME_EPSILON_MS && nowMs - startMs > ACTIVITY_STALE_PAUSE_THRESHOLD_MS) {
    return false
  }

  return true
}

/**
 * Chooses a pause timestamp for stale sessions, including legacy rows with income
 * but no lastDataAt/logs (previously skipped as "unsafe").
 */
export function resolveStalePauseInstant(
  activity: { startTime: Date; data: unknown; updatedAt?: Date },
  nowMs: number = Date.now()
): Date | null {
  const progress = resolveProgressInstantForPause(activity)
  if (progress && isSafeAutoPauseInstant(activity, progress, nowMs)) {
    return progress
  }

  const lastAudit = getLastActivityInstantForAudit({
    startTime: activity.startTime,
    data: activity.data,
    updatedAt: activity.updatedAt ?? new Date(activity.startTime),
  })

  if (isSafeAutoPauseInstant(activity, lastAudit, nowMs)) {
    return lastAudit
  }

  const startMs = new Date(activity.startTime).getTime()
  const boundaryMs = Math.max(
    startMs + START_TIME_EPSILON_MS,
    lastAudit.getTime(),
    nowMs - ACTIVITY_STALE_PAUSE_THRESHOLD_MS
  )
  const boundary = new Date(Math.min(boundaryMs, nowMs))
  if (isSafeAutoPauseInstant(activity, boundary, nowMs)) {
    return boundary
  }

  return null
}

export function isStaleForAutoPause(
  activity: { startTime: Date; data: unknown; updatedAt: Date },
  nowMs: number
): boolean {
  const last = getLastActivityInstantForAudit(activity).getTime()
  return nowMs - last > ACTIVITY_STALE_PAUSE_THRESHOLD_MS
}

export function lastSyncMsForBackground(activity: Activity): number | null {
  const d = activity.data as Record<string, unknown> | null
  const raw = d?.lastSyncAt
  if (raw == null || raw === '') return null
  const t = new Date(String(raw)).getTime()
  return Number.isFinite(t) ? t : null
}

export function shouldRunBackgroundSync(activity: Activity, nowMs: number, minIntervalMs: number): boolean {
  const last = lastSyncMsForBackground(activity)
  if (last == null) return true
  return nowMs - last >= minIntervalMs
}

/**
 * Repairs legacy sessions that have progress signals but no `lastDataAt`.
 * Returns patched data or null when nothing to backfill.
 */
export function backfillProgressTimestamps(
  activity: { startTime: Date; data: unknown; updatedAt: Date },
  options?: { allowUpdatedAtFallback?: boolean }
): Record<string, unknown> | null {
  const data = { ...((activity.data as Record<string, unknown> | null) || {}) }
  if (data.lastDataAt) return null

  const now = Date.now()
  const latestLog = latestLogMs(data, now)
  if (latestLog > 0) {
    return { ...data, lastDataAt: new Date(latestLog).toISOString() }
  }

  const syncChanges = parseCappedMs(data.lastSyncWithChangesAt, now)
  if (syncChanges > 0) {
    return { ...data, lastDataAt: new Date(syncChanges).toISOString() }
  }

  if (options?.allowUpdatedAtFallback) {
    const updatedMs = activity.updatedAt ? new Date(activity.updatedAt).getTime() : 0
    const startMs = new Date(activity.startTime).getTime()
    if (updatedMs > startMs + START_TIME_EPSILON_MS) {
      return { ...data, lastDataAt: new Date(updatedMs).toISOString() }
    }
  }

  return null
}
