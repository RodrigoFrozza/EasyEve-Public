'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { ActivityCardLayoutMode } from './activity-card-display-context'

/** Shared vertical rhythm inside activity cards */
export const ACTIVITY_CARD_BODY_GAP = 'gap-3'

/** Full width in grid columns; height follows content (no fixed / max height on shell) */
export const ACTIVITY_CARD_SHELL = 'h-auto w-full min-w-0'

export function getActivityCardShellClass(_mode: ActivityCardLayoutMode): string {
  return ACTIVITY_CARD_SHELL
}

export function getActivityCardContentClass(_mode: ActivityCardLayoutMode): string {
  return 'flex flex-col'
}

export function ActivityCardBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col', ACTIVITY_CARD_BODY_GAP, className)}>{children}</div>
  )
}

/** Main content block (log / timer); grows vertically with content */
export function ActivityCardMainSlot({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('flex w-full min-w-0 flex-col', className)}>{children}</div>
}

export function ActivityParticipantsRow({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      {children}
    </div>
  )
}

export function ActivityMetricsGrid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('grid grid-cols-2 gap-2 lg:grid-cols-4', className)}>{children}</div>
  )
}
