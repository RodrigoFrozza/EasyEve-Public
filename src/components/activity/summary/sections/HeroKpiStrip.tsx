'use client'

import { useMemo } from 'react'
import { ActivityEnhanced } from '@/types/domain'
import { ActivityStatDisplay } from '../../shared/ActivityStatDisplay'
import { getSessionKpis, type SessionKpiIconId } from '@/lib/activities/session-kpis'
import { getActivityTheme } from '@/lib/activity/activity-theme'
import {
  DollarSign,
  TrendingUp,
  Box,
  Target,
  Sparkles,
  Crosshair,
  Gem,
  Gauge,
  Wallet,
  Clock3,
  MapPin,
} from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'
import { cn } from '@/lib/utils'
import type { ActivityThemeClasses } from '@/lib/activity/activity-theme'
import { analyticsMetricTile } from '@/lib/activity/activity-analytics-surface'

interface HeroKpiStripProps {
  activity: ActivityEnhanced
  theme?: ActivityThemeClasses
}

const ICON_BY_ID: Record<SessionKpiIconId, React.ReactNode> = {
  dollar: <DollarSign className="h-3 w-3" />,
  trending: <TrendingUp className="h-3 w-3" />,
  box: <Box className="h-3 w-3" />,
  target: <Target className="h-3 w-3" />,
  mapPin: <MapPin className="h-3 w-3" />,
  sparkles: <Sparkles className="h-3 w-3" />,
  crosshair: <Crosshair className="h-3 w-3" />,
  gem: <Gem className="h-3 w-3" />,
  gauge: <Gauge className="h-3 w-3" />,
  wallet: <Wallet className="h-3 w-3" />,
  clock: <Clock3 className="h-3 w-3" />,
}

export function HeroKpiStrip({ activity, theme: themeProp }: HeroKpiStripProps) {
  const { t } = useTranslations()
  const theme = themeProp ?? getActivityTheme(activity.type)

  const kpis = useMemo(() => getSessionKpis(activity), [activity])

  const statShell = cn(analyticsMetricTile(theme), 'flex flex-col gap-1')
  const statProps = {
    size: 'compact' as const,
    labelClassName: cn(theme.textMuted, 'text-[9px]'),
    subValueClassName: theme.textMuted,
    valueClassName: cn(theme.text, 'text-zinc-50'),
  }

  return (
    <div className="flex overflow-x-auto pb-4 md:pb-0 md:overflow-x-visible no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
      <div className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-3 shrink-0 w-full">
        {kpis.map((kpi) => (
          <div key={kpi.id} className="w-[160px] md:w-auto min-w-0">
            <ActivityStatDisplay
              {...statProps}
              label={t(kpi.labelKey as 'activity.ratting.bounty')}
              value={kpi.value}
              icon={
                <span className={cn(theme.headerIcon, 'opacity-90')}>
                  {ICON_BY_ID[kpi.iconId]}
                </span>
              }
              variant={kpi.variant}
              formatAsISK={kpi.formatAsISK}
              formatAsCompactISK={kpi.formatAsCompactISK}
              formatAsNumber={kpi.formatAsNumber}
              subValue={kpi.subValue}
              className={statShell}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
