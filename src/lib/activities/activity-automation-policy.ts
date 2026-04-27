import type { Activity } from '@prisma/client'

/** 1 hour 30 minutes — no ESI/data movement past this window pauses tracking time. */
export const ACTIVITY_STALE_PAUSE_THRESHOLD_MS = 90 * 60 * 1000

export function getLastActivityInstantForAudit(activity: {
  data: unknown
  updatedAt: Date
}): Date {
  const activityData = activity.data as Record<string, unknown> | null
  if (activityData?.lastSyncAt) {
    return new Date(String(activityData.lastSyncAt))
  }
  return new Date(activity.updatedAt)
}

export function isStaleForAutoPause(activity: { data: unknown; updatedAt: Date }, nowMs: number): boolean {
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
