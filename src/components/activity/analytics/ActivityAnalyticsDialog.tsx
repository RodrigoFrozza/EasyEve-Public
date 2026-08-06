'use client'

import type { Activity } from '@/lib/stores/activity-store'
import type { ActivityType } from '@/lib/constants/activity-colors'
import { getActivityTheme, getActivityThemeIcon } from '@/lib/activity/activity-theme'
import { getRattingNpcFaction, getSalvagingNpcFaction } from '@/lib/constants/activity-data'
import { getActivityColors } from '@/lib/constants/activity-colors'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { useActivityAnalytics } from './useActivityAnalytics'
import { ActivityAnalyticsKpiRow } from './ActivityAnalyticsKpiRow'
import { ActivityAnalyticsScrollArea } from './ActivityAnalyticsScrollArea'
import { MiningAnalyticsPanel } from './panels/MiningAnalyticsPanel'
import { RattingAnalyticsPanel } from './panels/RattingAnalyticsPanel'
import { ExplorationAnalyticsPanel } from './panels/ExplorationAnalyticsPanel'
import { SalvagingAnalyticsPanel } from './panels/SalvagingAnalyticsPanel'
import { AbyssalAnalyticsPanel } from './panels/AbyssalAnalyticsPanel'
import { EscalationsAnalyticsPanel } from './panels/EscalationsAnalyticsPanel'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  activity: Activity
}

function AnalyticsPanelBody({ activity }: { activity: Activity }) {
  const type = (activity.type || 'ratting') as ActivityType
  switch (type) {
    case 'mining':
      return <MiningAnalyticsPanel activity={activity} />
    case 'ratting':
      return <RattingAnalyticsPanel activity={activity} />
    case 'exploration':
      return <ExplorationAnalyticsPanel activity={activity} />
    case 'salvaging':
      return <SalvagingAnalyticsPanel activity={activity} />
    case 'abyssal':
      return <AbyssalAnalyticsPanel activity={activity} />
    case 'escalations':
      return <EscalationsAnalyticsPanel activity={activity} />
    default:
      return <RattingAnalyticsPanel activity={activity} />
  }
}

export function ActivityAnalyticsDialog({ open, onOpenChange, activity }: Props) {
  const { t } = useTranslations()
  const type = (activity.type || 'ratting') as ActivityType
  const theme = getActivityTheme(type)
  const colors = getActivityColors(type)
  const Icon = getActivityThemeIcon(type)
  const { summary, metrics } = useActivityAnalytics(activity)

  const subtitle =
    type === 'salvaging'
      ? getSalvagingNpcFaction(activity) || t('activity.types.salvaging')
      : type === 'ratting'
        ? getRattingNpcFaction(activity) || t('activity.types.ratting')
        : (activity.data as { siteName?: string })?.siteName ||
          activity.region ||
          t(`activity.types.${type}`)

  const kpiItems = [
    {
      labelKey: 'sessionIskPerHour',
      value: summary.iskPerHour,
      format: 'isk' as const,
      tone: 'accent' as const,
    },
    {
      labelKey: 'totalNet',
      value: summary.netProfit,
      format: 'isk' as const,
      tone: 'accent' as const,
    },
    {
      labelKey: 'duration',
      value: 0,
      format: 'text' as const,
      textValue: metrics.elapsedFormatted,
    },
    ...summary.extra.map((e) => ({
      labelKey: e.key,
      value: e.value,
      format: e.format,
      tone: 'tone' in e ? e.tone : undefined,
    })),
  ]

  const kpiColumns = type === 'ratting' ? 6 : 4
  const visibleKpis = type === 'ratting' ? kpiItems : kpiItems.slice(0, 4)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex h-[min(90vh,900px)] max-h-[90vh] w-[calc(100vw-2rem)] max-w-4xl flex-col overflow-hidden gap-0 p-0 sm:max-w-4xl',
          'border border-white/12 bg-zinc-900/95 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.85)] backdrop-blur-xl',
          theme.cardGlow
        )}
      >
        <div className={cn(theme.cardOrb, 'opacity-35')} aria-hidden />
        <div
          className={cn(theme.cardTint, 'opacity-40 mix-blend-soft-light')}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-white/[0.06] via-transparent to-zinc-950/40"
          aria-hidden
        />

        <DialogHeader
          className={cn(
            'relative z-[2] shrink-0 border-b px-6 py-5',
            theme.header,
            'bg-zinc-800/50'
          )}
        >
          <div
            aria-hidden
            className={cn('pointer-events-none absolute inset-0 opacity-60', theme.headerWash)}
          />
          <div className="relative z-[2] flex items-start gap-4 pr-8">
            <div
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center border',
                theme.headerIconBox
              )}
            >
              <Icon className={cn('h-6 w-6', theme.headerIcon)} />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'font-mono text-[10px] font-bold uppercase tracking-wide',
                  theme.textMuted
                )}
              >
                {t('activity.analytics.badge')}
              </p>
              <DialogTitle className={cn('mt-1 text-lg font-bold', theme.text)}>
                {t('activity.analytics.title')} — {colors.label}
              </DialogTitle>
              <DialogDescription className={cn('mt-1 truncate text-sm', theme.textMuted)}>
                {subtitle}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ActivityAnalyticsScrollArea theme={theme}>
          <div className="space-y-5 px-6 py-5 pb-6">
            <ActivityAnalyticsKpiRow theme={theme} items={visibleKpis} columns={kpiColumns} />
            <AnalyticsPanelBody activity={activity} />
          </div>
        </ActivityAnalyticsScrollArea>

        <div
          className={cn(
            'relative z-[2] shrink-0 border-t px-4 py-3',
            theme.footer,
            'bg-zinc-800/40'
          )}
        >
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={cn(
              'h-10 w-full rounded-lg border font-mono text-[10px] font-bold uppercase tracking-wide transition-colors',
              theme.chip,
              'hover:bg-white/[0.06]'
            )}
          >
            {t('activity.analytics.close')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
