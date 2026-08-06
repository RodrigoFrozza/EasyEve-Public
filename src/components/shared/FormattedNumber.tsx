'use client'

import { useState, useEffect } from 'react'

interface FormattedNumberProps {
  value: number | string | null | undefined
  options?: Intl.NumberFormatOptions
  locale?: string
  className?: string
  suffix?: string
  prefix?: string
}

export function FormattedNumber({ 
  value, 
  options = {}, 
  locale = 'en-US',
  className,
  suffix = '',
  prefix = ''
}: FormattedNumberProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (value === null || value === undefined || value === '') {
    return <span className={className}>--</span>
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(numValue)) {
    return <span className={className}>--</span>
  }

  if (!mounted) {
    // Basic formatting for SSR to avoid total emptiness, 
    // but the actual localized version will swap in after mount
    return <span className={className}>{prefix}{numValue.toString()}{suffix}</span>
  }

  try {
    const formatted = new Intl.NumberFormat(locale, options).format(numValue)
    return <span className={className}>{prefix}{formatted}{suffix}</span>
  } catch (e) {
    return <span className={className}>{prefix}{numValue.toString()}{suffix}</span>
  }
}
