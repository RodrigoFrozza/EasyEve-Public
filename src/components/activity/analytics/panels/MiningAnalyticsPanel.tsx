'use client'

import { useCallback, useMemo, useState } from 'react'
import type { Activity } from '@/lib/stores/activity-store'
import { ACTIVITY_COLORS } from '@/lib/constants/activity-colors'
import { getActivityTheme } from '@/lib/activity/activity-theme'
import {
  buildCharacterBreakdown,
  buildCharacterBreakdownFromParticipantData,
  buildMiningComposition,
  buildSessionTimeline,
  getCharacterKey,
  type SparklineDataset,
} from '@/lib/activity/activity-analytics'
import { useActivityAnalytics } from '../useActivityAnalytics'
import {
  useMiningSessionValuation,
  getLogValuationValue,
  type ChartValuationMode,
} from '../useMiningSessionValuation'
import { ActivityAnalyticsCharacterFilter } from '../ActivityAnalyticsCharacterFilter'
import { ActivityAnalyticsChart } from '../ActivityAnalyticsChart'
import { ActivityAnalyticsComposition } from '../ActivityAnalyticsComposition'
import { ActivityAnalyticsBreakdownList } from '../ActivityAnalyticsBreakdownList'
import { MiningValuationHero } from '../MiningValuationHero'
import { MiningValuationOreTable } from '../MiningValuationOreTable'
import { formatCompactNumber, formatCurrencyValue, cn } from '@/lib/utils'
import { aggregateBaselinesByTypeId } from '@/lib/esi/mining-ledger'
import { useMiningLootIntel } from '@/lib/hooks/use-mining-loot-intel'
import { useTranslations } from '@/i18n/hooks'
import { LootIntelSessionBlock } from '../LootIntelSessionBlock'
import { analyticsPanelSurface } from '@/lib/activity/activity-analytics-surface'

function ValuationModeToggle({
  theme,
  mode,
  onChange,
}: {
  theme: ReturnType<typeof getActivityTheme>
  mode: ChartValuationMode
  onChange: (mode: ChartValuationMode) => void
}) {
  const { t } = useTranslations()
  const modes: ChartValuationMode[] = ['raw', 'refined']

  return (
    <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.04] p-0.5">
      {modes.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn(
            'rounded-md px-2.5 py-1 font-mono text-[8px] font-bold uppercase tracking-wide transition-colors',
            mode === m
              ? cn(
                  'bg-white/10',
                  m === 'raw' ? 'text-emerald-400' : 'text-cyan-400'
                )
              : 'text-zinc-500 hover:text-zinc-300'
          )}
        >
          {t(`activity.analytics.mining.chartMode${m.charAt(0).toUpperCase()}${m.slice(1)}`)}
        </button>
      ))}
    </div>
  )
}

