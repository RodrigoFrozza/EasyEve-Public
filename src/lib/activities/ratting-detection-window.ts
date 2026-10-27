export const RATTING_DETECTION_LOOKBACK_MS = 30 * 60 * 1000

/** Rolling 30-minute window for initial ratting detection (no activity context). */
export function getRattingRollingWindowStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - RATTING_DETECTION_LOOKBACK_MS)
}

/**
 * Late-join / backfill window: bounty must fall after activity start or within the last 30 minutes.
 */
export function getRattingDetectionWindowStart(
  activityStartTime: Date,
  now: Date = new Date()
): Date {
  return new Date(
    Math.max(activityStartTime.getTime(), now.getTime() - RATTING_DETECTION_LOOKBACK_MS)
  )
}
