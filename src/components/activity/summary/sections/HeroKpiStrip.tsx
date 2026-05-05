'use client'

import { useMemo } from 'react'
import { ActivityEnhanced, isMiningActivity, isRattingActivity, isExplorationActivity, isAbyssalActivity } from '@/types/domain'
import { ActivityStatDisplay } from '../../shared/ActivityStatDisplay'
import { getActivityFinancialMetrics } from '@/lib/activities/activity-metrics'
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Clock, 
  Box, 
  Target, 
  Sparkles, 
  Skull,
  Crosshair,
  MapPin
} from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'

interface HeroKpiStripProps {
  activity: ActivityEnhanced
}

interface KPI {
  label: string
  value: number
  icon: React.ReactNode
  variant: 'default' | 'success' | 'warning' | 'danger' | 'accent'
  formatAsISK?: boolean
  formatAsNumber?: boolean
  subValue?: string
}

export function HeroKpiStrip({ activity }: HeroKpiStripProps) {
  const { t } = useTranslations()
  const metrics = useMemo(() => getActivityFinancialMetrics(activity), [activity])
  const data = activity.data || {}

  const durationMs = activity.endTime 
    ? new Date(activity.endTime).getTime() - new Date(activity.startTime).getTime()
    : Date.now() - new Date(activity.startTime).getTime()
  
  const hours = Math.max(0.01, durationMs / (1000 * 60 * 60))

  const kpis: KPI[] = useMemo(() => {
    const common = [
      {
        label: t('common.session.netIsk'),
        value: metrics.net,
        icon: <DollarSign />,
        variant: 'success' as const,
        formatAsISK: true
      },
      {
        label: t('common.session.iskPerHour'),
        value: metrics.net / hours,
        icon: <TrendingUp />,
        variant: 'accent' as const,
        formatAsISK: true
      }
    ]

    if (isMiningActivity(activity)) {
      return [
        common[0],
        {
          label: t('common.session.yield') + ' (m³)',
          value: activity.data.totalQuantity || 0,
          icon: <Box />,
          variant: 'accent' as const,
          formatAsNumber: true,
          subValue: 'm³'
        },
        {
          label: t('common.session.yieldPerHour'),
          value: (activity.data.totalQuantity || 0) / hours,
          icon: <TrendingUp />,
          variant: 'default' as const,
          formatAsNumber: true,
          subValue: 'm³/h'
        },
        common[1],
        {
          label: t('common.session.pilots'),
          value: activity.participants.length,
          icon: <Users />,
          variant: 'default' as const,
          formatAsNumber: true
        }
      ]
    }

    if (isRattingActivity(activity)) {
      return [
        common[0],
        {
          label: t('common.session.grossBounty'),
          value: metrics.bounties + metrics.ess + metrics.additionalBounties,
          icon: <Target />,
          variant: 'danger' as const,
          formatAsISK: true
        },
        {
          label: t('common.session.lootAndSalvage'),
          value: metrics.loot + metrics.salvage,
          icon: <Box />,
          variant: 'warning' as const,
          formatAsISK: true
        },
        common[1],
        {
          label: t('common.session.pilots'),
          value: activity.participants.length,
          icon: <Users />,
          variant: 'default' as const,
          formatAsNumber: true
        }
      ]
    }

    if (isAbyssalActivity(activity)) {
      const runs = activity.data.runs || []
      const completedRuns = runs.filter(r => r.status === 'completed').length
      const deaths = runs.filter(r => r.status === 'death').length
      const bestRun = Math.max(0, ...runs.map(r => r.lootValue || 0))

      return [
        common[0],
        {
          label: t('common.session.runs'),
          value: completedRuns,
          icon: <Sparkles />,
          variant: 'accent' as const,
          formatAsNumber: true,
          subValue: deaths > 0 ? `${deaths} 💀` : undefined
        },
        {
          label: t('common.session.bestRun'),
          value: bestRun,
          icon: <Crosshair />,
          variant: 'warning' as const,
          formatAsISK: true
        },
        common[1],
        {
          label: t('common.session.pilots'),
          value: activity.participants.length,
          icon: <Users />,
          variant: 'default' as const,
          formatAsNumber: true
        }
      ]
    }

    if (isExplorationActivity(activity)) {
      return [
        common[0],
        {
          label: t('common.session.sites'),
          value: activity.data.sitesCompleted || 0,
          icon: <MapPin />,
          variant: 'accent' as const,
          formatAsNumber: true
        },
        {
          label: t('common.session.items'),
          value: (activity.data.lootContents || []).length,
          icon: <Box />,
          variant: 'default' as const,
          formatAsNumber: true
        },
        common[1],
        {
          label: t('common.session.pilots'),
          value: activity.participants.length,
          icon: <Users />,
          variant: 'default' as const,
          formatAsNumber: true
        }
      ]
    }

    return [
      ...common,
      {
        label: t('common.session.pilots'),
        value: activity.participants.length,
        icon: <Users />,
        variant: 'default' as const,
        formatAsNumber: true
      }
    ]
  }, [activity, metrics, hours, t])

  return (
    <div className="flex overflow-x-auto pb-4 md:pb-0 md:overflow-x-visible no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
      <div className="flex md:grid md:grid-cols-3 lg:grid-cols-5 gap-3 shrink-0">
        {kpis.map((kpi, idx) => (
          <div key={idx} className="w-[160px] md:w-auto">
            <ActivityStatDisplay
              label={kpi.label}
              value={kpi.value}
              icon={kpi.icon}
              variant={kpi.variant}
              formatAsISK={kpi.formatAsISK}
              formatAsNumber={kpi.formatAsNumber}
              subValue={kpi.subValue}
              size="compact"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
