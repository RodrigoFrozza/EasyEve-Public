'use client'

import { useMemo, useState, useCallback } from 'react'
import { ActivityStatDisplay } from '../shared/ActivityStatDisplay'
import { ActivityLogPanel } from '../shared/ActivityThemedPanel'
import {
  ActivityCardBody,
  ActivityCardMainSlot,
  ActivityMetricsGrid,
  ActivityParticipantsRow,
} from '../shared/activity-card-layout'
import { useTranslations } from '@/i18n/hooks'
import { cn, formatISK, formatCurrencyValue } from '@/lib/utils'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { ActivityCardFooter } from '../shared/ActivityCardFooter'
import { ConfirmEndModal, RattingLootHistoryModal, RattingEscalationModal, RattingExpensesModal } from '../modals'
import { ActivityAnalyticsDialog } from '../analytics/ActivityAnalyticsDialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Banknote, Clock3, Crosshair, Package, AlertTriangle, TrendingDown, Wallet } from 'lucide-react'
import { useActivityMetrics } from '@/lib/hooks/use-activity-metrics'
import { getActivityTheme } from '@/lib/activity/activity-theme'
import { toast } from 'sonner'
import { useActivityStore, type Activity } from '@/lib/stores/activity-store'
import type {
  RattingActivityData,
  RattingEscalationDrop,
  RattingExpenseEntry,
} from '@/lib/activities/ratting-manual-entries'
import { dedupeEscalationDrops, dedupeRattingExpenses } from '@/lib/activities/ratting-manual-entries'
import { buildRattingLogsCsv, type RattingCsvLog } from '@/lib/activities/ratting-csv-export'
import {
  RattingLogIcon,
  RATTING_LOG_TYPE_STYLES,
  rattingLogTypeKey,
} from '../shared/ratting-log-icon'

interface RattingActivityContentProps {
  activity: Activity
  onSync: () => void
  isSyncing: boolean
  syncStatus: 'idle' | 'success' | 'error'
  essCountdown?: string
  displayMode?: 'compact' | 'expanded'
  onEnd?: () => void
  isPaused?: boolean
  onTogglePause?: () => void
}

const RATTING_TRANSACTION_LOG_TYPES = [
  'bounty',
  'ess',
  'loot',
  'loot-auto',
  'salvage',
  'mtu',
  'escalation',
  'expense',
] as const

