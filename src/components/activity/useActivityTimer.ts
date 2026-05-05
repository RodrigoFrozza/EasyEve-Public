import { useState, useEffect } from 'react'

export function useActivityTimer(
  startTime: string | Date, 
  endTime: string | Date | null | undefined,
  isPaused: boolean = false,
  accumulatedPausedTime: number = 0,
  pausedAt: string | Date | null = null
) {
  const [elapsed, setElapsed] = useState<string>('')

  useEffect(() => {
    const updateElapsed = () => {
      const start = new Date(startTime).getTime()
      const now = Date.now()
      
      // Use endTime if available, otherwise use now
      let end = endTime ? new Date(endTime).getTime() : now
      let diff = end - start

      // Subtract historical paused time
      if (accumulatedPausedTime) {
        diff -= accumulatedPausedTime
      }

      // If currently paused, subtract the time since it was paused
      if (isPaused && pausedAt) {
        const pStart = new Date(pausedAt).getTime()
        const currentPauseSegment = now - pStart
        diff -= currentPauseSegment
      }
      
      const safeDiff = Math.max(0, diff)
      const hours = Math.floor(safeDiff / (1000 * 60 * 60))
      const minutes = Math.floor((safeDiff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((safeDiff % (1000 * 60)) / 1000)
      
      setElapsed(`${hours > 0 ? `${hours}h ` : ''}${minutes}m ${seconds}s`)
    }
    
    updateElapsed()
    // Only set interval if activity is still running (no endTime) AND not paused
    // Actually, even if paused we might want to update if we want to show a "frozen" timer
    if (!endTime && !isPaused) {
      const timer = setInterval(updateElapsed, 1000)
      return () => clearInterval(timer)
    }
  }, [startTime, endTime, isPaused, accumulatedPausedTime, pausedAt])

  return elapsed
}