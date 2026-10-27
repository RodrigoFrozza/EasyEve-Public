'use client'

import { useEffect, useState } from 'react'
import { timeAgo } from '@/lib/utils'

interface TimeAgoProps {
  date: Date | string | null | undefined
  className?: string
}

/**
 * A client-side component that renders relative time (e.g., "5 minutes ago").
 * It avoids hydration mismatches by rendering a placeholder on the server
 * and the actual relative time only after mounting on the client.
 */
export function TimeAgo({ date, className }: TimeAgoProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!date) return <span className={className}>Never</span>
  
  if (!mounted) {
    // Render a consistent placeholder to match server-side HTML
    return <span className={className}>...</span>
  }

  return <span className={className} title={new Date(date).toLocaleString()}>
    {timeAgo(date)}
  </span>
}