export function MiningAnalyticsPanel({ activity }: { activity: Activity }) {
  const theme = getActivityTheme('mining')
  const colors = ACTIVITY_COLORS.mining
  const { t } = useTranslations()
  const miningType = String((activity.data as { miningType?: string })?.miningType || 'Ore')
  const { data: globalIntel, loading: globalLoading } = useMiningLootIntel(
    { scope: 'global', category: miningType },
    true
  )
  const { logs, participantBreakdown } = useActivityAnalytics(activity)
  const {
    efficiencyPct,
    setEfficiencyPct,
    priceSide,
    setPriceSide,
    valuation,
    valuationByTypeId,
    loading: valuationLoading,
  } = useMiningSessionValuation(activity)

  const [selectedCharacter, setSelectedCharacter] = useState('all')
  const [chartMode, setChartMode] = useState<ChartValuationMode>('raw')

  const activityData = (activity.data || {}) as Record<string, unknown>
  const oreBreakdownData = (activityData.oreBreakdown || {}) as Record<
    string,
    { volumeValue?: number }
  >

  const excludedBaselineByTypeId = useMemo(() => {
    const baselines = (activityData.baselines || {}) as Record<string, number>
    const dateOnly = new Date(activity.startTime).toISOString().split('T')[0]
    return aggregateBaselinesByTypeId(baselines, dateOnly)
  }, [activityData.baselines, activity.startTime])

  const volumeByTypeId = useMemo(() => {
    const map: Record<number, number> = {}
    for (const [typeId, entry] of Object.entries(oreBreakdownData)) {
      const vol = Number(entry.volumeValue) || 0
      if (vol > 0) map[Number(typeId)] = vol
    }
    return map
  }, [oreBreakdownData])

  const byCharacter = useMemo(() => {
    const fromParticipants = Object.keys(participantBreakdown).length
      ? buildCharacterBreakdownFromParticipantData(activity, participantBreakdown)
      : buildCharacterBreakdown(activity, logs, 'mining', {
          getVolume: (l) => Number((l as { volumeValue?: number }).volumeValue) || 0,
        })
    return fromParticipants
  }, [activity, logs, participantBreakdown])

  const filteredLogs = useMemo(() => {
    if (selectedCharacter === 'all') return logs
    return logs.filter((l) => getCharacterKey(l) === selectedCharacter)
  }, [logs, selectedCharacter])

  const getLogValue = useCallback(
    (log: { typeId?: number | string; quantity?: number; estimatedValue?: number; value?: number }) =>
      getLogValuationValue(log, valuationByTypeId, chartMode),
    [valuationByTypeId, chartMode]
  )

  const timelinePoints = useMemo(
    () => buildSessionTimeline(activity, filteredLogs, 'mining', getLogValue),
    [activity, filteredLogs, getLogValue]
  )

  const chartDatasets = useMemo((): SparklineDataset[] => {
    const ordered = [...filteredLogs].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    if (ordered.length < 2) return []

    const topOres = valuation.byOre.slice(0, 5)
    const variants = ['#67e8f9', '#22d3ee', '#06b6d4', '#0891b2', '#0e7490']
    const oreAccs: Record<string, number> = {}
    const oreData: Record<string, number[]> = {}
    topOres.forEach((ore) => {
      oreAccs[ore.typeId] = 0
      oreData[ore.typeId] = []
    })

    let totalAcc = 0
    const totalData: number[] = []

    ordered.forEach((log) => {
      const logValue = getLogValuationValue(log, valuationByTypeId, chartMode)
      totalAcc += logValue
      totalData.push(totalAcc)
      topOres.forEach((ore) => {
        if (String(log.typeId) === String(ore.typeId)) {
          oreAccs[ore.typeId] += logValue
        }
        oreData[ore.typeId].push(oreAccs[ore.typeId])
      })
    })

    const datasets: SparklineDataset[] = topOres.map((ore, idx) => ({
      label: ore.name,
      data: oreData[ore.typeId],
      color: variants[idx % variants.length],
    }))
    datasets.push({ label: 'Total', data: totalData, color: colors.sparkline })
    return datasets.filter((d) => d.data.length >= 2)
  }, [filteredLogs, valuation.byOre, valuationByTypeId, chartMode, colors.sparkline])

  const composition = useMemo(() => {
    // valuation.byOre is a fleet-wide aggregate (activity.data.oreBreakdown has no
    // per-character split) — when a pilot is selected, rebuild the ore breakdown from
    // that pilot's own logs instead, otherwise the composition keeps showing the whole
    // fleet's numbers while the chart right next to it is already filtered.
    if (selectedCharacter !== 'all') {
      const perOre = new Map<string, { name: string; isk: number }>()
      for (const log of filteredLogs) {
        const typeId = String((log as { typeId?: number | string }).typeId ?? '')
        if (!typeId) continue
        const isk = getLogValuationValue(log, valuationByTypeId, chartMode)
        if (isk <= 0) continue
        const name =
          valuationByTypeId.get(typeId)?.name ||
          String((log as { oreName?: string }).oreName || 'Unknown')
        const existing = perOre.get(typeId)
        if (existing) existing.isk += isk
        else perOre.set(typeId, { name, isk })
      }
      return buildMiningComposition(
        [...perOre.values()].sort((a, b) => b.isk - a.isk)
      )
    }

    const ores = valuation.byOre.map((o) => ({
      name: o.name,
      isk: chartMode === 'raw' ? o.rawIsk : o.refinedIsk,
    }))
    return buildMiningComposition(ores)
  }, [selectedCharacter, filteredLogs, valuationByTypeId, valuation.byOre, chartMode])

  const pilotRows = byCharacter.map((c) => ({
    id: c.id,
    primary: c.name,
    value: formatCurrencyValue(c.total),
    subValue: c.volume ? `${formatCompactNumber(Math.round(c.volume))} m³` : undefined,
  }))

  return (
    <div className="space-y-4">
      <MiningValuationHero
        theme={theme}
        valuation={valuation}
        priceSide={priceSide}
        onPriceSideChange={setPriceSide}
        efficiencyPct={efficiencyPct}
        onEfficiencyChange={setEfficiencyPct}
        loading={valuationLoading}
      />

      <ActivityAnalyticsCharacterFilter
        theme={theme}
        characters={byCharacter}
        selectedId={selectedCharacter}
        onSelect={setSelectedCharacter}
      />

      <div className={cn(analyticsPanelSurface(theme), 'flex flex-wrap items-center justify-between gap-2 py-3')}>
        <span className={cn('font-mono text-[9px] font-bold uppercase tracking-wide', theme.textMuted)}>
          {t('activity.analytics.mining.chartValuationMode')}
        </span>
        <ValuationModeToggle theme={theme} mode={chartMode} onChange={setChartMode} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActivityAnalyticsChart theme={theme} points={timelinePoints} datasets={chartDatasets} />
        </div>
        <ActivityAnalyticsComposition theme={theme} slices={composition} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ActivityAnalyticsBreakdownList theme={theme} titleKey="pilotMetrics" rows={pilotRows} />
        <MiningValuationOreTable
          theme={theme}
          rows={valuation.byOre}
          excludedBaselineByTypeId={excludedBaselineByTypeId}
          volumeByTypeId={volumeByTypeId}
          isAutoTracked={Boolean(activityData.isAutoTracked)}
        />
      </div>

      <LootIntelSessionBlock
        theme={theme}
        intelHref="/dashboard/analytics/mining"
        viewFullIntelKey="activity.mining.intel.viewFullIntel"
        sessionVsCommunityKey="activity.mining.intel.sessionVsCommunity"
        dimensionLabel={t('activity.mining.miningType')}
        communityAvgKey="activity.mining.intel.communityAvgPerEvent"
        topDropsKey="activity.mining.intel.topDropsGlobal"
        data={globalIntel}
        loading={globalLoading}
        sessionMetrics={[
          {
            label: t('activity.mining.miningType'),
            value: miningType,
          },
        ]}
      />
    </div>
  )
}
