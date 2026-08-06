'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityStatDisplay } from '../shared/ActivityStatDisplay'
import { ActivityLogPanel } from '../shared/ActivityThemedPanel'
import {
  ActivityCardBody,
  ActivityCardMainSlot,
  ActivityMetricsGrid,
  ActivityParticipantsRow,
} from '../shared/activity-card-layout'
import { EscalationCountdown } from '../shared/EscalationCountdown'
import { useTranslations } from '@/i18n/hooks'
import { cn, formatCurrencyValue, formatISK } from '@/lib/utils'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { ActivityCardFooter } from '../shared/ActivityCardFooter'
import { ConfirmEndModal, ActivityAnalyticsDialog } from '../modals'
import { EscalationEntryModal } from '../modals/escalations/EscalationEntryModal'
import { EscalationLootModal } from '../modals/escalations/EscalationLootModal'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AlertTriangle,
  Banknote,
  Clock3,
  Crosshair,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useActivityMetrics } from '@/lib/hooks/use-activity-metrics'
import { getActivityTheme } from '@/lib/activity/activity-theme'
import { toast } from 'sonner'
import { useActivityStore } from '@/lib/stores/activity-store'
import {
  countActiveEscalations,
  dedupeEscalations,
  syncExpiredEscalations,
  type EscalationEntry,
  type EscalationsActivityData,
} from '@/lib/activities/escalations-entries'

interface EscalationsActivityContentProps {
  activity: any
  onSync: () => void
  isSyncing: boolean
  syncStatus: 'idle' | 'success' | 'error'
  displayMode?: 'compact' | 'expanded'
  onEnd?: () => void
  isPaused?: boolean
  onTogglePause?: () => void
}

const WALLET_LOG_TYPES = new Set(['bounty', 'ess', 'tax'])
const ESC_LOG_TYPES = new Set(['escalation-buy', 'escalation-loot', 'bounty', 'ess', 'tax'])

function logTypeLabel(type: string, t: (key: string) => string): string {
  if (type === 'escalation-buy') return t('activity.escalations.logBuy')
  if (type === 'escalation-loot') return t('activity.escalations.logLoot')
  if (type === 'bounty') return t('activity.escalations.bounty')
  if (type === 'ess') return t('activity.escalations.ess')
  if (type === 'tax') return t('activity.escalations.tax')
  return type
}

