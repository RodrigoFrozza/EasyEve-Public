'use client'

import { useMemo } from 'react'
import { formatISK, formatNumber, cn } from '@/lib/utils'
import { 
  Wallet, 
  Clock, 
  TrendingUp, 
  Box, 
  Target, 
  Crosshair,
  Sparkles,
  Users
} from 'lucide-react'
import { ActivityStatDisplay } from '../shared/ActivityStatDisplay'
import { useTranslations } from '@/i18n/hooks'
import { ActivityEnhanced, isMiningActivity, isRattingActivity, isExplorationActivity, isAbyssalActivity, isEscalationsActivity } from '@/types/domain'
import { getActivityFinancialMetrics } from '@/lib/activities/activity-metrics'
import { getActivityDurationMs } from '@/lib/activities/activity-duration'
import { isAbyssalRunCompleted } from '@/lib/activities/abyssal-metrics'

interface OverviewTabProps {
  activity: ActivityEnhanced
  logs?: any[]
  color?: 'blue' | 'rose' | 'emerald' | 'purple' | 'orange' | 'lime'
}

export function OverviewTab({ activity, logs = [], color: propColor }: OverviewTabProps) {
  const { t } = useTranslations()
  
  const activityType = activity.type
  const colorVariant = useMemo(() => {
    if (propColor) return propColor
    switch (activityType) {
      case 'mining': return 'blue'
      case 'ratting': return 'rose'
      case 'exploration': return 'emerald'
      case 'salvaging': return 'lime'
      case 'abyssal': return 'purple'
      case 'escalations': return 'orange'
      default: return 'blue'
    }
  }, [activityType, propColor])

  const data = useMemo(() => activity.data || {}, [activity.data])
  
  const durationMs = useMemo(
    () =>
      getActivityDurationMs({
        startTime: activity.startTime,
        endTime: activity.endTime,
        status: activity.status,
        updatedAt: activity.updatedAt,
        accumulatedPausedTime: activity.accumulatedPausedTime,
        isPaused: activity.isPaused,
        pausedAt: activity.pausedAt,
      }),
    [
      activity.startTime,
      activity.endTime,
      activity.status,
      activity.updatedAt,
      activity.accumulatedPausedTime,
      activity.isPaused,
      activity.pausedAt,
    ]
  )
  const hours = Math.max(0.1, durationMs / 3_600_000)

  const metrics = useMemo(() => getActivityFinancialMetrics(activity), [activity])
  const totalEarned = metrics.net
  const perHour = totalEarned / hours

  const kpis = useMemo(() => {
    const items: Array<{
      label: string
      value: number | string
      icon: React.ReactNode
      variant: 'default' | 'accent' | 'warning' | 'success' | 'danger'
      formatAsISK?: boolean
      formatAsNumber?: boolean
      subValue?: string
    }> = []

    // Map activity color to variant
    const variantMap: Record<string, 'default' | 'accent' | 'warning' | 'success' | 'danger'> = {
      blue: 'accent',
      rose: 'danger',
      emerald: 'success',
      purple: 'warning',
    }
    const typeVariant = variantMap[colorVariant] || 'accent'

    // Common KPIs
    items.push({
      label: t('common.session.totalEarned'),
      value: totalEarned,
      icon: <Wallet className="h-4 w-4" />,
      variant: 'success',
      formatAsISK: true,
    })

    items.push({
      label: t('common.session.perHour'),
      value: perHour,
      icon: <TrendingUp className="h-4 w-4" />,
      variant: typeVariant,
      formatAsISK: true,
      subValue: 'ISK/h',
    })

    items.push({
      label: t('common.session.duration'),
      value: formatDuration(durationMs),
      icon: <Clock className="h-4 w-4" />,
      variant: 'default',
    })

    // Type-specific KPIs
    if (isMiningActivity(activity)) {
      const totalVolume = data.totalQuantity || 0
      items.push({
        label: t('activity.mining.volumeM3'),
        value: totalVolume,
        icon: <Box className="h-4 w-4" />,
        variant: 'accent',
        formatAsNumber: true,
        subValue: 'm³',
      })
    }

    if (isRattingActivity(activity)) {
      const shipsKilled = data.shipsKilled || (logs || []).filter((l: any) => l.type === 'bounty').length
      items.push({
        label: t('activity.ratting.kills'),
        value: shipsKilled,
        icon: <Target className="h-4 w-4" />,
        variant: 'accent',
        formatAsNumber: true,
      })
    }

    if (isEscalationsActivity(activity)) {
      const active = (data.escalations || []).filter((e: { status?: string }) => e.status === 'active').length
      items.push({
        label: t('activity.escalations.activeCount'),
        value: active,
        icon: <Target className="h-4 w-4" />,
        variant: 'accent',
        formatAsNumber: true,
      })
    }

    if (isAbyssalActivity(activity)) {
      const runsCompleted = (data.runs || []).filter((r: any) => isAbyssalRunCompleted(r)).length
      items.push({
        label: t('activity.abyssal.runsCompleted'),
        value: runsCompleted,
        icon: <Sparkles className="h-4 w-4" />,
        variant: 'accent',
        formatAsNumber: true,
      })
      items.push({
        label: t('activity.abyssal.tier'),
        value: data.lastRunDefaults?.tier || data.tier || t('common.notAvailable'),
        icon: <Crosshair className="h-4 w-4" />,
        variant: 'warning',
      })
    }

    if (isExplorationActivity(activity)) {
      const sitesCompleted = data.sitesCompleted || 0
      items.push({
        label: t('activity.exploration.sitesCompleted'),
        value: sitesCompleted,
        icon: <Target className="h-4 w-4" />,
        variant: 'accent',
        formatAsNumber: true,
      })
    }

    // Pilots count
    const pilots = activity.participants?.length || 0
    items.push({
      label: t('common.session.pilots'),
      value: pilots,
      icon: <Users className="h-4 w-4" />,
      variant: 'default',
      formatAsNumber: true,
    })

    return items
  }, [activity, data, totalEarned, perHour, logs, t, durationMs, colorVariant])

  return (
    <div className="space-y-4">
      {/* KPIs Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {kpis.map((kpi, idx) => (
          <ActivityStatDisplay
            key={idx}
            label={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
            variant={kpi.variant as any}
            formatAsISK={kpi.formatAsISK}
            formatAsNumber={kpi.formatAsNumber}
            subValue={kpi.subValue}
          />
        ))}
      </div>
    </div>
  )
}

function formatDuration(durationMs: number): string {
  const diffMs = Math.max(0, durationMs)
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}