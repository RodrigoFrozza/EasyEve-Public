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
import { AddExplorationLootModal, ConfirmEndModal, SiteSafetyModal, ExplorationLogDetailsModal } from '../modals'
import { ActivityAnalyticsDialog } from '../analytics/ActivityAnalyticsDialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useActivityStore } from '@/lib/stores/activity-store'
import { cn, formatISK, formatCurrencyValue } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  TrendingUp,
  TrendingDown,
  Activity as ActivityIcon,
  Trash2,
  Shield,
  Package,
  Clock3,
  MapPin,
} from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'
import { toast } from 'sonner'
import { recalcExplorationLootTotalsFromLogs } from '@/lib/activities/exploration-data-recalc'

interface ExplorationActivityContentProps {
  activity: any
  onSync: () => void
  isSyncing: boolean
  syncStatus: 'idle' | 'success' | 'error'
  displayMode?: 'compact' | 'tabs' | 'expanded'
  onEnd?: () => void
  isPaused?: boolean
  onTogglePause?: () => void
}

/** Stable key for discovery logs; legacy rows without refId use date + site + value. */
function getExplorationLogKey(log: {
  refId?: string
  date?: string
  siteName?: string
  value?: number
  amount?: number
}): string {
  if (log.refId) return log.refId
  return `${log.date ?? ''}-${log.siteName ?? ''}-${log.value ?? log.amount ?? 0}`
}

function isDeletableExplorationLog(type: string): boolean {
  return type === 'site' || type === 'loot'
}

