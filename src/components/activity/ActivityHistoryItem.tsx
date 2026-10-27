'use client'

import { memo, useMemo, useState } from 'react'
import { formatISK, formatNumber, cn } from '@/lib/utils'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { Clock, Users, Trash2, ChevronRight, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/i18n/hooks'
import { getActivityFinancialMetrics } from '@/lib/activities/activity-metrics'
import { getActivityDurationMs } from '@/lib/activities/activity-duration'
import {
  getActivityTheme,
  getActivityThemeIcon,
  getSpaceBadgeClass,
  formatSpaceLabel,
} from '@/lib/activity/activity-theme'
import { HISTORY_LIST_SURFACE } from '@/lib/activity/session-modal-surface'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Activity } from '@/lib/stores/activity-store'

interface ActivityHistoryItemProps {
  activity: Activity
  onDelete: (id: string) => void
  onOpenDetail: (activity: Activity) => void
}

function ActivityHistoryItemComponent({
  activity,
  onDelete,
  onOpenDetail,
}: ActivityHistoryItemProps) {
  const { t } = useTranslations()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const theme = getActivityTheme(activity.type)
  const Icon = getActivityThemeIcon(activity.type)

  const startTime = useMemo(() => new Date(activity.startTime), [activity.startTime])
  const data = useMemo(() => activity.data || {}, [activity.data])
  const isMining = activity.type === 'mining'
  const participantsCount = activity.participants?.length || 0
  const displayName =
    activity.type === 'salvaging'
      ? (data.npcFaction as string) ||
        (data.region as string) ||
        activity.region ||
        t('activity.types.salvaging')
      : activity.type === 'exploration'
        ? activity.region || (data.region as string) || (data.siteName as string) || t('activity.types.exploration')
        : (data.siteName as string) || t(`activity.types.${activity.type}` as 'activity.types.ratting')

  const durationText = useMemo(() => {
    const durationMs = getActivityDurationMs({
      startTime: activity.startTime,
      endTime: activity.endTime,
      status: activity.status,
      updatedAt: activity.updatedAt,
      accumulatedPausedTime: activity.accumulatedPausedTime,
      isPaused: activity.isPaused,
      pausedAt: activity.pausedAt,
    })

    const hours = Math.floor(durationMs / (1000 * 60 * 60))
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours > 0 ? `${hours}h ` : ''}${minutes}m`
  }, [
    activity.endTime,
    activity.status,
    activity.isPaused,
    activity.pausedAt,
    activity.updatedAt,
    activity.accumulatedPausedTime,
    activity.startTime,
  ])

  const netEarnings = useMemo(
    () => getActivityFinancialMetrics({ type: activity.type, data }).net,
    [activity.type, data]
  )

  const relativeTime = useMemo(() => {
    const now = new Date()
    const diff = now.getTime() - startTime.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor(diff / (1000 * 60))

    if (minutes < 1) return t('common.now')
    if (minutes < 60) return t('common.minutesAgo', { count: minutes })
    if (hours < 24) return t('common.hoursAgo', { count: hours })
    if (days === 1) return t('common.yesterday')
    if (days < 7) return t('common.daysAgo', { count: days })
    return t('common.weeksAgo', { count: Math.floor(days / 7) })
  }, [startTime, t])

  const isSyncing = useMemo(() => {
    if (activity.status !== 'completed' || !activity.endTime) return false
    const diffMs = Date.now() - new Date(activity.endTime).getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    return activity.type === 'ratting' ? diffMins <= 150 : activity.type === 'mining' ? diffMins <= 60 : false
  }, [activity.endTime, activity.status, activity.type])

  return (
    <div className="group/history relative w-full">
      <button
        type="button"
        onClick={() => onOpenDetail(activity)}
        className={cn(
          'group/item relative w-full overflow-hidden rounded-md border text-left transition-colors',
          HISTORY_LIST_SURFACE.row,
          HISTORY_LIST_SURFACE.rowHover,
          theme.historyRowHover
        )}
      >
        <div className={cn('absolute left-0 top-0 h-full w-1', theme.accentBar)} />

        <div className="relative grid grid-cols-1 gap-3 p-3 sm:p-4 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-4">
          <div className="min-w-0 space-y-2.5">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border sm:h-12 sm:w-12',
                  theme.historyIconBox
                )}
              >
                <Icon className={cn('h-5 w-5', theme.headerIcon)} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                  {t(`activity.types.${activity.type}` as 'activity.types.ratting')}
                  <span className="mx-1.5 text-eve-border">·</span>
                  {formatSpaceLabel(activity.space)}
                </p>
                <p className={cn('truncate text-sm font-bold sm:text-base', theme.text)}>
                  {displayName}
                </p>
              </div>

              <div className="hidden shrink-0 flex-wrap justify-end gap-1 sm:flex">
                <Badge
                  variant="outline"
                  className={cn('text-[9px] font-medium', getSpaceBadgeClass(activity.space))}
                >
                  {formatSpaceLabel(activity.space)}
                </Badge>
                {isSyncing && (
                  <Badge
                    variant="outline"
                    className="border-blue-500/30 bg-blue-500/10 text-[9px] text-blue-400"
                  >
                    {t('activity.tracker.history.syncing')}
                  </Badge>
                )}
                {!!data.isAutoTracked && (
                  <Badge
                    variant="outline"
                    className="border-eve-accent/25 bg-eve-accent/10 text-[9px] text-eve-accent"
                  >
                    {t('activity.tracker.history.autoTracked')}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-400">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-sm border px-2 py-1',
                  HISTORY_LIST_SURFACE.metaChip
                )}
              >
                <Clock className="h-3 w-3 shrink-0 text-zinc-500" />
                {t('activity.tracker.history.duration', { value: durationText })}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-sm border px-2 py-1',
                  HISTORY_LIST_SURFACE.metaChip
                )}
              >
                <Users className="h-3 w-3 shrink-0 text-zinc-500" />
                {t('activity.tracker.history.pilots', { count: participantsCount })}
              </span>
              {isMining && Number(data.totalQuantity) > 0 && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-sm border px-2 py-1',
                    theme.chip
                  )}
                >
                  {t('activity.tracker.history.yield', {
                    value: formatNumber(Number(data.totalQuantity)),
                  })}
                </span>
              )}
              <span className="ml-auto hidden text-eve-muted/80 sm:inline">{relativeTime}</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-eve-border/20 pt-3 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4">
            <div className="min-w-0 flex-1 lg:text-right">
              <p
                className={cn(
                  'text-xl font-bold tabular-nums sm:text-2xl',
                  netEarnings > 0 ? theme.revenuePositive : 'text-eve-muted'
                )}
              >
                {formatISK(netEarnings)}
              </p>
              <p className="mt-0.5 text-[10px] text-zinc-400">
                {t('activity.tracker.history.netRevenue')}
              </p>
              <p className="mt-1 text-[10px] text-eve-muted/70 sm:hidden">
                {relativeTime}
                <span className="mx-1">·</span>
                <FormattedDate date={activity.startTime} />
              </p>
            </div>

            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-eve-border/40 bg-eve-dark/80 text-eve-muted transition-colors',
                theme.chevron
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        </div>
      </button>

      <Button
        variant="ghost"
        size="icon"
        title={t('common.delete')}
        onClick={(e) => {
          e.stopPropagation()
          setShowDeleteConfirm(true)
        }}
        className="absolute -right-1 -top-1 z-10 h-7 w-7 rounded-sm border border-eve-border/50 bg-eve-panel text-eve-muted opacity-0 shadow-md transition-opacity hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 group-hover/history:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md rounded-sm border border-eve-border bg-eve-panel p-0">
          <div className="border-b border-eve-border/40 p-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-sm font-semibold text-eve-text">
                <div className="rounded-sm border border-rose-500/30 bg-rose-500/10 p-2">
                  <ShieldAlert className="h-4 w-4 text-rose-400" />
                </div>
                {t('common.deleteConfirmTitle')}
              </DialogTitle>
              <DialogDescription className="pt-3 text-xs leading-relaxed text-eve-muted">
                {t('common.deleteConfirmDesc')}
              </DialogDescription>
            </DialogHeader>
          </div>
          <DialogFooter className="flex gap-2 border-t border-eve-border/30 p-4 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 rounded-sm border-eve-border sm:flex-none"
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete(activity.id)
                setShowDeleteConfirm(false)
              }}
              className="flex-1 rounded-sm sm:flex-none"
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export const ActivityHistoryItem = memo(ActivityHistoryItemComponent)
