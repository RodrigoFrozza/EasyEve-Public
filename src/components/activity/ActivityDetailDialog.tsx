'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useTranslations } from '@/i18n/hooks'
import { cn, isPremium } from '@/lib/utils'
import { ActivityEnhanced } from '@/types/domain'
import { useActivityStats } from '@/lib/hooks/use-activity-stats'
import { useActivityTimer } from './useActivityTimer'
import { ActivityToolbar } from './ActivityToolbar'
import { useSession } from '@/lib/session-client'
import { RattingLootHistoryModal } from './modals/RattingLootHistoryModal'
import { UnifiedSummaryPanel } from './summary/UnifiedSummaryPanel'
import { SessionDetailScrollArea } from './summary/SessionDetailScrollArea'
import { getActivityTheme, getActivityThemeIcon } from '@/lib/activity/activity-theme'
import { getRattingNpcFaction, getSalvagingNpcFaction } from '@/lib/constants/activity-data'
import { formatSessionDuration } from '@/lib/activities/session-kpis'
import { SESSION_MODAL_SURFACE } from '@/lib/activity/session-modal-surface'

interface ActivityDetailDialogProps {
  activity: ActivityEnhanced
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ActivityDetailDialog({
  activity: initialActivity,
  trigger,
  open,
  onOpenChange,
}: ActivityDetailDialogProps) {
  const { t } = useTranslations()
  const { data: session } = useSession()
  const [activity, setActivity] = useState<ActivityEnhanced>(initialActivity)
  const [isLootHistoryOpen, setIsLootHistoryOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  const isLiveSession = activity.status !== 'completed'
  const liveElapsed = useActivityTimer(
    activity.startTime,
    activity.endTime,
    activity.isPaused,
    activity.accumulatedPausedTime ?? 0,
    activity.pausedAt
  )
  const durationLabel = isLiveSession
    ? liveElapsed
    : formatSessionDuration(activity)

  useEffect(() => {
    setMounted(true)
  }, [])

  const remoteSyncKey = `${initialActivity.status}|${initialActivity.data?.lastSyncAt ?? ''}|${initialActivity.endTime ?? ''}`
  useEffect(() => {
    setActivity(initialActivity)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialActivity.id, remoteSyncKey])

  const { miningActivity, rattingActivity, miningData, rattingData, isMining } =
    useActivityStats(activity)

  const theme = useMemo(() => getActivityTheme(activity.type), [activity.type])
  const ThemeIcon = useMemo(() => getActivityThemeIcon(activity.type), [activity.type])

  const hasPremium = isPremium(session?.user?.subscriptionEnd)

  const canExportCsv = useMemo(() => {
    const data = activity.data as Record<string, unknown>
    if (isMining) return (miningData?.logs?.length ?? 0) > 0
    if (rattingActivity) return (rattingData?.logs?.length ?? 0) > 0
    if (activity.type === 'exploration' || activity.type === 'salvaging') {
      return Array.isArray(data.logs) && data.logs.length > 0
    }
    if (activity.type === 'abyssal') {
      const runs = data.runs as Array<unknown> | undefined
      const logs = data.logs as Array<unknown> | undefined
      return (runs?.length ?? 0) > 0 || (logs?.length ?? 0) > 0
    }
    return false
  }, [activity, isMining, miningData, rattingActivity, rattingData])

  const handleExportCSV = () => {
    if (!hasPremium) {
      toast.error(t('activity.summary.exportPremiumOnly'))
      return
    }
    if (!canExportCsv) {
      toast.error(t('activity.summary.exportNoLogs'))
      return
    }

    const data = activity.data as Record<string, unknown>
    let headers = ''
    let rows = ''

    if (miningActivity && miningData?.logs) {
      headers = 'Date,Character,Ore,Quantity,EstimatedValue\n'
      rows = miningData.logs
        .map(
          (l) =>
            `${new Date(String(l.date)).toISOString()},${l.charName},${l.oreName},${l.quantity},${l.value ?? l.estimatedValue ?? 0}`
        )
        .join('\n')
    } else if (rattingActivity && rattingData?.logs) {
      headers = 'Date,Character,Type,Amount\n'
      rows = rattingData.logs
        .map(
          (l) =>
            `${new Date(String(l.date)).toISOString()},${l.charName ?? l.characterName},${l.type},${l.amount}`
        )
        .join('\n')
    } else if (
      (activity.type === 'exploration' || activity.type === 'salvaging') &&
      Array.isArray(data.logs)
    ) {
      headers =
        activity.type === 'salvaging'
          ? 'Date,Label,Type,Value\n'
          : 'Date,Character,Type,Amount\n'
      rows = (data.logs as Array<Record<string, unknown>>)
        .map((l) => {
          const date = new Date(String(l.date)).toISOString()
          if (activity.type === 'salvaging') {
            const label = String(l.label ?? 'Salvage').replace(/,/g, ';')
            return `${date},${label},${l.type},${l.value ?? 0}`
          }
          return `${date},${l.charName},${l.type},${l.amount ?? l.value ?? 0}`
        })
        .join('\n')
    } else if (activity.type === 'abyssal') {
      const runs = (data.runs || []) as Array<Record<string, unknown>>
      headers = 'RunId,Start,End,Status,Tier,Weather,Ship,LootValue\n'
      rows = runs
        .map(
          (r) =>
            `${r.id},${r.startTime},${r.endTime ?? ''},${r.status},${r.tier ?? ''},${r.weather ?? ''},${r.ship ?? ''},${r.lootValue ?? 0}`
        )
        .join('\n')
    }

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activity.type}_history_${activity.id.slice(0, 8)}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const displayName =
    activity.type === 'salvaging'
      ? getSalvagingNpcFaction(activity) || t('activity.types.salvaging')
      : activity.type === 'ratting'
        ? getRattingNpcFaction(activity) ||
          (activity.data as { siteName?: string }).siteName ||
          t('activity.types.ratting')
        : (activity.data as { siteName?: string }).siteName ||
          t(`activity.types.${activity.type}` as 'activity.types.ratting')

  if (!mounted) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className={cn(
          'flex h-[min(92vh,920px)] max-h-[92vh] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[96vw] lg:max-w-[1080px]',
          SESSION_MODAL_SURFACE.dialog,
          theme.cardGlow,
          '[&>button]:right-4 [&>button]:top-4 [&>button]:z-[3] [&>button]:h-10 [&>button]:w-10 [&>button]:text-zinc-300 [&>button]:hover:text-red-400'
        )}
      >
        <div className={cn(theme.cardOrb, 'opacity-30')} aria-hidden />
        <div className={cn(theme.cardTint, 'opacity-35 mix-blend-soft-light')} aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 z-[1] rounded-[inherit] bg-gradient-to-b from-white/[0.05] via-transparent to-zinc-950/50"
          aria-hidden
        />
        <DialogHeader className="sr-only">
          <DialogTitle>{displayName}</DialogTitle>
          <DialogDescription>
            {t('common.session.sessionDetailsSubtitle')}
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            'relative z-[2] shrink-0 overflow-visible border-b p-3 sm:p-4 lg:p-5',
            theme.header,
            'bg-zinc-800/45'
          )}
        >
          <div className={cn('pointer-events-none absolute inset-0 opacity-50', theme.headerWash)} />
          <div className={cn('absolute left-0 top-0 h-full w-1', theme.accentBar)} />

