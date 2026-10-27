'use client'

import type { Activity } from '@/lib/stores/activity-store'
import { ActivityAnalyticsDialog } from '../analytics/ActivityAnalyticsDialog'

interface MiningAnalyticsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activity: Activity
}

/** @deprecated Use ActivityAnalyticsDialog */
export function MiningAnalyticsModal({ open, onOpenChange, activity }: MiningAnalyticsModalProps) {
  return <ActivityAnalyticsDialog open={open} onOpenChange={onOpenChange} activity={activity} />
}
