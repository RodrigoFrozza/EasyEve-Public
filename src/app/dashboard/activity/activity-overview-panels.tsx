'use client'

import { Loader2, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatISK, formatNumber } from '@/lib/utils'

type StatsProps = {
  paginationTotal: number
  paginationActiveCount: number
  totalDuration: string
  activeCount: number
  typeParam?: string | null
  totalQuantity: number
  activeGross: number
}

export function ActivityStatsPanel({
  paginationTotal,
  paginationActiveCount,
  totalDuration,
  activeCount,
  typeParam,
  totalQuantity,
  activeGross,
}: StatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card className="bg-eve-panel border-eve-border">
        <CardContent className="pt-6">
          <p className="text-sm text-gray-400">Total Operations</p>
          <p className="text-2xl font-bold text-white">{paginationTotal + paginationActiveCount}</p>
        </CardContent>
      </Card>

      <Card className="bg-eve-panel border-eve-border">
        <CardContent className="pt-6">
          <p className="text-sm text-gray-400">Total Duration</p>
          <p className="text-2xl font-bold text-white">{totalDuration}</p>
        </CardContent>
      </Card>

      <Card className="bg-eve-panel border-eve-border">
        <CardContent className="pt-6">
          <p className="text-sm text-gray-400">Active Fleets</p>
          <p className="text-2xl font-bold text-white">{activeCount}</p>
        </CardContent>
      </Card>

      <Card className="bg-eve-panel border-eve-border">
        <CardContent className="pt-6">
          {typeParam === 'mining' ? (
            <>
              <p className="text-sm text-gray-400">Total Mined</p>
              <p className="text-2xl font-bold text-white">{formatNumber(totalQuantity)} m³</p>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-400">Active Gross</p>
              <p className="text-2xl font-bold text-green-400">{formatISK(activeGross)}</p>
            </>
          )}
        </CardContent>
      </Card>
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

  return (
    <Card className="bg-eve-panel border-eve-border">
      <CardContent className="py-3 text-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-zinc-300">
          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-eve-accent" /> : <AlertCircle className="h-3.5 w-3.5 text-red-400" />}
          <span>{isLoading ? loadingLabel : (lastError || fallbackErrorLabel)}</span>
        </div>
        <div className="text-zinc-500">
          {lastFetchAt ? `${lastLoadLabel}: ${new Date(lastFetchAt).toLocaleTimeString()}` : `${lastLoadLabel}: ${unknownTimestampLabel}`} • {lastSyncAt ? `${lastSyncLabel}: ${new Date(lastSyncAt).toLocaleTimeString()}` : `${lastSyncLabel}: ${unknownTimestampLabel}`}
        </div>
      </CardContent>
    </Card>
  )
}