          <div className="relative z-10 flex flex-col justify-between gap-3 lg:flex-row lg:items-start lg:gap-4">
            <div className="flex flex-row items-center gap-3 sm:gap-4 lg:gap-6">
              <div
                className={cn(
                  'hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border',
                  theme.headerIconBox
                )}
              >
                <ThemeIcon className={cn('h-6 w-6', theme.headerIcon)} />
              </div>
              <div className="flex flex-col items-start gap-1">
                <span
                  className={cn(
                    'font-outfit text-[8px] font-black uppercase tracking-[0.24em] lg:text-[9px]',
                    'text-zinc-400'
                  )}
                >
                  {t('common.session.duration')}
                </span>
                <div className={cn('rounded-none border px-4 py-2 ring-1', theme.metricShell)}>
                  <span
                    className={cn(
                      'font-mono text-xl font-black tabular-nums tracking-tight lg:text-2xl',
                      theme.text
                    )}
                  >
                    {durationLabel}
                  </span>
                </div>
              </div>
            </div>

            <div className="min-w-0 flex-1 p-0 text-left">
              <div className="mb-2 flex flex-wrap items-center gap-2 sm:mb-3 sm:gap-3">
                <span
                  className={cn(
                    'rounded-none px-2 py-0.5 font-outfit text-[8px] font-black uppercase tracking-[0.2em] sm:py-1 sm:text-[9px]',
                    theme.chip
                  )}
                >
                  {t(`activity.types.${activity.type}` as 'activity.types.ratting')}
                </span>
                {activity.data?.isAutoTracked && (
                  <span className="rounded-none border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 font-outfit text-[8px] font-black uppercase tracking-[0.2em] text-blue-400 sm:py-1 sm:text-[9px]">
                    AUTO
                  </span>
                )}
                <div className="h-3 w-[1px] bg-white/10 sm:h-4" />
                <span className="truncate font-mono text-[9px] font-black uppercase tracking-[0.12em] text-zinc-500 sm:text-[10px]">
                  {activity.id.slice(0, 12)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 font-outfit text-lg font-black uppercase leading-[1.15] tracking-tight text-white sm:gap-3 sm:text-xl lg:text-2xl xl:text-3xl">
                <span className="line-clamp-2 max-w-full break-words">{displayName}</span>
                {activity.status === 'completed' && (
                  <span
                    className={cn(
                      'rounded-none border px-2 py-0.5 font-outfit text-[8px] font-black uppercase tracking-[0.18em] sm:py-1 sm:text-[9px]',
                      theme.chipActive
                    )}
                  >
                    {t('common.session.done')}
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-400 sm:text-[11px]">
                    {t('common.session.start')}
                  </span>
                  <p className="font-mono text-base font-black tracking-tight text-zinc-100 sm:text-lg">
                    {new Date(activity.startTime).toLocaleString()}
                  </p>
                </div>
                {activity.endTime && (
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-400 sm:text-[11px]">
                      {t('common.session.end')}
                    </span>
                    <p className="font-mono text-base font-black tracking-tight text-zinc-100 sm:text-lg">
                      {new Date(activity.endTime).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <SessionDetailScrollArea
          theme={theme}
          className={cn('z-[2]', SESSION_MODAL_SURFACE.body)}
        >
          <div className="space-y-5 p-4 sm:p-5 lg:p-6">
            <ActivityToolbar
              theme={theme}
              onExportCSV={handleExportCSV}
              isPremium={hasPremium}
              exportDisabled={!canExportCsv}
            />

            <UnifiedSummaryPanel
              activity={activity}
              theme={theme}
              onOpenMTU={() => setIsLootHistoryOpen(true)}
            />
          </div>
        </SessionDetailScrollArea>

        {rattingActivity && (
          <RattingLootHistoryModal
            open={isLootHistoryOpen}
            onOpenChange={setIsLootHistoryOpen}
            activity={activity}
            onRefresh={() => {
              void fetch(`/api/activities/${activity.id}`)
                .then((res) => (res.ok ? res.json() : null))
                .then((fresh) => {
                  if (fresh) setActivity(fresh)
                })
            }}
            onDataChange={(data) => {
              setActivity((prev) => ({ ...prev, data: data as ActivityEnhanced['data'] }))
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
