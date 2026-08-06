'use client'

import { useState, useEffect, useMemo } from 'react'
import { formatISK, formatNumber, cn } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Package, Gem, TrendingUp, Clock, Info, ChevronDown, Users } from 'lucide-react'
import { ActivityStatDisplay } from '../shared/ActivityStatDisplay'
import Image from 'next/image'
import { useTranslations } from '@/i18n/hooks'
import { ActivityEnhanced, MiningActivityData, MiningLogEntry } from '@/types/domain'
import { getActivityFinancialMetrics } from '@/lib/activities/activity-metrics'
import { getActivityDurationMs } from '@/lib/activities/activity-duration'

interface MiningSummaryPanelProps {
  activity: ActivityEnhanced
  logs: MiningLogEntry[]
  viewMode: 'detailed' | 'compact'
}

interface CharacterGroup {
  charId: number;
  charName: string;
  ores: Record<string, {
    oreName: string;
    typeId: number;
    quantity: number;
    m3: number;
    value: number;
  }>;
  totalValue: number;
  totalM3: number;
}

interface OreSummary {
  oreName: string;
  typeId: number;
  quantity: number;
  m3: number;
  value: number;
}

export function MiningSummaryPanel({ activity, logs, viewMode }: MiningSummaryPanelProps) {
  const { t } = useTranslations()
  const [mounted, setMounted] = useState(false)
  const [expandedChars, setExpandedChars] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleChar = (charId: number) => {
    setExpandedChars(prev => ({
      ...prev,
      [charId]: !prev[charId]
    }))
  }

  const groupedByCharacter = useMemo(() => {
    const groups: Record<string, CharacterGroup> = {}

    logs.forEach(log => {
      const charId = log.characterId || log.charId || 0
      const charName = log.characterName || log.charName || t('activity.character.deleted')
      const val = log.estimatedValue || log.value || 0
      const vol = log.volumeValue || log.m3 || 0
      
      if (!groups[charId]) {
        groups[charId] = {
          charId,
          charName,
          ores: {},
          totalValue: 0,
          totalM3: 0
        }
      }

      const oreKey = log.oreName || t('activity.unknownOre')
      if (!groups[charId].ores[oreKey]) {
        groups[charId].ores[oreKey] = {
          oreName: oreKey,
          typeId: log.typeId,
          quantity: 0,
          m3: 0,
          value: 0
        }
      }

      groups[charId].ores[oreKey].quantity += (log.quantity || 0)
      groups[charId].ores[oreKey].m3 += vol
      groups[charId].ores[oreKey].value += val
      
      groups[charId].totalValue += val
      groups[charId].totalM3 += vol
    })

    return Object.values(groups).sort((a, b) => b.totalValue - a.totalValue)
  }, [logs, t])

  const globalOreSummary = useMemo(() => {
    const globalOres: Record<string, OreSummary> = {}
    logs.forEach(log => {
      const oreKey = log.oreName || t('activity.unknownOre')
      const val = log.estimatedValue || log.value || 0
      const vol = log.volumeValue || log.m3 || 0

      if (!globalOres[oreKey]) {
        globalOres[oreKey] = { oreName: oreKey, typeId: log.typeId, quantity: 0, m3: 0, value: 0 }
      }
      globalOres[oreKey].quantity += (log.quantity || 0)
      globalOres[oreKey].m3 += vol
      globalOres[oreKey].value += val
    })
    return Object.values(globalOres).sort((a, b) => b.value - a.value)
  }, [logs, t])

  const metrics = useMemo(() => getActivityFinancialMetrics(activity), [activity])

  if (!mounted) return null

  const totalFromLogs = globalOreSummary.reduce((sum, ore) => sum + ore.value, 0)
  const totalM3FromLogs = globalOreSummary.reduce((sum, ore) => sum + ore.m3, 0)
  const miningData = activity.data as MiningActivityData
  const totalValue = totalFromLogs > 0 ? totalFromLogs : metrics.miningValue
  const totalM3 = totalM3FromLogs > 0 ? totalM3FromLogs : miningData.totalQuantity || 0
  
  const durationMs = useMemo(
    () =>
      getActivityDurationMs({
        startTime: activity.startTime,
        endTime: activity.endTime,
        status: activity.status,
        updatedAt: activity.updatedAt,
        accumulatedPausedTime: activity.accumulatedPausedTime,
        isPaused: activity.isPaused,
        pausedAt: activity.pausedAt,
      }),
    [
      activity.startTime,
      activity.endTime,
      activity.status,
      activity.updatedAt,
      activity.accumulatedPausedTime,
      activity.isPaused,
      activity.pausedAt,
    ]
  )
  const hours = Math.max(0.1, durationMs / 3_600_000)
  const m3PerHour = totalM3 / hours
  const iskPerHour = totalValue / hours
  const pilotsCount = activity.participants?.length || 0

  const fleetAggregateRow: CharacterGroup | null =
    groupedByCharacter.length === 0 && metrics.miningValue > 0
      ? {
          charId: -1,
          charName: t('activity.summary.fleetAggregate'),
          ores: {},
          totalValue: metrics.miningValue,
          totalM3: miningData.totalQuantity || 0,
        }
      : null
  const personnelRows = fleetAggregateRow ? [fleetAggregateRow] : groupedByCharacter

  if (logs.length === 0 && metrics.miningValue <= 0) {
    return (
      <div className="py-24 text-center border border-zinc-900 bg-black rounded-none">
        <Package className="h-12 w-12 text-zinc-800 mx-auto mb-4 opacity-20" />
        <p className="text-zinc-500 text-sm font-medium">{t('activity.summary.noExtractionData')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-12">
      {/* Global Results Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <ActivityStatDisplay
          label={t('activity.summary.grossYield')}
          value={totalM3}
          subValue="m³"
          variant="default"
          formatAsNumber
          icon={<Package className="h-4 w-4" />}
        />
        <ActivityStatDisplay
          label={t('activity.summary.grossRevenue')}
          value={totalValue}
          variant="success"
          formatAsISK
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <ActivityStatDisplay
          label={t('activity.summary.yieldPerHour')}
          value={m3PerHour}
          subValue="m³/h"
          variant="default"
          formatAsNumber
          icon={<Info className="h-4 w-4" />}
        />
        <ActivityStatDisplay
          label={t('activity.summary.revenuePerHour')}
          value={iskPerHour}
          subValue="ISK/h"
          variant="default"
          formatAsISK
          icon={<Clock className="h-4 w-4" />}
        />
        <ActivityStatDisplay
          label={t('common.session.pilots')}
          value={pilotsCount}
          variant="default"
          formatAsNumber
          icon={<Users className="h-4 w-4" />}
        />
      </div>

      {/* Global Inventory Summary */}
      {logs.length > 0 && (
      <div className="bg-black border border-zinc-900 rounded-none overflow-hidden p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
           <div className="flex items-center gap-4">
              <div className="p-3 bg-zinc-900 rounded-none border border-zinc-800">
                 <Gem className="h-5 w-5 text-zinc-400" />
              </div>
              <div>
                 <h3 className="text-sm font-semibold text-zinc-300">{t('activity.summary.consolidatedCargo')}</h3>
                 <p className="text-xs text-zinc-500 font-medium mt-1">{t('activity.summary.fleetExtraction')}</p>
              </div>
           </div>
           <div className="bg-zinc-900 px-4 py-2 rounded-none border border-zinc-800">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{t('activity.summary.oreTypes')}: {globalOreSummary.length}</span>
           </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {globalOreSummary.slice(0, 18).map((ore, i) => (
              <div 
                key={i}
                className="flex items-center gap-3 bg-zinc-900/50 p-3 rounded-none border border-zinc-800 hover:border-zinc-700 transition-colors"
              >
                 <div className="relative flex-shrink-0">
                   <Image 
                      src={`https://images.evetech.net/types/${ore.typeId}/icon?size=64`} 
                      width={40}
                      height={40}
                      className="h-8 w-8 relative z-10" 
                      alt={ore.oreName} 
                   />
                 </div>
                <div className="min-w-0">
                   <p className="text-[11px] font-semibold text-zinc-300 truncate">{ore.oreName}</p>
                   <p className="text-[11px] font-medium text-zinc-500 mt-1">
                    {formatNumber(ore.m3)}<span className="text-[9px] ml-1 uppercase">m³</span>
                   </p>
                </div>
              </div>
            ))}
        </div>
      </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-2">
           <h4 className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 shrink-0">{t('activity.summary.personnelLogs')}</h4>
           <div className="h-[1px] flex-1 bg-zinc-800" />
        </div>

        <div className="grid grid-cols-1 gap-4">
          {personnelRows.map((group, idx) => (
            <div 
              key={group.charId}
              className="bg-black border border-zinc-900 rounded-none overflow-hidden shadow-sm hover:border-zinc-700 transition-colors"
            >
              <div 
                onClick={() => toggleChar(group.charId)}
                className={cn(
                  "px-6 py-5 flex flex-col xl:flex-row xl:items-center justify-between gap-6 cursor-pointer",
                  (viewMode === 'detailed' || expandedChars[group.charId]) ? "bg-zinc-900/50 border-b border-zinc-800" : "hover:bg-zinc-900/30"
                )}
              >
                <div className="flex items-center gap-6">
                  <Avatar className="h-12 w-12 border border-zinc-800 rounded-none">
                    {group.charId > 0 && (
                      <AvatarImage src={`https://images.evetech.net/characters/${group.charId}/portrait?size=128`} />
                    )}
                    <AvatarFallback className="bg-zinc-900 text-zinc-600 text-xs">{(group.charName || '??').slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-white truncate">{group.charName}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-[11px] text-zinc-500 font-medium flex items-center gap-2">
                        {formatNumber(Math.round(group.totalM3))} <span className="text-zinc-600">M³</span>
                      </p>
                      <div className="h-3 w-[1px] bg-zinc-800" />
                      <p className="text-[11px] text-zinc-500 font-medium">
                        {Object.keys(group.ores).length} {t('activity.summary.protocols')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-row items-center justify-between xl:justify-end gap-6">
                  <div className="text-left xl:text-right">
                    <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider mb-0.5">{t('activity.summary.grossRevenue')}</p>
                    <p className="text-xl font-bold text-white tabular-nums truncate">{formatISK(group.totalValue)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8 rounded-none border border-zinc-800",
                      (viewMode === 'detailed' || expandedChars[group.charId]) ? "bg-zinc-800 text-white" : "text-zinc-500"
                    )}
                  >
                    <ChevronDown className={cn("h-4 w-4 transition-transform", (viewMode === 'detailed' || expandedChars[group.charId]) && "rotate-180")} />
                  </Button>
                </div>
              </div>

              {(viewMode === 'detailed' || expandedChars[group.charId]) && (
                <div className="overflow-hidden bg-black/50">
                  <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.values(group.ores).map((ore, i) => (
                      <div 
                        key={i}
                        className="flex items-center justify-between p-4 rounded-none border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                           <Image 
                              src={`https://images.evetech.net/types/${ore.typeId}/icon?size=64`} 
                              width={32}
                              height={32}
                              className="h-8 w-8" 
                              alt={ore.oreName} 
                           />
                          <div className="min-w-0">
                             <p className="text-[11px] font-semibold text-zinc-300 truncate">{ore.oreName}</p>
                             <p className="text-[11px] font-medium text-zinc-500 mt-1">
                               {formatNumber(ore.m3)}<span className="text-[9px] ml-1 uppercase">m³</span>
                             </p>
                          </div>
                        </div>
                        <div className="text-right">
                           <span className="text-xs font-semibold text-zinc-300">{formatISK(ore.value)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
