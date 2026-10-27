'use client'

import { useState, useMemo } from 'react'
import { useActivityMetrics } from '@/lib/hooks/use-activity-metrics'
import { ActivityStatDisplay } from '../shared/ActivityStatDisplay'
import { getActivityTheme } from '@/lib/activity/activity-theme'
import { ActivityLogPanel } from '../shared/ActivityThemedPanel'
import {
  ActivityCardBody,
  ActivityCardMainSlot,
  ActivityMetricsGrid,
  ActivityParticipantsRow,
} from '../shared/activity-card-layout'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { ActivityCardFooter } from '../shared/ActivityCardFooter'
import {
  AddSalvagingLootModal,
  ConfirmEndModal,
  ExplorationLogDetailsModal,
  ActivityAnalyticsDialog,
} from '../modals'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useActivityStore } from '@/lib/stores/activity-store'
import {
  getSalvagingBatchCount,
  getSalvagingItemCount,
} from '@/lib/activities/session-kpis'
import { recalcSalvagingLootTotalsFromLogs } from '@/lib/activities/salvaging-data-recalc'
import { cn, formatISK, formatCurrencyValue } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { getSalvagingNpcFaction } from '@/lib/constants/activity-data'
import { TrendingUp, Package, Clock3, Target, Trash2 } from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'
import { toast } from 'sonner'

interface SalvagingActivityContentProps {
  activity: any
  onSync: () => void
  isSyncing: boolean
  syncStatus: 'idle' | 'success' | 'error'
  displayMode?: 'compact' | 'tabs' | 'expanded'
  onEnd?: () => void
  isPaused?: boolean
  onTogglePause?: () => void
}

function isSalvagingLootLogType(type?: string) {
  return type === 'salvage' || type === 'loot-auto'
}

function logKey(log: { refId?: string; date?: string; value?: number; type?: string }) {
  if (log.refId) return log.refId
  return `${log.type}-${log.date}-${log.value ?? 0}`
}

