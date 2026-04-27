import { useState, useEffect } from 'react'

export function useActivityTimer(startTime: string | Date, endTime: string | Date | null | undefined) {
  const [elapsed, setElapsed] = useState<string>('')

  useEffect(() => {
    const updateElapsed = () => {
      const start = new Date(startTime).getTime()
      const end = endTime ? new Date(endTime).getTime() : Date.now()
      const diff = end - start
      
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      
      setElapsed(`${hours > 0 ? `${hours}h ` : ''}${minutes}m ${seconds}s`)
    }
    
    updateElapsed()
    if (!endTime) {
      const timer = setInterval(updateElapsed, 1000)
      return () => clearInterval(timer)
    }
  }, [startTime, endTime])

  return elapsed
}