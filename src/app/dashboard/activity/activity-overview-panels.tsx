'use client'

import { Loader2, AlertCircle } from 'lucide-react'
import { formatCurrencyValue, formatNumber } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'

type StatsProps = {
  paginationTotal: number
  paginationActiveCount: number
  totalDuration: string
  activeCount: number
  typeParam?: string | null
  totalQuantity: number
  activeGross: number
}

const STAT_CARD =
  'ta-panel min-w-[9.5rem] max-w-full flex-1 basis-[calc(50%-0.25rem)] sm:basis-[calc(25%-0.38rem)] p-[18px]'

export function ActivityStatsPanel({
  paginationTotal,
  paginationActiveCount,
  totalDuration,
  activeCount,
  typeParam,
  totalQuantity,
  activeGross,
}: StatsProps) {
  const { t } = useTranslations()

  return (
    <div className="flex flex-wrap gap-2">
      <div className={STAT_CARD}>
        <p className="text-[11px] font-medium text-eve-muted">
          {t('activity.tracker.stats.totalOperations')}
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-eve-text">
          {paginationTotal + paginationActiveCount}
        </p>
      </div>

      <div className={STAT_CARD}>
        <p className="text-[11px] font-medium text-eve-muted">
          {t('activity.tracker.stats.totalDuration')}
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-eve-text">{totalDuration}</p>
      </div>

      <div className={STAT_CARD}>
        <p className="text-[11px] font-medium text-eve-muted">
          {t('activity.tracker.stats.activeFleets')}
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-eve-text">{activeCount}</p>
      </div>

      <div className={STAT_CARD}>
        {typeParam === 'mining' ? (
          <>
            <p className="text-[11px] font-medium text-eve-muted">
              {t('activity.tracker.stats.totalMined')}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-eve-text">
              {formatNumber(totalQuantity)} m³
            </p>
          </>
        ) : (
          <>
            <p className="text-[11px] font-medium text-eve-muted">
              {t('activity.tracker.stats.activeGross')}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-400">
              {formatCurrencyValue(activeGross)}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

type HealthProps = {
  isLoading: boolean
  lastError: string | null
  lastFetchAt: string | null
  lastSyncAt: string | null
  loadingLabel: string
  fallbackErrorLabel: string
  lastLoadLabel: string
  lastSyncLabel: string
  unknownTimestampLabel: string
}

export function TrackerHealthPanel({
  isLoading,
  lastError,
  lastFetchAt,
  lastSyncAt,
  loadingLabel,
  fallbackErrorLabel,
  lastLoadLabel,
  lastSyncLabel,
  unknownTimestampLabel,
}: HealthProps) {
  if (!isLoading && !lastError) return null

  const formatTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString() : unknownTimestampLabel

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0c141c]/35 p-3 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.45)] backdrop-blur-md">
      <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 items-center gap-2 text-eve-text">
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-eve-accent" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
          )}
          <span className="min-w-0">{isLoading ? loadingLabel : lastError || fallbackErrorLabel}</span>
        </div>
        <div className="shrink-0 text-[10px] text-eve-muted sm:text-right">
          <span>
            {lastLoadLabel}: {formatTime(lastFetchAt)}
          </span>
          <span className="mx-1.5 text-eve-border">·</span>
          <span>
            {lastSyncLabel}: {formatTime(lastSyncAt)}
          </span>
        </div>
      </div>
    </div>
  )
}