export function EscalationsActivityContent({
  activity,
  onSync,
  isSyncing,
  syncStatus,
  displayMode = 'compact',
  onEnd,
  isPaused,
  onTogglePause,
}: EscalationsActivityContentProps) {
  const { t } = useTranslations()
  const theme = useMemo(() => getActivityTheme('escalations'), [])
  const { metrics, isMounted } = useActivityMetrics(activity)

  const [entryModalOpen, setEntryModalOpen] = useState(false)
  const [lootModalOpen, setLootModalOpen] = useState(false)
  const [selectedEscalation, setSelectedEscalation] = useState<EscalationEntry | null>(null)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [confirmEndOpen, setConfirmEndOpen] = useState(false)

  const data = (activity.data || {}) as EscalationsActivityData
  const logs = useMemo(() => data.logs || [], [data.logs])
  const escalations = useMemo(
    () => dedupeEscalations(data.escalations || []),
    [data.escalations]
  )

  const automatedBounties = Number(data.automatedBounties) || 0
  const additionalBounties = Number(data.additionalBounties) || 0
  const automatedEss = Number(data.automatedEss) || 0
  const escLoot = Number(data.estimatedEscalationLootValue) || 0
  const escCost = Number(data.estimatedEscalationCostValue) || 0
  const totalBounty = automatedBounties + additionalBounties
  const activeCount = countActiveEscalations(data)
  const totalNetIsk = metrics.netProfit
  const totalGrossIsk = metrics.totalRevenue

  const totalIskSubValue = t('activity.escalations.totalIskBreakdown', {
    gross: formatISK(totalGrossIsk),
    cost: formatISK(escCost),
  })

  const lastSyncAt = data.lastSyncAt as string | undefined
  const syncErrors = (data.syncErrors || []) as Array<{ characterName: string; error: string }>

  const getIncomeMetricSubValue = useCallback(
    (hasIncome: boolean) => {
      if (hasIncome) return t('activity.escalations.sublabelIsk')
      if (syncErrors.length > 0) return t('activity.escalations.metricsSyncFailed')
      if (lastSyncAt) return t('activity.escalations.metricsNoBountyYet')
      return t('activity.escalations.metricsSyncPending')
    },
    [lastSyncAt, syncErrors.length, t]
  )

  const transactionLogs = useMemo(
    () =>
      [...logs]
        .filter((l) => ESC_LOG_TYPES.has(l.type))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [logs]
  )

  useEffect(() => {
    const synced = syncExpiredEscalations(data)
    if (synced !== data && synced.escalations?.some((e, i) => e.status !== data.escalations?.[i]?.status)) {
      useActivityStore.getState().updateActivity(activity.id, { data: synced })
      void fetch(`/api/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: synced }),
      })
    }
  }, [activity.id, data])

  const openLootFor = (entry: EscalationEntry) => {
    setSelectedEscalation(entry)
    setLootModalOpen(true)
  }

  const metricCardShell = cn(
    'rounded-xl border border-orange-500/15 bg-black/25 p-3 backdrop-blur-sm transition-colors'
  )
  const statProps = { size: 'comfortable' as const, valueTypography: 'numeric' as const }

  const headerActionButtonClass = cn(
    'h-9 w-9 rounded-lg border border-orange-500/20 bg-orange-950/30 text-orange-200 hover:bg-orange-900/40'
  )

  const participantsRow = (
    <ActivityParticipantsRow>
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2 hover:space-x-1 transition-all duration-500">
          {(activity.participants || []).map((participant: any) => (
            <Tooltip key={participant.characterId}>
              <TooltipTrigger asChild>
                <Avatar className={cn('h-10 w-10 rounded-lg ring-1 ring-white/15', theme.iconBg)}>
                  <AvatarImage
                    src={`https://images.evetech.net/characters/${participant.characterId}/portrait?size=64`}
                    className="rounded-lg"
                  />
                  <AvatarFallback className="rounded-lg">
                    {participant.characterName?.[0] || 'C'}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent className="rounded-lg border border-orange-400/25 bg-[#0c0a08]/95 text-xs text-orange-100">
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
              onClick={() => setEntryModalOpen(true)}
            >
              <Plus className="h-4 w-4" />
              {escalations.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
                  {escalations.length}
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent className="rounded-lg border border-orange-400/25 bg-[#0c0a08]/95 text-[10px] font-bold uppercase tracking-wide text-orange-100">
            {t('activity.escalations.registerBuy')}
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
          'grid grid-cols-1 gap-3 border-orange-400/40 bg-gradient-to-br from-orange-500/18 via-orange-950/25 to-black/20 sm:grid-cols-2 sm:gap-4',
          'cursor-pointer hover:border-orange-300/55'
        )}
        onClick={() => setAnalyticsOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setAnalyticsOpen(true)
        }}
      >
        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className={cn('font-mono text-[11px] font-bold uppercase tracking-wider', theme.textMuted)}>
              {t('activity.escalations.totalIsk')}
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
              {t('activity.escalations.efficiency')}
            </span>
            <Clock3 className={cn('h-4 w-4 shrink-0 opacity-80', theme.text)} />
          </div>
          <p className="font-mono text-xl font-bold tabular-nums tracking-tight text-orange-50 sm:text-2xl">
            {formatCurrencyValue(metrics.iskPerHour)}
          </p>
          <p className={cn('mt-1.5 font-mono text-[11px]', theme.textMuted)}>
            {metrics.iskPerHour === 0
              ? getIncomeMetricSubValue(false)
              : t('activity.escalations.sublabelIskPerHour')}
          </p>
        </div>
      </div>

      <ActivityMetricsGrid className="grid-cols-2 gap-2.5 sm:grid-cols-3">
        <ActivityStatDisplay
          {...statProps}
          label={t('activity.escalations.bounty')}
          value={formatCurrencyValue(totalBounty)}
          subValue={totalBounty > 0 ? t('activity.escalations.sublabelIsk') : getIncomeMetricSubValue(false)}
          icon={<Crosshair className={cn('h-4 w-4', theme.text)} />}
          className={metricCardShell}
        />
        <ActivityStatDisplay
          {...statProps}
          label={t('activity.escalations.ess')}
          value={formatCurrencyValue(automatedEss)}
          subValue={automatedEss > 0 ? t('activity.escalations.sublabelIsk') : '—'}
          icon={<Banknote className={cn('h-4 w-4', theme.text)} />}
          className={metricCardShell}
        />
        <ActivityStatDisplay
          {...statProps}
          label={t('activity.escalations.loot')}
          value={formatCurrencyValue(escLoot)}
          subValue={escLoot > 0 ? t('activity.escalations.sublabelIsk') : '—'}
          icon={<TrendingUp className={cn('h-4 w-4', theme.text)} />}
          className={metricCardShell}
        />
        <ActivityStatDisplay
          {...statProps}
          label={t('activity.escalations.cost')}
          value={escCost > 0 ? formatCurrencyValue(escCost) : '—'}
          subValue={escCost > 0 ? t('activity.escalations.purchases') : '—'}
          icon={<TrendingDown className={cn('h-4 w-4', theme.text)} />}
          className={metricCardShell}
        />
        <ActivityStatDisplay
          {...statProps}
          label={t('activity.escalations.activeCount')}
          value={String(activeCount)}
          subValue={t('activity.escalations.activeSublabel')}
          icon={<AlertTriangle className={cn('h-4 w-4', theme.text)} />}
          className={metricCardShell}
        />
      </ActivityMetricsGrid>
    </div>
  )

  const escalationsPanel = (
    <ActivityLogPanel
      theme={theme}
      logName={t('activity.escalations.sessionList')}
      emptyMessage={t('activity.escalations.empty')}
      isEmpty={escalations.length === 0}
    >
      <div className="space-y-2">
        {escalations.map((entry) => (
          <div
            key={entry.refId}
            className="flex flex-col gap-2 rounded-lg border border-orange-500/15 bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-xs font-bold text-orange-100">{entry.name}</p>
                {entry.dedRating ? (
                  <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-[9px] font-bold text-orange-300">
                    {entry.dedRating}
                  </span>
                ) : null}
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase',
                    entry.status === 'active' && 'bg-emerald-500/15 text-emerald-300',
                    entry.status === 'completed' && 'bg-orange-500/15 text-orange-200',
                    entry.status === 'expired' && 'bg-zinc-500/15 text-zinc-400'
                  )}
                >
                  {t(`activity.escalations.status.${entry.status}`)}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-orange-200/60">
                {entry.purchasedFrom ? (
                  <span>{t('activity.escalations.seller')}: {entry.purchasedFrom}</span>
                ) : null}
                {entry.pricePaid ? (
                  <span>{t('activity.escalations.pricePaid')}: {formatISK(entry.pricePaid)}</span>
                ) : null}
                {entry.lootValue ? (
                  <span>{t('activity.escalations.loot')}: {formatISK(entry.lootValue)}</span>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <EscalationCountdown expiresAt={entry.expiresAt} status={entry.status} />
              {entry.status === 'active' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 border-orange-500/30 text-[9px] uppercase text-orange-200"
                  onClick={() => openLootFor(entry)}
                >
                  {t('activity.escalations.registerLoot')}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </ActivityLogPanel>
  )

  const transactionsPanel = (
    <ActivityLogPanel
      theme={theme}
      logName={t('activity.escalations.transactions')}
      emptyMessage={t('activity.escalations.noTransactions')}
      isEmpty={transactionLogs.length === 0}
    >
      <div className="space-y-1">
        {transactionLogs.slice(0, displayMode === 'compact' ? 8 : 20).map((log, idx) => {
          const amount = Number(log.amount) || 0
          const isNegative = amount < 0
          return (
            <div
              key={`${log.refId || log.date}-${idx}`}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-orange-500/5"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    WALLET_LOG_TYPES.has(log.type)
                      ? 'bg-orange-400'
                      : log.type === 'escalation-buy'
                        ? 'bg-rose-400'
                        : 'bg-emerald-400'
                  )}
                />
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-bold text-orange-100">
                    {logTypeLabel(log.type, t)}
                    {log.siteName ? ` · ${log.siteName}` : ''}
                  </p>
                  <p className="text-[9px] text-orange-200/50">
                    <FormattedDate date={log.date} />
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  'shrink-0 font-mono text-[10px] font-bold tabular-nums',
                  isNegative ? 'text-rose-300' : 'text-emerald-300'
                )}
              >
                {isNegative ? '−' : '+'}
                {formatISK(Math.abs(amount))}
              </span>
            </div>
          )
        })}
      </div>
    </ActivityLogPanel>
  )

  const handleExport = useCallback(() => {
    if (logs.length === 0) {
      toast.info(t('activity.escalations.noTransactions'))
      return
    }
    const headers = ['Date', 'Type', 'Amount']
    const csvRows = [headers.join(',')]
    logs.forEach((log) => {
      csvRows.push(`${log.date},${log.type},${Math.round(Number(log.amount) || 0)}`)
    })
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `escalations_export_${activity.id}_${Date.now()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [activity.id, logs, t])

  if (!isMounted) return null

  return (
    <>
      <ActivityCardBody className="animate-in fade-in duration-500">
        {participantsRow}
        {metricsGrid}
        <ActivityCardMainSlot>
          {displayMode === 'compact' ? escalationsPanel : transactionsPanel}
        </ActivityCardMainSlot>
        <ActivityCardFooter
          activityType="escalations"
          mode={displayMode === 'compact' ? 'compact' : 'expanded'}
          onSync={onSync}
          isSyncing={isSyncing}
          syncStatus={syncStatus}
          onTogglePause={onTogglePause ?? (() => {})}
          isPaused={isPaused ?? false}
          onExport={handleExport}
          onEnd={() => setConfirmEndOpen(true)}
          esiMeta={{
            lastSyncAt,
            syncErrors: syncErrors as Array<{
              characterId: number
              characterName: string
              error: string
            }>,
          }}
        />
      </ActivityCardBody>

      <EscalationEntryModal
        open={entryModalOpen}
        onOpenChange={setEntryModalOpen}
        activity={activity}
      />
      <EscalationLootModal
        open={lootModalOpen}
        onOpenChange={setLootModalOpen}
        activity={activity}
        escalation={selectedEscalation}
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
    </>
  )
}
