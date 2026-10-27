'use client'

import { useState, useEffect } from 'react'
import { Globe } from 'lucide-react'

export function UTCClock() {
  const [time, setTime] = useState<string>('')

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      const utc = now.toISOString().split('T')[1].split('.')[0]
      setTime(utc)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-eve-dark border border-eve-border rounded-sm text-eve-muted">
      <Globe className="h-3 w-3 text-eve-accent/60 shrink-0" />
      <span className="text-[11px] tabular-nums">
        {time || '00:00:00'} <span className="text-[10px] text-eve-muted/60 ml-0.5">EVE</span>
      </span>
    </div>
  )
}
