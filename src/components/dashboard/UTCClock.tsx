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
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
      <Globe className="h-3.5 w-3.5 text-blue-500 animate-pulse" />
      <span className="text-xs font-mono font-bold tracking-widest">
        {time || '--:--:--'} <span className="text-[10px] text-zinc-600 ml-1">UTC</span>
      </span>
    </div>
  )
}
