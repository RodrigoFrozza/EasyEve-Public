'use client'

import { useState, useMemo, useEffect } from 'react'
import { formatISK, formatNumber, cn, formatCompactNumber, formatCurrencyValue } from '@/lib/utils'
import Image from 'next/image'
import { TrendingUp, TrendingDown, Activity as ActivityIcon, Gem, Sparkles, Clock3, Pickaxe } from 'lucide-react'
import Link from 'next/link'
import { ConfirmEndModal, MiningBestOresModal, MiningWismModal } from '../modals'
import { ActivityAnalyticsDialog } from '../analytics/ActivityAnalyticsDialog'
import { ActivityCardFooter } from '../shared/ActivityCardFooter'
import { getActivityTheme } from '@/lib/activity/activity-theme'
import { ActivityStatDisplay } from '../shared/ActivityStatDisplay'
import { ActivityLogPanel } from '../shared/ActivityThemedPanel'
import {
  ActivityCardBody,
  ActivityCardMainSlot,
  ActivityMetricsGrid,
  ActivityParticipantsRow,
} from '../shared/activity-card-layout'
import { useActivityMetrics } from '@/lib/hooks/use-activity-metrics'
import { useTranslations } from '@/i18n/hooks'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'

interface MiningActivityContentProps {
  activity: any
  onSync: () => void
  isSyncing: boolean
  syncStatus: 'idle' | 'success' | 'error'
  onEnd: () => void
  displayMode?: 'compact' | 'expanded'
  isPaused?: boolean
  onTogglePause?: () => void
}

