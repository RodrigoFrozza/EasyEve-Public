'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'

function formatRemaining(ms: number): string {
  if (ms <= 0) return '00:00:00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [
    String(days).padStart(2, '0'),
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':')
}

interface EscalationCountdownProps {
  expiresAt?: string
  status?: 'active' | 'completed' | 'expired'
  className?: string
}

export function EscalationCountdown({ expiresAt, status, className }: EscalationCountdownProps) {
  const { t } = useTranslations()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (status !== 'active' || !expiresAt) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [expiresAt, status])

  if (status === 'completed') {
    return (
      <span className={cn('font-mono text-[10px] font-bold uppercase text-emerald-400/90', className)}>
        {t('activity.escalations.completed')}
      </span>
    )
  }

  if (status === 'expired' || !expiresAt) {
    return (
      <span className={cn('font-mono text-[10px] font-bold uppercase text-zinc-500', className)}>
        {t('activity.escalations.expired')}
      </span>
    )
  }

  const remaining = new Date(expiresAt).getTime() - now
  const isUrgent = remaining > 0 && remaining < 60 * 60 * 1000
  const isExpired = remaining <= 0

  if (isExpired) {
    return (
      <span className={cn('font-mono text-[10px] font-bold uppercase text-red-400', className)}>
        {t('activity.escalations.expired')}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'font-mono text-[10px] font-bold tabular-nums tracking-tight',
        isUrgent ? 'text-red-400 animate-pulse' : 'text-orange-200/90',
        className
      )}
    >
      {formatRemaining(remaining)}
    </span>
  )
}
