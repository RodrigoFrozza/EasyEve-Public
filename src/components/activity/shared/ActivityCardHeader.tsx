'use client'

import { LayoutGrid, AlignJustify, Activity as ActivityIcon } from 'lucide-react'
import { CardHeader } from '@/components/ui/card'
import { useTranslations } from '@/i18n/hooks'
import { cn } from '@/lib/utils'
import { getActivityTheme, getActivityThemeIcon } from '@/lib/activity/activity-theme'
import { getRattingNpcFaction, getSalvagingNpcFaction } from '@/lib/constants/activity-data'

interface ActivityCardHeaderProps {
  activity: {
    type: string
    region?: string
    isPaused?: boolean
    data?: { siteName?: string; region?: string; npcFaction?: string; isAutoTracked?: boolean }
    item?: { name?: string }
  }
  index: number
  displayMode: 'compact' | 'expanded'
  setDisplayMode: (mode: 'compact' | 'expanded') => void
  elapsed: string
  mounted: boolean
  typeLabel: string
}

export function ActivityCardHeader({
  activity,
  index,
  displayMode,
  setDisplayMode,
  elapsed,
  mounted,
  typeLabel,
}: ActivityCardHeaderProps) {
  const { t } = useTranslations()
  const theme = getActivityTheme(activity.type)
  const Icon = getActivityThemeIcon(activity.type) || ActivityIcon

  const headerTitle =
    activity.type === 'abyssal'
      ? t('activity.types.abyssal')
      : activity.type === 'salvaging'
        ? getSalvagingNpcFaction(activity) || t('activity.types.salvaging')
        : activity.type === 'ratting'
          ? getRattingNpcFaction(activity) || t('activity.types.ratting')
          : activity.type === 'exploration'
          ? activity.region ||
            activity.data?.region ||
            activity.data?.siteName ||
            t('activity.types.exploration')
          : activity.item?.name || activity.data?.siteName || t('activity.activeOperations')

  const statusDotClass = activity.isPaused ? 'bg-amber-500' : theme.accentBar

  return (
    <CardHeader className="relative z-[2] shrink-0 border-b border-white/[0.06] px-5 py-4 sm:px-6 sm:py-5">
      <div
        className={cn(
          'absolute left-0 top-3 bottom-3 z-[1] w-[3px] rounded-full',
          theme.accentBar
        )}
      />
      <div className="relative z-[2] flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="relative shrink-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-[9px] border border-white/[0.08] bg-[#12202b] sm:h-14 sm:w-14">
              <Icon className={cn('h-6 w-6', theme.headerIcon)} />
            </div>
            <div
              className={cn(
                'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#101a26]',
                statusDotClass
              )}
            >
              {!activity.isPaused && (
                <div className={cn('absolute inset-0 rounded-full animate-ta-pulse', statusDotClass)} />
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="mb-1 font-accent text-[10px] font-semibold uppercase tracking-[0.06em] text-ta-muted">
              {t('activity.fleet')}{' '}
              <span className={theme.text}>#{String(index + 1).padStart(2, '0')}</span>
              <span className="text-ta-faint"> · </span>
              {typeLabel}
              {activity.data?.isAutoTracked && (
                <span className="ml-2 rounded-[5px] border border-ta-info/25 bg-ta-info/10 px-1.5 py-0.5 text-[9px] font-medium text-ta-info">
                  {t('activity.tracker.history.autoTracked')}
                </span>
              )}
            </p>
            <h3 className="truncate font-accent text-base font-bold text-ta-bright sm:text-lg">{headerTitle}</h3>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 self-end sm:self-center">
          <div className="hidden items-center gap-0.5 rounded-[9px] border border-white/[0.08] bg-ta-inset p-0.5 md:flex">
            <button
              type="button"
              onClick={() => setDisplayMode('compact')}
              className={cn(
                'rounded-md p-2 transition-colors',
                displayMode === 'compact' ? theme.chipActive : 'text-eve-muted hover:text-eve-text'
              )}
              title={t('activity.compactView')}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('expanded')}
              className={cn(
                'rounded-md p-2 transition-colors',
                displayMode === 'expanded' ? theme.chipActive : 'text-eve-muted hover:text-eve-text'
              )}
              title={t('activity.detailedView')}
            >
              <AlignJustify className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2.5 rounded-[8px] border border-white/[0.08] bg-ta-inset px-3 py-2 sm:px-4 sm:py-2.5">
            <div className={cn('h-2 w-2 shrink-0 rounded-full', statusDotClass)} />
            <span
              className="font-sans text-sm font-bold tabular-nums tracking-wide text-ta-bright sm:text-base"
              suppressHydrationWarning
            >
              {mounted ? elapsed : '00:00:00'}
            </span>
          </div>
        </div>
      </div>
    </CardHeader>
  )
}