export function MiningActivityContent({
  activity,
  onSync,
  isSyncing,
  syncStatus,
  onEnd,
  displayMode = 'compact',
  isPaused,
  onTogglePause,
}: MiningActivityContentProps) {
  const { t } = useTranslations()
  const [confirmEndOpen, setConfirmEndOpen] = useState(false)
  const [bestOresModalOpen, setBestOresModalOpen] = useState(false)
  const [wismOpen, setWismOpen] = useState(false)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [oreNames, setOreNames] = useState<Record<number, string>>({})
  const [oreImages, setOreImages] = useState<Record<number, string>>({})
  const { metrics, isMounted } = useActivityMetrics(activity)
  const theme = useMemo(() => getActivityTheme('mining'), [])

  const logs = useMemo(() => (activity.data as any)?.logs || [], [activity.data])
  const miningTotalQuantity = activity.data?.totalQuantity || 0
  const miningTotalValue = activity.data?.totalEstimatedValue || 0
  const oreBreakdown = useMemo(() => (activity.data?.oreBreakdown || {}) as Record<string, any>, [activity.data])
  const miningCategory = (activity.data as any)?.miningType || 'Ore'
  const activitySpace = activity.space as string | undefined

  const m3Trend = (activity.data as any)?.m3Trend || 'stable'
  const TrendIcon = m3Trend === 'up' ? TrendingUp : m3Trend === 'down' ? TrendingDown : ActivityIcon
  const trendColor = m3Trend === 'up' ? 'text-green-400' : m3Trend === 'down' ? 'text-red-400' : 'text-zinc-500'

  const m3PerHour = useMemo(() => {
    const hours = metrics.elapsedMs / 3600000
    if (hours < 0.001) return 0
    return miningTotalQuantity / hours
  }, [miningTotalQuantity, metrics.elapsedMs])

  const typeIds = useMemo(() => {
    return Array.from(new Set(logs.map((l: any) => l.typeId).filter(Boolean))).sort()
  }, [logs])

  const typeIdsKey = JSON.stringify(typeIds)

  useEffect(() => {
    if (typeIds.length === 0) return

    const resolveTypes = async () => {
      try {
        const res = await fetch('/api/sde/resolve-types', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ typeIds }),
        })
        const data = await res.json()

        setOreNames(data)
        const images: Record<number, string> = {}
        typeIds.forEach((id) => {
          images[Number(id)] = `https://images.evetech.net/types/${id}/icon?size=32`
        })
        setOreImages(images)
      } catch (e) {
        console.error('Failed to resolve ore types:', e)
      }
    }

    resolveTypes()
  }, [typeIdsKey, typeIds])

  const sortedOreTypes = useMemo(() => {
    return Object.keys(oreBreakdown).sort((a, b) => {
      const valueA = oreBreakdown[a]?.estimatedValue || 0
      const valueB = oreBreakdown[b]?.estimatedValue || 0
      return valueB - valueA
    })
  }, [oreBreakdown])

  const top3Ores = useMemo(() => {
    return sortedOreTypes.slice(0, 3).map((typeId) => {
      const breakdown = oreBreakdown[typeId]
      const qty = breakdown?.quantity || 0
      const value = breakdown?.estimatedValue || 0
      return {
        typeId,
        name: breakdown?.name || oreNames[Number(typeId)] || `Type ${typeId}`,
        image: breakdown?.icon || oreImages[Number(typeId)] || `https://images.evetech.net/types/${typeId}/icon?size=32`,
        quantity: qty,
        volume: breakdown?.volumeValue || 0,
        value,
        perUnit: qty > 0 ? value / qty : 0,
      }
    })
  }, [sortedOreTypes, oreNames, oreImages, oreBreakdown])

  const handleConfirmEnd = () => {
    setConfirmEndOpen(false)
    onEnd?.()
  }

  const handleExport = () => {
    if (sortedOreTypes.length === 0) return

    const headers = [
      t('mining.oreCol') || 'Ore',
      t('mining.quantityCol') || 'Quantity (units)',
      t('mining.volumeCol') || 'Volume (m³)',
      t('mining.valueCol') || 'Value (ISK)',
    ]
    const csvRows = [headers.join(',')]

    sortedOreTypes.forEach((typeId) => {
      const ore = oreBreakdown[typeId]
      const name = ore?.name || oreNames[Number(typeId)] || `Type ${typeId}`
      const quantity = ore?.quantity || 0
      const volume = ore?.volumeValue || 0
      const value = ore?.estimatedValue || 0
      csvRows.push(`${name},${quantity},${Math.round(volume)},${value}`)
    })

    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `mining_export_${activity.id}_${new Date().getTime()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const metricShell = cn(theme.metricShell, 'hover:border-cyan-300/55 hover:bg-cyan-300/22')

  const statProps = {
    size: 'compact' as const,
    variant: 'default' as const,
    labelClassName: theme.textMuted,
    subValueClassName: theme.textMuted,
    valueClassName: theme.text,
  }

  const participantsRow = (
    <ActivityParticipantsRow>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2 hover:space-x-1 transition-all duration-500">
            {(activity.participants || []).map((participant: any) => (
              <Tooltip key={participant.characterId}>
                <TooltipTrigger asChild>
                  <Avatar className={cn('h-9 w-9 rounded-lg ring-1 ring-white/10 transition-none', theme.iconBg)}>
                    <AvatarImage
                      src={`https://images.evetech.net/characters/${participant.characterId}/portrait?size=64`}
                      className="rounded-lg"
                    />
                    <AvatarFallback className="rounded-lg">{participant.characterName?.[0] || 'C'}</AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>{participant.characterName}</TooltipContent>
              </Tooltip>
            ))}
          </div>
          
          <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block" />
          
          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-lg border border-cyan-400/25 bg-cyan-400/10 text-cyan-200/80 backdrop-blur-sm transition-colors hover:border-cyan-300/50 hover:bg-cyan-400/20 hover:text-cyan-100"
                  onClick={() => setBestOresModalOpen(true)}
                >
                  <Gem className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="rounded-lg border border-cyan-300/25 bg-[#0c141c]/95 text-[10px] font-bold uppercase tracking-wide text-cyan-100">
                {t('activity.mining.modals.market.title')}
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-lg border border-cyan-400/25 bg-cyan-400/10 text-cyan-200/80 backdrop-blur-sm transition-colors hover:border-cyan-300/50 hover:bg-cyan-400/20 hover:text-cyan-100"
                  onClick={() => setWismOpen(true)}
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="rounded-lg border border-cyan-300/25 bg-[#0c141c]/95 text-[10px] font-bold uppercase tracking-wide text-cyan-100">
                {t('activity.mining.modals.wism.title')}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  asChild
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-lg border border-cyan-400/25 bg-cyan-400/10 text-cyan-200/80 backdrop-blur-sm transition-colors hover:border-cyan-300/50 hover:bg-cyan-400/20 hover:text-cyan-100"
                >
                  <Link href="/dashboard/miners-rest">
                    <Pickaxe className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="rounded-lg border border-cyan-300/25 bg-[#0c141c]/95 text-[10px] font-bold uppercase tracking-wide text-cyan-100">
                {t('minersRest.cardButton')}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
    </ActivityParticipantsRow>
  )

  const metricsGrid = (
    <ActivityMetricsGrid>
        <ActivityStatDisplay
          {...statProps}
          label={t('activity.mining.yield')}
          value={formatCompactNumber(Math.round(miningTotalQuantity))}
          subValue="m³"
          icon={<Gem className={cn('h-3 w-3', theme.text)} />}
          className={metricShell}
        />
        <ActivityStatDisplay
          {...statProps}
          label={t('activity.mining.yieldPerHour')}
          value={formatCompactNumber(Math.round(m3PerHour))}
          subValue="m³/h"
          icon={<ActivityIcon className={cn('h-3 w-3', theme.text)} />}
          className={metricShell}
        />
        <ActivityStatDisplay
          {...statProps}
          label={t('activity.mining.loot')}
          value={formatCurrencyValue(miningTotalValue)}
          subValue="isk"
          icon={<TrendingUp className={cn('h-3 w-3', theme.text)} />}
          className={metricShell}
        />
        <ActivityStatDisplay
          {...statProps}
          label={t('activity.mining.efficiency')}
          value={formatCurrencyValue(metrics.iskPerHour)}
          subValue="isk/h"
          icon={<Clock3 className={cn('h-3 w-3', theme.text)} />}
          className={cn(metricShell, 'cursor-pointer hover:border-cyan-300/55')}
          title={t('activity.analytics.viewIndicators')}
          onClick={() => setAnalyticsOpen(true)}
        />
    </ActivityMetricsGrid>
  )

  const topOresSection = (
    <ActivityLogPanel
      theme={theme}
      logName="EXTRACTION_HISTORY"
      emptyMessage={
        isSyncing
          ? (t('activity.mining.initializing') || 'INITIALIZING...')
          : (t('activity.mining.noExtractionData') || 'NO_EXTRACTION_DATA')
      }
      isEmpty={top3Ores.length === 0}
      headerExtra={<TrendIcon className={cn('h-3 w-3 shrink-0', trendColor)} />}
    >
      {top3Ores.map((ore) => (
        <div key={ore.typeId} className="flex items-center gap-2 rounded-md p-1.5 hover:bg-cyan-400/[0.08]">
          <Image
            src={ore.image}
            alt=""
            width={32}
            height={32}
            className="h-5 w-5 rounded-md border border-white/10 bg-black/30"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-bold leading-none text-zinc-300">{ore.name}</p>
            <p className="mt-0.5 font-mono text-[8px] text-zinc-500">
              {formatCompactNumber(ore.quantity)} {t('activity.mining.units')}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className={cn('font-mono text-[10px] font-black leading-none', theme.text)}>
              {formatCurrencyValue(ore.value)}
            </p>
            <p className="mt-0.5 font-mono text-[8px] text-zinc-500">{formatCurrencyValue(ore.perUnit)}/U</p>
          </div>
        </div>
      ))}
    </ActivityLogPanel>
  )

  const fullOresList = (
    <div className={cn('relative flex flex-col overflow-hidden p-4', theme.panel)}>
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center gap-2">
          <div className={cn('h-3 w-1 rounded-full', theme.accentBar)} />
          <span className="text-[10px] text-zinc-400 uppercase font-black tracking-wider">{t('activity.mining.latestMinedOres')}</span>
        </div>
        {sortedOreTypes.length > 0 && (
          <span className="text-[9px] text-zinc-600 font-mono font-bold tracking-widest uppercase">
            {sortedOreTypes.length} {t('activity.mining.typesDetected')}
          </span>
        )}
      </div>

      <div className="max-h-[min(320px,45vh)] overflow-y-auto custom-scrollbar pr-2 relative z-10 space-y-1.5">
        {sortedOreTypes.map((typeId) => {
          const quantity = oreBreakdown[typeId]?.quantity || 0
          const volume = oreBreakdown[typeId]?.volumeValue || 0
          const value = oreBreakdown[typeId]?.estimatedValue || 0
          const maxValue = oreBreakdown[sortedOreTypes[0]]?.estimatedValue || 1
          const perUnit = quantity > 0 ? value / quantity : 0

          return (
            <div
              key={typeId}
              className="flex justify-between items-center text-[11px] p-2.5 bg-zinc-900/20 border border-white/[0.02] rounded-none hover:bg-zinc-900/40 transition-none group/item"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Image
                  src={`https://images.evetech.net/types/${typeId}/icon?size=32`}
                  alt=""
                  width={32}
                  height={32}
                  className="h-6 w-6 shrink-0"
                />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-zinc-200 font-bold leading-none truncate">
                    {oreBreakdown[typeId]?.name || t('activity.mining.unknownOre')}
                  </span>
                  <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">
                    {formatCompactNumber(quantity)} {t('activity.mining.units')} • {formatCompactNumber(Math.round(volume))} m³
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[8px] text-zinc-600 font-black uppercase tracking-widest">{t('activity.mining.buy')}</span>
                    <span className="text-[9px] font-mono font-black text-emerald-500/80">{formatISK(oreBreakdown[typeId]?.buy || 0)}</span>
                    <span className="text-[8px] text-zinc-600 font-black uppercase tracking-widest">{t('activity.mining.sell')}</span>
                    <span className="text-[9px] font-mono font-black text-cyan-500/80">{formatISK(oreBreakdown[typeId]?.sell || 0)}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="font-mono font-black text-eve-accent">{formatCurrencyValue(value)}</span>
                <span className="text-[8px] font-mono text-zinc-500">{formatCurrencyValue(perUnit)}/U</span>
                <div className="w-16 h-1 bg-white/5 rounded-none overflow-hidden">
                  <div
                    className="h-full bg-eve-accent/50 rounded-none transition-none"
                    style={{ width: `${Math.min(100, (value / maxValue) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}

        {sortedOreTypes.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">{t('activity.mining.noMiningData')}</p>
          </div>
        )}
      </div>
    </div>
  )

  if (!isMounted) return null

  return (
    <ActivityCardBody className="animate-in fade-in duration-500">
      {participantsRow}
      {metricsGrid}
      <ActivityCardMainSlot>
        {displayMode === 'compact' ? topOresSection : fullOresList}
      </ActivityCardMainSlot>

      <ActivityCardFooter
        activityType="mining"
        mode={displayMode === 'compact' ? 'compact' : 'expanded'}
        onSync={onSync}
        isSyncing={isSyncing}
        syncStatus={syncStatus}
        onTogglePause={onTogglePause!}
        isPaused={isPaused!}
        onExport={handleExport}
        onEnd={() => setConfirmEndOpen(true)}
        esiMeta={{
          lastSyncAt: (activity.data as any)?.lastSyncAt,
          lastSyncWithChangesAt: (activity.data as any)?.lastSyncWithChangesAt,
          syncCount: (activity.data as any)?.syncCount,
          syncErrors: (activity.data as any)?.syncErrors,
        }}
      />

      <MiningBestOresModal
        open={bestOresModalOpen}
        onOpenChange={setBestOresModalOpen}
        initialMiningType={miningCategory}
        space={activitySpace}
      />

      <MiningWismModal
        open={wismOpen}
        onOpenChange={setWismOpen}
        miningCategory={miningCategory}
        space={activitySpace}
      />

      <ActivityAnalyticsDialog open={analyticsOpen} onOpenChange={setAnalyticsOpen} activity={activity} />

      <ConfirmEndModal open={confirmEndOpen} onOpenChange={setConfirmEndOpen} onConfirm={handleConfirmEnd} />
    </ActivityCardBody>
  )
}