export function SalvagingActivityContent({
  activity,
  onSync,
  isSyncing,
  syncStatus,
  displayMode = 'compact',
  onEnd,
  isPaused,
  onTogglePause,
}: SalvagingActivityContentProps) {
  const [lootModalOpen, setLootModalOpen] = useState(false)
  const [confirmEndOpen, setConfirmEndOpen] = useState(false)
  const [analyticsModalOpen, setAnalyticsModalOpen] = useState(false)
  const [logDetailsOpen, setLogDetailsOpen] = useState(false)
  const [selectedLog, setSelectedLog] = useState<any>(null)
  const [localIsSyncing, setLocalIsSyncing] = useState(false)
  const { t } = useTranslations()
  const { metrics, isMounted } = useActivityMetrics(activity)

  const theme = useMemo(() => getActivityTheme(activity.type), [activity.type])

  const logs = useMemo(() => activity.data?.logs || [], [activity.data])

  const batchCount = useMemo(() => getSalvagingBatchCount(logs), [logs])
  const itemCount = useMemo(() => getSalvagingItemCount(logs), [logs])

  const handleOpenLogDetails = (log: any) => {
    setSelectedLog({ ...log, siteName: log.label || log.siteName })
    setLogDetailsOpen(true)
  }

  const handleDeleteLog = async (key: string) => {
    const updatedLogs = logs.filter((log: any) => logKey(log) !== key)
    const totals = recalcSalvagingLootTotalsFromLogs(updatedLogs)

    const updatedData = {
      ...activity.data,
      logs: updatedLogs,
      ...totals,
    }

    useActivityStore.getState().updateActivity(activity.id, { data: updatedData })

    setLocalIsSyncing(true)
    try {
      const deletedRefIds = logs
        .filter((log: any) => logKey(log) === key && log.refId != null)
        .map((log: any) => String(log.refId))

      const res = await fetch(`/api/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: updatedData, deletedLogRefIds: deletedRefIds }),
      })
      if (!res.ok) throw new Error('Failed to persist')
      const saved = await res.json()
      if (saved?.data) {
        useActivityStore.getState().updateActivity(activity.id, { data: saved.data })
      }
      toast.success(t('activity.salvaging.batchRemoved'))
    } catch (err) {
      console.error('Failed to delete log:', err)
      toast.error(t('activity.salvaging.batchDeleteFailed'))
    } finally {
      setLocalIsSyncing(false)
    }
  }

  const confirmDeleteLog = (key: string) => {
    toast(t('common.deleteConfirmTitle'), {
      description: t('common.deleteConfirmDesc'),
      action: {
        label: t('common.delete'),
        onClick: () => void handleDeleteLog(key),
      },
      cancel: {
        label: t('common.cancel'),
        onClick: () => {},
      },
      duration: 8000,
    })
  }

  const handleConfirmEnd = () => {
    setConfirmEndOpen(false)
    onEnd?.()
  }

  const handleExport = () => {
    if ((logs || []).length === 0) {
      toast.info(t('activity.salvaging.exportNoBatches'))
      return
    }

    const headers = ['Date', 'Label', 'Value (ISK)']
    const csvRows = [headers.join(',')]

    logs.forEach((log: any) => {
      const dateStr = new Date(log.date).toISOString().replace(/T/, ' ').replace(/\..+/, '')
      const label = (log.label || 'Salvage').replace(/,/g, ';')
      const amount = Math.round(log.value || 0)
      csvRows.push(`${dateStr},${label},${amount}`)
    })

    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `salvaging_export_${activity.id}_${Date.now()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const top3Batches = useMemo(() => {
    const validLogs = (logs || []).filter((l: any) => isSalvagingLootLogType(l.type))
    return validLogs
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3)
  }, [logs])

  const sortedLogs = useMemo(
    () =>
      [...(logs || [])]
        .filter((l: any) => isSalvagingLootLogType(l.type))
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [logs]
  )

  if (!isMounted) return null

  const tooltipClass = cn(
    'rounded-lg border bg-[#0c141c]/95 text-xs',
    'border-lime-400/25 text-lime-100'
  )

  const headerActionClass = cn(
    'h-9 w-9 rounded-lg border backdrop-blur-sm transition-colors',
    'border-lime-400/30 bg-lime-500/15 text-lime-200/90',
    'hover:border-lime-400/50 hover:bg-lime-500/25 hover:text-lime-100'
  )

  const metricCardShell = cn(
    theme.metricShell,
    'hover:border-lime-400/45 hover:bg-lime-500/[0.14]'
  )

  const statProps = {
    size: 'compact' as const,
    variant: 'default' as const,
    labelClassName: theme.textMuted,
    subValueClassName: theme.textMuted,
    valueClassName: theme.text,
  }

  const totalLoot = activity.data?.totalLootValue || 0
  const factionLabel = getSalvagingNpcFaction(activity) || t('activity.unassigned')

  const itemsSub =
    itemCount === 0
      ? t('activity.salvaging.registerBatchHint')
      : t('activity.salvaging.totalItems')

  const lootSub = totalLoot === 0 ? t('activity.salvaging.registerLootHint') : 'isk'

  const iskHourSub =
    metrics.iskPerHour === 0 ? t('activity.salvaging.metricsAwaiting') : 'isk/h'

  const logEmptyHint = t('activity.salvaging.logEmptyHint')

  const logLabel = (log: any) =>
    log.label || t('activity.salvaging.batchValueFallback')

  const renderBatchRow = (log: any, compact: boolean) => {
    const key = logKey(log)

    if (compact) {
      return (
        <div key={key} className="group/row flex items-stretch gap-0.5">
          <button
            type="button"
            onClick={() => handleOpenLogDetails(log)}
            className={cn(
              'flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 rounded-md border border-transparent p-2 text-left transition-colors',
              'hover:border-lime-500/25 hover:bg-lime-500/[0.06]'
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-lime-400" />
              <div className="min-w-0">
                <p className="truncate font-mono text-[10px] font-bold uppercase tracking-wider text-lime-100/90">
                  {logLabel(log)}
                </p>
                <p className={cn('text-[9px] uppercase tracking-wide', theme.textMuted)}>
                  {log.spaceType ? `${log.spaceType} · ` : ''}
                  <FormattedDate date={log.date} mode="time" />
                </p>
              </div>
            </div>
            <p className="shrink-0 font-mono text-[10px] font-black tabular-nums text-lime-300">
              {formatCurrencyValue(log.value || 0)}
            </p>
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 self-center text-lime-300/35 opacity-0 transition-opacity hover:bg-red-500/15 hover:text-red-300 group-hover/row:opacity-100"
            onClick={() => confirmDeleteLog(key)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )
    }

    return (
      <div
        key={key}
        className="group/item flex cursor-pointer items-center justify-between rounded-md border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] transition-colors hover:border-lime-500/25 hover:bg-lime-500/[0.06]"
        onClick={() => handleOpenLogDetails(log)}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="h-2 w-2 shrink-0 rounded-full bg-lime-400" />
          <div className="min-w-0 flex flex-col">
            <span className="max-w-[180px] truncate font-mono text-[10px] font-bold uppercase text-lime-100/90">
              {logLabel(log)}
            </span>
            <div className={cn('mt-0.5 font-mono text-[9px] uppercase', theme.textMuted)}>
              {log.spaceType ? `${log.spaceType} // ` : ''}
              <FormattedDate date={log.date} mode="time" />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="font-mono text-xs font-black tabular-nums text-lime-300">
            +{formatISK(log.value || 0)}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              confirmDeleteLog(key)
            }}
            className="rounded-lg p-1.5 text-lime-300/35 opacity-0 transition-opacity hover:bg-red-500/15 hover:text-red-300 group-hover/item:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  const participantsRow = (
    <ActivityParticipantsRow>
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2 transition-all duration-500 hover:space-x-1">
          {(activity.participants || []).map((participant: any) => (
            <Tooltip key={participant.characterId}>
              <TooltipTrigger asChild>
                <Avatar
                  className={cn(
                    'h-9 w-9 rounded-lg ring-1 ring-white/10 transition-none',
                    theme.iconBg
                  )}
                >
                  <AvatarImage
                    src={`https://images.evetech.net/characters/${participant.characterId}/portrait?size=64`}
                    className="rounded-lg"
                  />
                  <AvatarFallback className="rounded-lg">
                    {participant.characterName?.[0] || 'C'}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent className={tooltipClass}>{participant.characterName}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        <div className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={headerActionClass}
              onClick={() => setLootModalOpen(true)}
            >
              <Package className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent
            className={cn(
              tooltipClass,
              'text-[10px] font-bold uppercase tracking-wide'
            )}
          >
            {t('activity.salvaging.addLoot')}
          </TooltipContent>
        </Tooltip>
      </div>
    </ActivityParticipantsRow>
  )

  const metricsGrid = (
    <ActivityMetricsGrid>
      <ActivityStatDisplay
        {...statProps}
        label={t('activity.salvaging.npcFaction')}
        value={factionLabel}
        subValue={t('activity.salvaging.activeSalvaging')}
        icon={<Target className={cn('h-3 w-3', theme.text)} />}
        className={metricCardShell}
      />

      <ActivityStatDisplay
        {...statProps}
        label={t('activity.salvaging.batchesCompleted')}
        value={batchCount}
        subValue={itemsSub}
        formatAsNumber
        icon={<Package className={cn('h-3 w-3', theme.text)} />}
        className={metricCardShell}
      />

      <ActivityStatDisplay
        {...statProps}
        label={t('activity.salvaging.lootValue')}
        value={totalLoot}
        subValue={lootSub}
        formatAsCompactISK
        icon={<TrendingUp className={cn('h-3 w-3', theme.text)} />}
        className={metricCardShell}
      />

      <ActivityStatDisplay
        {...statProps}
        label={t('activity.salvaging.efficiency')}
        value={metrics.iskPerHour}
        subValue={iskHourSub}
        formatAsCompactISK
        icon={<Clock3 className={cn('h-3 w-3', theme.text)} />}
        className={cn(metricCardShell, 'cursor-pointer hover:border-lime-400/50')}
        title={t('activity.analytics.viewIndicators')}
        onClick={() => setAnalyticsModalOpen(true)}
      />
    </ActivityMetricsGrid>
  )

  const latestLootSection = (
    <ActivityLogPanel
      theme={theme}
      logName={t('activity.salvaging.batchHistory')}
      emptyMessage={t('activity.salvaging.noBatchesYet')}
      emptyHint={logEmptyHint}
      emptyDensity="compact"
      isEmpty={top3Batches.length === 0}
    >
      <div className="space-y-1">
        {top3Batches.map((log: any) => renderBatchRow(log, true))}
      </div>
    </ActivityLogPanel>
  )

  const expandedStats = (
    <ActivityLogPanel
      theme={theme}
      logName={t('activity.salvaging.batchHistory')}
      emptyMessage={t('activity.salvaging.noBatchesLogged')}
      emptyHint={logEmptyHint}
      isEmpty={sortedLogs.length === 0}
    >
      <div className="space-y-1">
        {sortedLogs.slice(0, 30).map((log: any) => renderBatchRow(log, false))}
      </div>
    </ActivityLogPanel>
  )

  const salvagingModals = (
    <>
      <AddSalvagingLootModal
        open={lootModalOpen}
        onOpenChange={setLootModalOpen}
        activity={activity}
      />

      <ConfirmEndModal
        open={confirmEndOpen}
        onOpenChange={setConfirmEndOpen}
        onConfirm={handleConfirmEnd}
      />

      <ActivityAnalyticsDialog
        open={analyticsModalOpen}
        onOpenChange={setAnalyticsModalOpen}
        activity={activity}
      />

      <ExplorationLogDetailsModal
        open={logDetailsOpen}
        onOpenChange={setLogDetailsOpen}
        log={selectedLog}
      />
    </>
  )

  const footerProps = {
    activityType: 'salvaging' as const,
    onSync,
    isSyncing: isSyncing || localIsSyncing,
    syncStatus,
    onTogglePause: onTogglePause!,
    isPaused: isPaused!,
    onExport: handleExport,
    onEnd: () => setConfirmEndOpen(true),
  }

  if (displayMode === 'compact') {
    return (
      <ActivityCardBody className="animate-in fade-in duration-500">
        {participantsRow}
        {metricsGrid}
        <ActivityCardMainSlot>{latestLootSection}</ActivityCardMainSlot>

        <ActivityCardFooter {...footerProps} mode="compact" />

        {salvagingModals}
      </ActivityCardBody>
    )
  }

  return (
    <ActivityCardBody className="animate-in fade-in duration-500">
      {participantsRow}
      {metricsGrid}
      <ActivityCardMainSlot>{expandedStats}</ActivityCardMainSlot>

      <ActivityCardFooter {...footerProps} mode="expanded" />

      {salvagingModals}
    </ActivityCardBody>
  )
}
