'use client'

import { useMemo } from 'react'
import type { Activity } from '@/lib/stores/activity-store'
import { useActivityMetrics } from '@/lib/hooks/use-activity-metrics'
import {
  type AnalyticsLogEntry,
  type AbyssalRunEntry,
  getAnalyticsSessionSummary,
} from '@/lib/activity/activity-analytics'

export function useActivityAnalytics(activity: Activity) {
  const { metrics, isMounted } = useActivityMetrics(activity)

  const data = (activity.data || {}) as Record<string, unknown>
  const logs = useMemo(
    () => ((data.logs || []) as AnalyticsLogEntry[]),
    [data.logs]
  )
  const runs = useMemo(
    () => ((data.runs || []) as AbyssalRunEntry[]),
    [data.runs]
  )

  const summary = useMemo(
    () =>
      getAnalyticsSessionSummary(activity, {
        netProfit: metrics.netProfit,
        iskPerHour: metrics.iskPerHour,
        elapsedFormatted: metrics.elapsedFormatted,
        elapsedMs: metrics.elapsedMs,
      }),
    [activity, metrics]
  )

  return {
    activity,
    metrics,
    isMounted,
    logs,
    runs,
    data,
    summary,
    oreBreakdown: (data.oreBreakdown || {}) as Record<
      string,
      { name?: string; estimatedValue?: number; quantity?: number; volumeValue?: number }
    >,
    participantBreakdown: (data.participantBreakdown || {}) as Record<
      string,
      { characterName?: string; estimatedValue?: number; volumeValue?: number }
    >,
  }
}
