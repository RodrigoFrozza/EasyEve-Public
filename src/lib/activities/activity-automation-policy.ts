import type { Activity } from '@prisma/client'

/** 1 hour — no ESI/data movement past this window pauses tracking time. */
export const ACTIVITY_STALE_PAUSE_THRESHOLD_MS = 60 * 60 * 1000

/** 6 hours — activities paused for this long are automatically marked as completed. */
export const ACTIVITY_TERMINATION_THRESHOLD_MS = 6 * 60 * 60 * 1000

export function getLastActivityInstantForAudit(activity: {
  startTime: Date
  data: unknown
  updatedAt: Date
}): Date {
  const activityData = activity.data as Record<string, unknown> | null
  
  // We prioritize lastDataAt (actual progress) over everything else.
  // If no progress has been recorded, we use the startTime.
  // lastSyncAt and updatedAt are ignored for audit because they are refreshed by automated syncs.
  const dataAt = activityData?.lastDataAt ? new Date(String(activityData.lastDataAt)).getTime() : 0
  const startTime = activity.startTime ? new Date(activity.startTime).getTime() : 0
  
  // We still consider updatedAt as a secondary fallback to ensure that 
  // manual UI actions (like editing notes) provide a small grace period,
  // but this is mostly superseded by the logic in sync scripts.
  return new Date(Math.max(dataAt, startTime))
}

export function isStaleForAutoPause(activity: { startTime: Date; data: unknown; updatedAt: Date }, nowMs: number): boolean {
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
