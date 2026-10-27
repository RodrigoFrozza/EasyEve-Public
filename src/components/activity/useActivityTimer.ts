import { useState, useEffect } from 'react'
import { getActivityDurationMs } from '@/lib/activities/activity-duration'

export function useActivityTimer(
  startTime: string | Date,
  endTime: string | Date | null | undefined,
  isPaused: boolean = false,
  accumulatedPausedTime: number = 0,
  pausedAt: string | Date | null = null,
  status: string = 'active'
) {
  const [elapsed, setElapsed] = useState<string>('')

  useEffect(() => {
    const updateElapsed = () => {
      const durationMs = getActivityDurationMs({
        startTime,
        endTime,
        status,
        accumulatedPausedTime,
        isPaused,
        pausedAt,
        nowMs: Date.now(),
      })

      const hours = Math.floor(durationMs / (1000 * 60 * 60))
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)

      setElapsed(`${hours > 0 ? `${hours}h ` : ''}${minutes}m ${seconds}s`)
    }

    updateElapsed()
    if (!endTime && !isPaused) {
      const timer = setInterval(updateElapsed, 1000)
      return () => clearInterval(timer)
    }
  }, [startTime, endTime, status, isPaused, accumulatedPausedTime, pausedAt])

  return elapsed
}
