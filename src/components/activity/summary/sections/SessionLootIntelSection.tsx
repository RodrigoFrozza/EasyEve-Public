'use client'

import { useMemo } from 'react'
import type { ActivityEnhanced } from '@/types/domain'
import type { ActivityThemeClasses } from '@/lib/activity/activity-theme'
import { getRattingNpcFaction, getSalvagingNpcFaction } from '@/lib/constants/activity-data'
import { formatCurrencyValue } from '@/lib/utils'
import { useRattingLootIntel } from '@/lib/hooks/use-ratting-loot-intel'
import { useMiningLootIntel } from '@/lib/hooks/use-mining-loot-intel'
import { useExplorationLootIntel } from '@/lib/hooks/use-exploration-loot-intel'
import { useAbyssalLootIntel } from '@/lib/hooks/use-abyssal-loot-intel'
import { useSalvagingIntel } from '@/lib/hooks/use-salvaging-intel'
import { LootIntelSessionBlock } from '@/components/activity/analytics/LootIntelSessionBlock'
import { useTranslations } from '@/i18n/hooks'

type Props = {
  activity: ActivityEnhanced
  theme: ActivityThemeClasses
}

export function SessionLootIntelSection({ activity, theme }: Props) {
  const { t } = useTranslations()
  const data = activity.data || {}
  const isCompleted = activity.status === 'completed'
  const type = activity.type

  const salvagingFaction = getSalvagingNpcFaction(activity)
  const rattingFaction = getRattingNpcFaction(activity)
  const miningCategory = String(data.miningType || 'Ore')
  const abyssalReferenceRun = useMemo(() => {
    const runs = (data.runs || []) as Array<{
      status?: string
      tier?: string
      weather?: string
      endTime?: string
      startTime?: string
    }>
    return [...runs]
      .filter((run) => run.status === 'completed' || run.status === 'success')
      .sort(
        (a, b) =>
          new Date(b.endTime || b.startTime || 0).getTime() -
          new Date(a.endTime || a.startTime || 0).getTime()
      )[0]
  }, [data.runs])

  const abyssalTier = String(
    abyssalReferenceRun?.tier ||
      data.tier ||
      (data.lastRunDefaults as { tier?: string })?.tier ||
      ''
  )
  const abyssalWeather = String(
    abyssalReferenceRun?.weather ||
      data.weather ||
      (data.lastRunDefaults as { weather?: string })?.weather ||
      ''
  )

  const salvagingIntel = useSalvagingIntel(
    { scope: 'global', faction: salvagingFaction || undefined },
    isCompleted && type === 'salvaging' && Boolean(salvagingFaction)
  )
  const rattingIntel = useRattingLootIntel(
    { scope: 'global', faction: rattingFaction || undefined },
    isCompleted && type === 'ratting' && Boolean(rattingFaction)
  )
  const miningIntel = useMiningLootIntel(
    { scope: 'global', category: miningCategory },
    isCompleted && type === 'mining'
  )
  const explorationIntel = useExplorationLootIntel(
    { scope: 'global' },
    isCompleted && type === 'exploration'
  )
  const abyssalIntel = useAbyssalLootIntel(
    { scope: 'global', tier: abyssalTier || undefined, weather: abyssalWeather || undefined },
    isCompleted && type === 'abyssal' && Boolean(abyssalTier && abyssalWeather)
  )

  if (!isCompleted) return null

  if (type === 'salvaging') {
    return (
      <LootIntelSessionBlock
        theme={theme}
        intelHref="/dashboard/analytics/salvaging"
        viewFullIntelKey="activity.salvaging.intel.viewFullIntel"
        sessionVsCommunityKey="activity.salvaging.intel.sessionVsCommunity"
        dimensionLabel={salvagingFaction ? t('activity.salvaging.npcFaction') : ''}
        communityAvgKey="activity.salvaging.intel.communityAvgPerBatch"
        topDropsKey="activity.salvaging.intel.topDropsGlobal"
        data={salvagingIntel.data}
        loading={salvagingIntel.loading}
        sessionMetrics={
          salvagingFaction
            ? [{ label: t('activity.salvaging.npcFaction'), value: salvagingFaction }]
            : []
        }
      />
    )
  }

  if (type === 'ratting') {
    const gross =
      (Number(data.automatedBounties) || 0) +
      (Number(data.automatedEss) || 0) +
      (Number(data.additionalBounties) || 0) +
      (Number(data.estimatedLootValue) || 0) +
      (Number(data.estimatedSalvageValue) || 0)
    return (
      <LootIntelSessionBlock
        theme={theme}
        intelHref="/dashboard/analytics/ratting"
        viewFullIntelKey="activity.ratting.intel.viewFullIntel"
        sessionVsCommunityKey="activity.ratting.intel.sessionVsCommunity"
        dimensionLabel={rattingFaction ? t('activity.ratting.npcFaction') : ''}
        communityAvgKey="activity.ratting.intel.communityAvgPerHour"
        topDropsKey="activity.ratting.intel.topDropsGlobal"
        data={rattingIntel.data}
        loading={rattingIntel.loading}
        showIskPerHour
        sessionMetrics={[{ label: t('activity.analytics.grossIncome'), value: formatCurrencyValue(gross) }]}
      />
    )
  }

  if (type === 'mining') {
    return (
      <LootIntelSessionBlock
        theme={theme}
        intelHref="/dashboard/analytics/mining"
        viewFullIntelKey="activity.mining.intel.viewFullIntel"
        sessionVsCommunityKey="activity.mining.intel.sessionVsCommunity"
        dimensionLabel={t('activity.mining.miningType')}
        communityAvgKey="activity.mining.intel.communityAvgPerEvent"
        topDropsKey="activity.mining.intel.topDropsGlobal"
        data={miningIntel.data}
        loading={miningIntel.loading}
        sessionMetrics={[{ label: t('activity.mining.miningType'), value: miningCategory }]}
      />
    )
  }

  if (type === 'exploration') {
    return (
      <LootIntelSessionBlock
        theme={theme}
        intelHref="/dashboard/analytics/exploration"
        viewFullIntelKey="activity.exploration.intel.viewFullIntel"
        sessionVsCommunityKey="activity.exploration.intel.sessionVsCommunity"
        dimensionLabel=""
        communityAvgKey="activity.exploration.intel.communityAvgPerEvent"
        topDropsKey="activity.exploration.intel.topDropsGlobal"
        data={explorationIntel.data}
        loading={explorationIntel.loading}
      />
    )
  }

  if (type === 'abyssal') {
    return (
      <LootIntelSessionBlock
        theme={theme}
        intelHref="/dashboard/analytics/abyssal"
        viewFullIntelKey="activity.abyssal.intel.viewFullIntel"
        sessionVsCommunityKey="activity.abyssal.intel.sessionVsCommunity"
        dimensionLabel={abyssalTier ? `${t('activity.abyssal.tier')} ${abyssalTier}` : ''}
        communityAvgKey="activity.abyssal.intel.communityAvgPerRun"
        topDropsKey="activity.abyssal.intel.topDropsGlobal"
        data={abyssalIntel.data}
        loading={abyssalIntel.loading}
        sessionMetrics={
          abyssalTier && abyssalWeather
            ? [
                { label: t('activity.abyssal.tier'), value: abyssalTier },
                { label: t('activity.abyssal.weather'), value: abyssalWeather },
              ]
            : []
        }
      />
    )
  }

  return null
}
