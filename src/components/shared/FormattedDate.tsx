'use client'

import { useEffect, useState } from 'react'

interface FormattedDateProps {
  date: Date | string | number | null | undefined
  className?: string
  options?: Intl.DateTimeFormatOptions
  mode?: 'date' | 'time' | 'datetime'
}

/**
 * A client-side component that renders a formatted date or time.
 * It avoids hydration mismatches by rendering a placeholder on the server
 * and the actual formatted date only after mounting on the client.
 */
export function FormattedDate({ date, className, options, mode = 'date' }: FormattedDateProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!date) return null
  
  const dateObj = new Date(date)
  if (isNaN(dateObj.getTime())) return null

  if (!mounted) {
    // Render a consistent placeholder to match server-side HTML
    const placeholder = mode === 'time' ? '--:--' : '--/--/----'
    return <span className={className}>{placeholder}</span>
  }

  let formatted = ''
  if (mode === 'time') {
    formatted = dateObj.toLocaleTimeString(undefined, options)
  } else if (mode === 'datetime') {
    formatted = dateObj.toLocaleString(undefined, options)
  } else {
    formatted = dateObj.toLocaleDateString(undefined, options)
  }

  return (
    <span className={className}>
      {formatted}
    </span>
  )
}