export function ExplorationActivityContent({
  activity,
  onSync,
  isSyncing,
  syncStatus,
  displayMode = 'compact',
  onEnd,
  isPaused,
  onTogglePause,
}: ExplorationActivityContentProps) {
  const [lootModalOpen, setLootModalOpen] = useState(false)
  const [confirmEndOpen, setConfirmEndOpen] = useState(false)
  const [safetyModalOpen, setSafetyModalOpen] = useState(false)
  const [analyticsModalOpen, setAnalyticsModalOpen] = useState(false)
  const [logDetailsOpen, setLogDetailsOpen] = useState(false)
  const [selectedLog, setSelectedLog] = useState<any>(null)
  const [localIsSyncing, setLocalIsSyncing] = useState(false)
  const { t } = useTranslations()
  const { metrics, isMounted } = useActivityMetrics(activity)

  const theme = useMemo(() => getActivityTheme('exploration'), [])

  const logs = useMemo(() => activity.data?.logs || [], [activity.data])
  const incomeHistory = useMemo(() => activity.data?.incomeHistory || [], [activity.data])
  const iskTrend = activity.data?.iskTrend || 'stable'

  const TrendIcon = iskTrend === 'up' ? TrendingUp : iskTrend === 'down' ? TrendingDown : ActivityIcon
  const trendColor =
    iskTrend === 'up' ? 'text-green-400' : iskTrend === 'down' ? 'text-red-400' : 'text-zinc-500'

  const discoveryCount = useMemo(
    () => (logs || []).filter((l: any) => l.type === 'site' || l.type === 'loot').length,
    [logs]
  )

  const handleOpenLogDetails = (log: any) => {
    setSelectedLog(log)
    setLogDetailsOpen(true)
  }

  const handleDeleteLog = async (logKey: string) => {
    const updatedLogs = logs.filter((log: any) => getExplorationLogKey(log) !== logKey)
    const totals = recalcExplorationLootTotalsFromLogs(updatedLogs)

    const updatedData = {
      ...activity.data,
      logs: updatedLogs,
      ...totals,
    }

    useActivityStore.getState().updateActivity(activity.id, { data: updatedData })

    setLocalIsSyncing(true)
    try {
      const deletedRefIds = logs
        .filter((log: any) => getExplorationLogKey(log) === logKey && log.refId != null)
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
      toast.success(t('activity.exploration.discoveryRemoved'))
    } catch (err) {
      console.error('Failed to delete log:', err)
      toast.error(t('activity.exploration.discoveryDeleteFailed'))
    } finally {
      setLocalIsSyncing(false)
    }
  }

  const confirmDeleteLog = (log: any) => {
    const logKey = getExplorationLogKey(log)
    toast(t('common.deleteConfirmTitle'), {
      description: t('common.deleteConfirmDesc'),
      action: {
        label: t('common.delete'),
        onClick: () => void handleDeleteLog(logKey),
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
      toast.info(t('activity.exploration.exportNoDiscoveries'))
      return
    }

    const headers = [
      t('activity.exploration.exportCsvDate'),
      t('activity.exploration.exportCsvType'),
      t('activity.exploration.exportCsvAmount'),
    ]
    const csvRows = [headers.join(',')]

    logs.forEach((log: any) => {
      const dateStr = new Date(log.date).toISOString().replace(/T/, ' ').replace(/\..+/, '')
      const type = log.type || t('activity.exploration.loot')
      const amount = Math.round(log.amount || log.value || 0)
      csvRows.push(`${dateStr},${type},${amount}`)
    })

    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `exploration_export_${activity.id}_${new Date().getTime()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const top3Rewards = useMemo(() => {
    const validLogs = (logs || []).filter((l: any) => l.type === 'site' || l.type === 'loot')
    return validLogs
      .sort((a: any, b: any) => {
        const dateA = new Date(a.date).getTime()
        const dateB = new Date(b.date).getTime()
        return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA)
      })
      .slice(0, 3)
  }, [logs])

  const sortedLogs = useMemo(
    () =>
      [...(logs || [])].sort(
        (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    [logs]
  )

  if (!isMounted) return null

  const tooltipClass =
    'rounded-lg border border-orange-400/25 bg-[#0c141c]/95 text-xs text-orange-100'

  const headerActionClass = cn(
    'h-9 w-9 rounded-lg border backdrop-blur-sm transition-colors',
    'border-orange-400/30 bg-orange-500/15 text-orange-200/90',
    'hover:border-orange-400/50 hover:bg-orange-500/25 hover:text-orange-100'
  )

  const metricCardShell = cn(
    theme.metricShell,
    'hover:border-orange-400/45 hover:bg-orange-500/[0.14]'
  )

  const statProps = {
    size: 'compact' as const,
    variant: 'default' as const,
    labelClassName: theme.textMuted,
    subValueClassName: theme.textMuted,
    valueClassName: theme.text,
  }

  const currentSystem = activity.data?.currentSystem || activity.region
  const unknownLocationSentinel = 'Unknown Location'
  const hasKnownLocation = Boolean(
    currentSystem && currentSystem !== unknownLocationSentinel
  )
  const totalLoot = activity.data?.totalLootValue || 0

  const locationSub = hasKnownLocation
    ? activity.data?.currentSpaceType || activity.space || t('activity.exploration.exploring')
    : t('activity.exploration.awaitingLocation')

  const itemsSub =
    discoveryCount === 0
      ? t('activity.exploration.registerDiscoveryHint')
      : t('activity.exploration.totalItems')

  const lootSub =
    totalLoot === 0 ? t('activity.exploration.registerLootHint') : t('activity.exploration.sublabelIsk')

  const iskHourSub =
    metrics.iskPerHour === 0
      ? t('activity.exploration.metricsAwaiting')
      : t('activity.exploration.sublabelIskPerHour')

  const logEmptyHint = t('activity.exploration.logEmptyHint')

  const showTrendIcon = incomeHistory.length >= 2 && iskTrend !== 'stable'
  const logHeaderExtra = showTrendIcon ? (
    <TrendIcon className={cn('h-3 w-3 shrink-0', trendColor)} />
  ) : undefined

  const logLabel = (log: any) =>
    log.siteName || log.charName || t('activity.exploration.discoveryValueFallback')

  const renderDiscoveryRow = (log: any, compact: boolean) => {
    const rowKey = getExplorationLogKey(log)
    const canDelete = isDeletableExplorationLog(String(log.type))

    if (compact) {
      return (
        <div
          key={rowKey}
          className="group/row flex items-stretch gap-0.5"
        >
          <button
            type="button"
            onClick={() => handleOpenLogDetails(log)}
            className={cn(
              'flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 rounded-md border border-transparent p-2 text-left transition-colors',
              'hover:border-orange-500/25 hover:bg-orange-500/[0.06]'
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  log.type === 'site' ? 'bg-orange-400' : 'bg-emerald-500'
                )}
              />
              <div className="min-w-0">
                <p className="truncate font-mono text-[10px] font-bold uppercase tracking-wider text-orange-100/90">
                  {logLabel(log)}
                </p>
                <p className={cn('text-[9px] uppercase tracking-wide', theme.textMuted)}>
                  {log.spaceType ? `${log.spaceType} · ` : ''}
                  <FormattedDate date={log.date} mode="time" />
                </p>
              </div>
            </div>
            <p className="shrink-0 font-mono text-[10px] font-black tabular-nums text-orange-300">
              {formatCurrencyValue(log.amount || log.value || 0)}
            </p>
          </button>
          {canDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 self-center text-orange-300/35 opacity-0 transition-opacity hover:bg-red-500/15 hover:text-red-300 group-hover/row:opacity-100"
              onClick={() => confirmDeleteLog(log)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      )
    }

    return (
      <div key={rowKey} className="group/item flex items-stretch gap-0.5">
        <button
          type="button"
          onClick={() => handleOpenLogDetails(log)}
          className={cn(
            'flex min-w-0 flex-1 cursor-pointer items-center justify-between rounded-md border border-white/[0.06] bg-white/[0.02] p-3 text-left text-[11px] transition-colors',
            'hover:border-orange-500/25 hover:bg-orange-500/[0.06]'
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                'h-2 w-2 shrink-0 rounded-full',
                log.type === 'site' ? 'bg-orange-400' : 'bg-emerald-500'
              )}
            />
            <div className="min-w-0 flex flex-col">
              <span className="max-w-[180px] truncate font-mono text-[10px] font-bold uppercase text-orange-100/90">
                {logLabel(log)}
              </span>
              <div className={cn('mt-0.5 font-mono text-[9px] uppercase', theme.textMuted)}>
                {log.spaceType ? `${log.spaceType} // ` : ''}
                <FormattedDate date={log.date} mode="time" />
              </div>
            </div>
          </div>
          <span className="shrink-0 font-mono text-xs font-black tabular-nums text-orange-300">
            +{formatISK(log.amount || log.value || 0)}
          </span>
        </button>
        {canDelete ? (
          <button
            type="button"
            onClick={() => confirmDeleteLog(log)}
            className="self-center rounded-lg p-1.5 text-orange-300/35 opacity-0 transition-opacity hover:bg-red-500/15 hover:text-red-300 group-hover/item:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    )
  }

  const participantsRow = (
    <ActivityParticipantsRow>
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2 hover:space-x-1 transition-all duration-500">
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
              onClick={() => setSafetyModalOpen(true)}
            >
              <Shield className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent
            className={cn(
              tooltipClass,
              'text-[10px] font-bold uppercase tracking-wide'
            )}
          >
            {t('activity.exploration.checkSiteSafety')}
          </TooltipContent>
        </Tooltip>

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
            {t('activity.exploration.addSiteLoot')}
          </TooltipContent>
        </Tooltip>
      </div>
    </ActivityParticipantsRow>
  )

  const metricsGrid = (
    <ActivityMetricsGrid>
      <ActivityStatDisplay
        {...statProps}
        label={t('activity.exploration.actualLocation')}
        value={hasKnownLocation ? currentSystem : t('activity.exploration.awaitingLocation')}
        subValue={locationSub}
        icon={<MapPin className={cn('h-3 w-3', theme.text)} />}
        className={metricCardShell}
      />

      <ActivityStatDisplay
        {...statProps}
        label={t('activity.exploration.itemsFound')}
        value={discoveryCount}
        subValue={itemsSub}
        formatAsNumber
        icon={<Package className={cn('h-3 w-3', theme.text)} />}
        className={metricCardShell}
      />

      <ActivityStatDisplay
        {...statProps}
        label={t('activity.exploration.lootValue')}
        value={totalLoot}
        subValue={lootSub}
        formatAsCompactISK
        icon={<TrendingUp className={cn('h-3 w-3', theme.text)} />}
        className={metricCardShell}
      />

      <ActivityStatDisplay
        {...statProps}
        label={t('activity.exploration.efficiency')}
        value={metrics.iskPerHour}
        subValue={iskHourSub}
        formatAsCompactISK
        icon={<Clock3 className={cn('h-3 w-3', theme.text)} />}
        className={cn(metricCardShell, 'cursor-pointer hover:border-orange-400/50')}
        title={t('activity.analytics.viewIndicators')}
        onClick={() => setAnalyticsModalOpen(true)}
      />
    </ActivityMetricsGrid>
  )

  const latestLootSection = (
    <ActivityLogPanel
      theme={theme}
      logName={t('activity.exploration.discoveryHistory')}
      emptyMessage={t('activity.exploration.noDiscoveriesYet')}
      emptyHint={logEmptyHint}
      emptyDensity="compact"
      isEmpty={top3Rewards.length === 0}
      headerExtra={logHeaderExtra}
    >
      <div className="space-y-1">
        {top3Rewards.map((log: any) => renderDiscoveryRow(log, true))}
      </div>
    </ActivityLogPanel>
  )

  const expandedStats = (
    <ActivityLogPanel
      theme={theme}
      logName={t('activity.exploration.discoveryHistory')}
      emptyMessage={t('activity.exploration.noDiscoveriesLogged')}
      emptyHint={logEmptyHint}
      isEmpty={sortedLogs.length === 0}
      headerExtra={logHeaderExtra}
    >
      <div className="space-y-1">
        {sortedLogs.slice(0, 30).map((log: any) => renderDiscoveryRow(log, false))}
      </div>
    </ActivityLogPanel>
  )

  const explorationModals = (
    <>
      <AddExplorationLootModal
        open={lootModalOpen}
        onOpenChange={setLootModalOpen}
        activity={activity}
      />

      <ConfirmEndModal
        open={confirmEndOpen}
        onOpenChange={setConfirmEndOpen}
        onConfirm={handleConfirmEnd}
      />

      <SiteSafetyModal open={safetyModalOpen} onOpenChange={setSafetyModalOpen} />

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
    activityType: 'exploration' as const,
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

        {explorationModals}
      </ActivityCardBody>
    )
  }

  return (
    <ActivityCardBody className="animate-in fade-in duration-500">
      {participantsRow}
      {metricsGrid}
      <ActivityCardMainSlot>{expandedStats}</ActivityCardMainSlot>

      <ActivityCardFooter {...footerProps} mode="expanded" />

      {explorationModals}
    </ActivityCardBody>
  )
}
