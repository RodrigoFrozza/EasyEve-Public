'use client'

import { useState, useMemo, useEffect } from 'react'
import { formatISK, formatNumber, cn, formatCompactNumber, formatCurrencyValue } from '@/lib/utils'
import Image from 'next/image'
import { TrendingUp, TrendingDown, Activity as ActivityIcon, Gem, Sparkles, Clock3 } from 'lucide-react'
import { ConfirmEndModal, MiningAnalyticsModal, MiningBestOresModal, MiningWismModal } from '../modals'
import { ActivityCardFooter } from '../shared/ActivityCardFooter'
import { getActivityColors } from '@/lib/constants/activity-colors'
import { ActivityStatDisplay } from '../shared/ActivityStatDisplay'
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
  const colors = getActivityColors('mining')

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

  const metricShell = cn('rounded-xl border bg-zinc-900/40 backdrop-blur-sm', colors.border)

  const statsGrid = (
    <div className="space-y-4">
      {/* Top Row: Avatars and Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2 hover:space-x-1 transition-all duration-500">
            {(activity.participants || []).map((participant: any) => (
              <Tooltip key={participant.characterId}>
                <TooltipTrigger asChild>
                  <Avatar className={cn('h-9 w-9 ring-2 ring-zinc-950 transition-transform hover:scale-110 hover:z-10', colors.iconBg, 'ring-amber-500/30')}>
                    <AvatarImage
                      src={`https://images.evetech.net/characters/${participant.characterId}/portrait?size=64`}
                    />
                    <AvatarFallback>{participant.characterName?.[0] || 'C'}</AvatarFallback>
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
                  className="h-9 w-9 rounded-xl border-amber-500/20 bg-amber-500/5 text-amber-300 hover:bg-amber-500/10 hover:border-amber-500/40"
                  onClick={() => setBestOresModalOpen(true)}
                >
                  <Gem className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('mining.oreMarketTooltip') || 'Ore market (Jita)'}</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-xl border-amber-500/20 bg-amber-500/5 text-amber-300 hover:bg-amber-500/10 hover:border-amber-500/40"
                  onClick={() => setWismOpen(true)}
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('mining.wismTooltip') || 'What I should mine (paste scan)'}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Metrics Grid: Yield > Yield/h > Total ISK > ISK/h */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <ActivityStatDisplay
          label={t('activity.mining.yield')}
          value={formatCompactNumber(Math.round(miningTotalQuantity))}
          subValue="m³"
          variant="default"
          size="compact"
          valueClassName="text-white"
          icon={<Gem className={cn('h-3 w-3', colors.text)} />}
          className={metricShell}
        />
        <ActivityStatDisplay
          label={t('activity.mining.yieldPerHour')}
          value={formatCompactNumber(Math.round(m3PerHour))}
          subValue="m³/h"
          variant="default"
          size="compact"
          valueClassName="text-white"
          icon={<ActivityIcon className={cn('h-3 w-3', colors.text)} />}
          className={metricShell}
        />
        <ActivityStatDisplay
          label={t('activity.mining.loot')}
          value={formatCurrencyValue(miningTotalValue)}
          subValue="isk"
          variant="default"
          size="compact"
          valueClassName="text-white"
          icon={<TrendingUp className={cn('h-3 w-3', colors.text)} />}
          className={metricShell}
        />
        <ActivityStatDisplay
          label={t('activity.mining.efficiency')}
          value={formatCurrencyValue(metrics.iskPerHour)}
          subValue="isk/h"
          variant="default"
          size="compact"
          valueClassName="text-white"
          icon={<Clock3 className={cn('h-3 w-3', colors.text)} />}
          className={cn(metricShell, 'cursor-pointer ring-1 ring-amber-500/25 hover:ring-amber-400/50 transition-all')}
          onClick={() => setAnalyticsOpen(true)}
        />
      </div>
    </div>
  )

  const topOresSection = (
    <div className={cn('rounded-xl p-3 bg-zinc-950/40', colors.border)}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[8px] text-zinc-500 uppercase font-black tracking-wider">{t('activity.mining.topOres')}</p>
        <TrendIcon className={cn('h-3 w-3', trendColor)} />
      </div>
      <div className="space-y-1.5">
        {top3Ores.length > 0 ? (
          top3Ores.map((ore) => (
            <div key={ore.typeId} className="flex items-center gap-2">
              <Image
                src={ore.image}
                alt=""
                width={32}
                height={32}
                className="h-5 w-5 rounded bg-zinc-900 border border-zinc-800"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-zinc-300 font-bold truncate leading-none">{ore.name}</p>
                <p className="text-[8px] text-zinc-500 font-mono mt-0.5">
                  {formatCompactNumber(ore.quantity)} {t('activity.mining.units')}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={cn('text-[10px] font-mono font-bold leading-none', colors.text)}>{formatCurrencyValue(ore.value)}</p>
                <p className="text-[8px] text-zinc-500 font-mono mt-0.5">{formatCurrencyValue(ore.perUnit)}/u</p>
              </div>
            </div>
          ))
        ) : isSyncing ? (
          <div className="py-4 text-center">
            <p className="text-[10px] text-amber-500/80 font-black uppercase tracking-widest">{t('activity.mining.initializing') || 'Initializing...'}</p>
          </div>
        ) : (
          <div className="py-4 text-center">
            <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">{t('activity.mining.noExtractionData')}</p>
          </div>
        )}
      </div>
    </div>
  )

  const fullOresList = (
    <div className={cn('rounded-2xl p-4 relative overflow-hidden bg-zinc-950/40', colors.border)}>
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center gap-2">
          <div className={cn('h-3 w-1 rounded-full', 'bg-amber-500')} />
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
              className="flex justify-between items-center text-[11px] p-2.5 bg-zinc-900/20 border border-white/[0.02] rounded-xl hover:bg-zinc-900/40 transition-colors group/item"
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
                    <span className="text-[9px] font-mono font-bold text-emerald-500/80">{formatISK(oreBreakdown[typeId]?.buy || 0)}</span>
                    <span className="text-[8px] text-zinc-600 font-black uppercase tracking-widest">{t('activity.mining.sell')}</span>
                    <span className="text-[9px] font-mono font-bold text-cyan-500/80">{formatISK(oreBreakdown[typeId]?.sell || 0)}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="font-mono font-black text-amber-200/90">{formatCurrencyValue(value)}</span>
                <span className="text-[8px] font-mono text-zinc-500">{formatCurrencyValue(perUnit)}/u</span>
                <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500/50 rounded-full transition-all duration-500"
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
    <div className="space-y-4 animate-in fade-in duration-500">
      {statsGrid}
      {displayMode === 'compact' ? topOresSection : fullOresList}

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

      <MiningAnalyticsModal open={analyticsOpen} onOpenChange={setAnalyticsOpen} activity={activity} />

      <ConfirmEndModal open={confirmEndOpen} onOpenChange={setConfirmEndOpen} onConfirm={handleConfirmEnd} />
    </div>
  )
}