export function RattingActivityContentV2({
  activity,
  onSync,
  isSyncing,
  syncStatus,
  essCountdown,
  displayMode = 'compact',
  onEnd,
  isPaused,
  onTogglePause,
}: RattingActivityContentProps) {
  const { t } = useTranslations()
  const [lootListOpen, setLootListOpen] = useState(false)
  const [escalationModalOpen, setEscalationModalOpen] = useState(false)
  const [expensesModalOpen, setExpensesModalOpen] = useState(false)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [confirmEndOpen, setConfirmEndOpen] = useState(false)
  const { metrics, isMounted } = useActivityMetrics(activity)
  const theme = useMemo(() => getActivityTheme('ratting'), [])

  const logs = useMemo(() => (activity.data as any)?.logs || [], [activity.data])
  const automatedBounties = activity.data?.automatedBounties || 0
  const additionalBounties = activity.data?.additionalBounties || 0
  const automatedEss = activity.data?.automatedEss || 0
  const totalLoot =
    (activity.data?.estimatedLootValue || 0) + (activity.data?.estimatedSalvageValue || 0)
  const escalationDrops = dedupeEscalationDrops(
    ((activity.data as RattingActivityData)?.escalationDrops || []) as RattingEscalationDrop[]
  )
  const escalationSoldTotal = Number((activity.data as RattingActivityData)?.estimatedEscalationValue) || 0
  const escalationPendingCount = escalationDrops.filter((d) => d.status === 'dropped').length
  const sessionExpenses = dedupeRattingExpenses(
    ((activity.data as RattingActivityData)?.sessionExpenses || []) as RattingExpenseEntry[]
  )
  const totalExpenses = Number((activity.data as RattingActivityData)?.estimatedExpenseValue) || 0
  const mtuContents = useMemo(() => activity.data?.mtuContents || [], [activity.data])
  const salvageContents = useMemo(() => activity.data?.salvageContents || [], [activity.data])
  const lootItemCount = mtuContents.length + salvageContents.length
  const totalBounty = automatedBounties + additionalBounties
  const lastSyncAt = (activity.data as any)?.lastSyncAt as string | undefined
  const lastSyncWithChangesAt = (activity.data as any)?.lastSyncWithChangesAt as string | undefined
  const syncCount = (activity.data as any)?.syncCount || 0
  const syncErrors = ((activity.data as any)?.syncErrors || []) as Array<{
    characterId: number
    characterName: string
    error: string
  }>

  const getIncomeMetricSubValue = useCallback(
    (hasIncome: boolean) => {
      if (hasIncome) return t('activity.ratting.sublabelIsk')
      if (syncErrors.length > 0) return t('activity.ratting.metricsSyncFailed')
      if (lastSyncAt && !lastSyncWithChangesAt) return t('activity.ratting.metricsNoBountyYet')
      if (!lastSyncAt) return t('activity.ratting.metricsSyncPending')
      return t('activity.ratting.metricsNoBountyYet')
    },
    [lastSyncAt, lastSyncWithChangesAt, syncErrors.length, t]
  )

  const top3Rewards = useMemo(
    () =>
      [...logs]
        .filter((l: any) => RATTING_TRANSACTION_LOG_TYPES.includes(l.type))
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 3),
    [logs]
  )

  const transactionLogs = useMemo(
    () =>
      [...(logs || [])]
        .filter((l: any) => RATTING_TRANSACTION_LOG_TYPES.includes(l.type))
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [logs]
  )

  const handleExport = useCallback(() => {
    if (logs.length === 0) {
      toast.info(t('activity.ratting.exportNoLogs'))
      return
    }
    const csv = buildRattingLogsCsv(logs as RattingCsvLog[], {
      date: t('common.date') || 'Date',
      character: t('common.character') || 'Character',
      type: t('common.type') || 'Type',
      amount: t('common.amount') || 'Amount (ISK)',
      unknown: t('common.unknown') || 'Unknown',
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `ratting_export_${activity.id}_${Date.now()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [activity.id, logs, t])

  const metricCardShell = cn(
    theme.metricShell,
    'min-h-[4.75rem] px-3.5 py-3 hover:border-red-400/45 hover:bg-red-500/[0.14]'
  )

  const statProps = {
    size: 'comfortable' as const,
    valueTypography: 'numeric' as const,
    variant: 'default' as const,
    labelClassName: cn(theme.textMuted, 'opacity-95'),
    subValueClassName: cn(theme.textMuted, 'opacity-90'),
    valueClassName: cn(theme.text, 'text-white'),
  }

  const totalNetIsk = metrics.netProfit
  const totalGrossIsk = metrics.totalRevenue
  const grossIskPerHour = useMemo(() => {
    const hours = metrics.elapsedMs / 3600000
    if (hours < 0.001) return 0
    return totalGrossIsk / hours
  }, [totalGrossIsk, metrics.elapsedMs])
  const totalIskSubValue =
    totalExpenses > 0
      ? t('activity.ratting.totalIskBreakdown', {
          gross: formatISK(totalGrossIsk),
          expenses: formatISK(totalExpenses),
        })
      : totalNetIsk > 0
        ? t('activity.ratting.sublabelIsk')
        : getIncomeMetricSubValue(false)

  const bountySubValue =
    additionalBounties > 0
      ? `+${formatISK(additionalBounties)} ${t('activity.ratting.registered')}`
      : getIncomeMetricSubValue(totalBounty > 0)

  const essSubValue =
    essCountdown || getIncomeMetricSubValue(automatedEss > 0)

  const lootSubValue =
    lootItemCount > 0
      ? t('activity.ratting.lootItemCount', { count: lootItemCount })
      : totalLoot === 0
        ? t('activity.ratting.lootTapToRegister')
        : t('activity.ratting.sublabelIsk')

  const openLootModal = () => setLootListOpen(true)
  const openEscalationModal = () => setEscalationModalOpen(true)
  const openExpensesModal = () => setExpensesModalOpen(true)

  const escalationSubValue =
    escalationDrops.length === 0
      ? t('activity.ratting.escalations.tapToRegister')
      : escalationPendingCount > 0
        ? t('activity.ratting.escalations.indicatorPending', {
            count: escalationDrops.length,
            pending: escalationPendingCount,
          })
        : t('activity.ratting.escalations.indicatorSold', { value: formatISK(escalationSoldTotal) })

  const expensesSubValue =
    sessionExpenses.length === 0
      ? t('activity.ratting.expenses.tapToRegister')
      : t('activity.ratting.expenses.indicatorTotal', {
          count: sessionExpenses.length,
          value: formatISK(totalExpenses),
        })

  const headerActionButtonClass = cn(
    'h-10 w-10 rounded-lg border backdrop-blur-sm transition-colors',
    'border-red-400/30 bg-red-500/12 text-red-100/90',
    'hover:border-red-400/50 hover:bg-red-500/22 hover:text-white'
  )

  const participantsRow = (
    <ActivityParticipantsRow>
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2 hover:space-x-1 transition-all duration-500">
          {(activity.participants || []).map((participant: any) => (
            <Tooltip key={participant.characterId}>
              <TooltipTrigger asChild>
                <Avatar
                  className={cn(
                    'h-10 w-10 rounded-lg ring-1 ring-white/15 transition-none',
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
              <TooltipContent className="rounded-lg border border-red-400/25 bg-[#0c141c]/95 text-xs text-red-100">
                {participant.characterName}
              </TooltipContent>
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
              className={cn(headerActionButtonClass, 'relative')}
              onClick={openEscalationModal}
            >
              <AlertTriangle className="h-4 w-4" />
              {escalationDrops.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
                  {escalationDrops.length}
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent className="rounded-lg border border-orange-400/25 bg-[#0c141c]/95 text-[10px] font-bold uppercase tracking-wide text-orange-100">
            {t('activity.ratting.escalations.title')}
            {escalationDrops.length > 0 ? ` · ${escalationSubValue}` : ''}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn(headerActionButtonClass, 'relative')}
              onClick={openExpensesModal}
            >
              <TrendingDown className="h-4 w-4" />
              {sessionExpenses.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {sessionExpenses.length}
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent className="rounded-lg border border-rose-400/25 bg-[#0c141c]/95 text-[10px] font-bold uppercase tracking-wide text-rose-100">
            {t('activity.ratting.expenses.title')}
            {sessionExpenses.length > 0 ? ` · ${expensesSubValue}` : ''}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={headerActionButtonClass}
              onClick={openLootModal}
            >
              <Package className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="rounded-lg border border-red-400/25 bg-[#0c141c]/95 text-[10px] font-bold uppercase tracking-wide text-red-100">
            {t('activity.ratting.modals.loot.title')}
          </TooltipContent>
        </Tooltip>
      </div>
    </ActivityParticipantsRow>
  )

  const metricsGrid = (
    <div className="flex flex-col gap-2.5">
      <div
        className={cn(
          metricCardShell,
          'grid grid-cols-1 gap-3 border-red-400/40 bg-gradient-to-br from-red-500/18 via-red-950/25 to-black/20 sm:grid-cols-2 sm:gap-4',
          'cursor-pointer hover:border-red-300/55'
        )}
        onClick={() => setAnalyticsOpen(true)}
        title={t('activity.analytics.viewIndicators')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setAnalyticsOpen(true)
        }}
      >
        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className={cn('font-mono text-[11px] font-bold uppercase tracking-wider', theme.textMuted)}>
              {t('activity.ratting.totalIsk')}
            </span>
            <Wallet className={cn('h-4 w-4 shrink-0 opacity-80', theme.text)} />
          </div>
          <p className="font-mono text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl">
            {formatCurrencyValue(totalNetIsk)}
          </p>
          <p className={cn('mt-1.5 font-mono text-[11px] leading-snug', theme.textMuted)}>
            {totalIskSubValue}
          </p>
        </div>
        <div className="min-w-0 border-t border-white/10 pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className={cn('font-mono text-[11px] font-bold uppercase tracking-wider', theme.textMuted)}>
              {t('activity.ratting.efficiency')}
            </span>
            <Clock3 className={cn('h-4 w-4 shrink-0 opacity-80', theme.text)} />
          </div>
          <p className="font-mono text-xl font-bold tabular-nums tracking-tight text-red-50 sm:text-2xl">
            {formatCurrencyValue(metrics.iskPerHour)}
          </p>
          <p className={cn('mt-1.5 font-mono text-[11px]', theme.textMuted)}>
            {metrics.iskPerHour === 0
              ? getIncomeMetricSubValue(false)
              : t('activity.ratting.efficiencyGrossSubValue', { value: formatCurrencyValue(grossIskPerHour) })}
          </p>
        </div>
      </div>

      <ActivityMetricsGrid className="grid-cols-2 gap-2.5 sm:grid-cols-3">
        <ActivityStatDisplay
          {...statProps}
          label={t('activity.ratting.bounty')}
          value={formatCurrencyValue(totalBounty)}
          subValue={bountySubValue}
          icon={<Crosshair className={cn('h-4 w-4', theme.text)} />}
          className={metricCardShell}
        />
        <ActivityStatDisplay
          {...statProps}
          label={t('activity.ratting.ess')}
          value={formatCurrencyValue(automatedEss)}
          subValue={essSubValue}
          icon={<Banknote className={cn('h-4 w-4', theme.text)} />}
          className={metricCardShell}
        />
        <ActivityStatDisplay
          {...statProps}
          label={t('activity.ratting.loot')}
          value={formatCurrencyValue(totalLoot)}
          subValue={lootSubValue}
          icon={<Package className={cn('h-4 w-4', theme.text)} />}
          className={cn(metricCardShell, 'cursor-pointer hover:border-red-400/50')}
          onClick={openLootModal}
        />
        <ActivityStatDisplay
          {...statProps}
          label={t('activity.ratting.escalations.shortLabel')}
          value={
            escalationSoldTotal > 0
              ? formatCurrencyValue(escalationSoldTotal)
              : escalationDrops.length > 0
                ? String(escalationDrops.length)
                : '—'
          }
          subValue={escalationSubValue}
          icon={<AlertTriangle className={cn('h-4 w-4', theme.text)} />}
          className={cn(metricCardShell, 'cursor-pointer hover:border-orange-400/50')}
          onClick={openEscalationModal}
        />
        <ActivityStatDisplay
          {...statProps}
          label={t('activity.ratting.expenses.shortLabel')}
          value={totalExpenses > 0 ? formatCurrencyValue(totalExpenses) : '—'}
          subValue={expensesSubValue}
          icon={<TrendingDown className={cn('h-4 w-4', theme.text)} />}
          className={cn(metricCardShell, 'cursor-pointer hover:border-rose-400/50')}
          onClick={openExpensesModal}
        />
      </ActivityMetricsGrid>
    </div>
  )

  const renderLogRow = (log: any, idx: number) => {
    const type = rattingLogTypeKey(log.type)
    const styles = RATTING_LOG_TYPE_STYLES[type]
    const typeLabel =
      type === 'escalation'
        ? t('activity.ratting.escalations.shortLabel')
        : type === 'expense'
          ? t('activity.ratting.expenses.shortLabel')
          : type === 'loot'
          ? t('activity.ratting.loot')
          : type === 'mtu' || type === 'salvage'
            ? t('activity.ratting.loot')
            : t(`activity.ratting.${type}`)

    return (
      <div
        key={`${log.refId || log.date}-${idx}`}
        className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-white/[0.04] p-2.5 text-xs transition-colors hover:border-red-500/30 hover:bg-red-500/[0.08]"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <RattingLogIcon log={log} />
          <span className={cn('h-2 w-2 shrink-0 rounded-full', styles.dot)} />
          <div className="min-w-0">
            <span className="block truncate text-sm font-semibold text-red-50">
              {log.type === 'escalation'
                ? (log.siteName as string) || log.charName || t('common.unknown')
                : log.type === 'expense'
                  ? (log.note as string) || log.charName || t('activity.ratting.expenses.unlabeled')
                  : log.charName || t('common.unknown')}
            </span>
            <span className={cn('text-[11px] font-medium uppercase tracking-wide', theme.textMuted)}>
              {typeLabel}
              {' · '}
              {isMounted ? <FormattedDate date={log.date} mode="time" /> : '—'}
            </span>
          </div>
        </div>
        <span className={cn('shrink-0 font-mono text-xs font-bold tabular-nums sm:text-sm', styles.amount)}>
          {isMounted
            ? log.type === 'escalation' && !log.amount
              ? t('activity.ratting.escalations.pending')
              : log.type === 'expense'
                ? `-${formatISK(log.amount || 0)}`
                : formatISK(log.amount || 0)
            : '—'}
        </span>
      </div>
    )
  }

  const logEmptyHint = t('activity.ratting.logEmptyHint')

  const latestIncomeSection = (
    <ActivityLogPanel
      theme={theme}
      logName={t('activity.ratting.latestRewards')}
      emptyMessage={t('activity.ratting.noRecentBounties')}
      emptyHint={logEmptyHint}
      isEmpty={top3Rewards.length === 0}
    >
      {top3Rewards.map((log: any, idx: number) => renderLogRow(log, idx))}
    </ActivityLogPanel>
  )

  const liveTransactions = (
    <ActivityLogPanel
      theme={theme}
      logName={t('activity.ratting.liveTransactions')}
      emptyMessage={t('activity.ratting.noRecentTransactions')}
      emptyHint={logEmptyHint}
      isEmpty={transactionLogs.length === 0}
    >
      <div className="space-y-1.5">
        {transactionLogs.map((log: any, idx: number) => renderLogRow(log, idx))}
      </div>
    </ActivityLogPanel>
  )

  if (!isMounted) return null

  return (
    <ActivityCardBody className="animate-in fade-in duration-500">
      {participantsRow}
      {metricsGrid}
      <ActivityCardMainSlot>
        {displayMode === 'compact' ? latestIncomeSection : liveTransactions}
      </ActivityCardMainSlot>

      <ActivityCardFooter
        activityType="ratting"
        mode={displayMode === 'compact' ? 'compact' : 'expanded'}
        onSync={onSync}
        isSyncing={isSyncing}
        syncStatus={syncStatus}
        onTogglePause={onTogglePause!}
        isPaused={isPaused!}
        onExport={handleExport}
        onEnd={() => setConfirmEndOpen(true)}
        esiMeta={{
          lastSyncAt,
          lastSyncWithChangesAt,
          syncCount,
          syncErrors,
        }}
      />

      <RattingLootHistoryModal
        open={lootListOpen}
        onOpenChange={setLootListOpen}
        activity={activity}
        onRefresh={onSync}
        onDataChange={(updatedData: RattingActivityData) => {
          useActivityStore.getState().updateActivity(activity.id, { data: updatedData })
        }}
      />
      <RattingEscalationModal
        open={escalationModalOpen}
        onOpenChange={setEscalationModalOpen}
        activity={activity}
        onRefresh={onSync}
      />
      <RattingExpensesModal
        open={expensesModalOpen}
        onOpenChange={setExpensesModalOpen}
        activity={activity}
        onRefresh={onSync}
      />
      <ActivityAnalyticsDialog
        open={analyticsOpen}
        onOpenChange={setAnalyticsOpen}
        activity={activity}
      />
      <ConfirmEndModal
        open={confirmEndOpen}
        onOpenChange={setConfirmEndOpen}
        onConfirm={() => {
          setConfirmEndOpen(false)
          onEnd?.()
        }}
      />
    </ActivityCardBody>
  )
}
