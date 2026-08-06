/** Shared session duration (active time), aligned across UI, metrics, and analytics. */

export type ActivityDurationInput = {
  startTime: string | Date
  endTime?: string | Date | null
  status?: string
  updatedAt?: string | Date | null
  accumulatedPausedTime?: number
  isPaused?: boolean
  pausedAt?: string | Date | null
  /** Wall-clock "now" for active, non-paused sessions. Defaults to Date.now(). */
  nowMs?: number
}

/**
 * Elapsed active milliseconds for a session.
 * When paused, the clock freezes at `pausedAt` (retrospective auto-pause included).
 */
export function getActivityDurationMs(input: ActivityDurationInput): number {
  const startMs = new Date(input.startTime).getTime()
  const nowMs = input.nowMs ?? Date.now()
  const isCompleted = input.status === 'completed'

  let endMs: number
  if (isCompleted && input.endTime) {
    endMs = new Date(input.endTime).getTime()
  } else if (input.isPaused && input.pausedAt) {
    endMs = new Date(input.pausedAt).getTime()
  } else if (isCompleted) {
    endMs = new Date(input.updatedAt ?? input.startTime).getTime()
  } else {
    endMs = nowMs
  }

  let durationMs = endMs - startMs
  if (input.accumulatedPausedTime) {
    durationMs -= input.accumulatedPausedTime
  }

  return Math.max(0, durationMs)
}
