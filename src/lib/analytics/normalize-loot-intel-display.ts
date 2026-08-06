import type { LootIntelResponse, LootIntelDimensionRow } from '@/lib/analytics/loot-intel-shared'
import type { SalvageIntelResponse } from '@/lib/analytics/salvaging-intel'

export type LootIntelDisplayPayload = LootIntelResponse | SalvageIntelResponse | null | undefined

function mapSalvagingToDisplay(data: SalvageIntelResponse): LootIntelResponse {
  const dimensionRanking: LootIntelDimensionRow[] = (data.factionRanking ?? []).map((f) => ({
    key: f.npcFaction,
    label: f.npcFaction,
    subLabel: f.spaceType || undefined,
    totalEvents: f.totalBatches,
    totalValue: f.totalValue,
    avgValuePerEvent: f.avgIskPerBatch,
    avgIskPerHour: f.avgIskPerHour,
    sampleSufficient: f.sampleSufficient,
  }))

  return {
    meta: {
      minSampleEvents: data.meta.minSampleBatches,
      generatedAt: data.meta.generatedAt,
      scope: data.meta.scope,
      sampleSufficient: data.meta.sampleSufficient,
      totalEvents: data.meta.totalBatches,
    },
    dimensionRanking,
    items: (data.items ?? []).map((i) => ({
      typeId: i.typeId,
      itemName: i.itemName,
      dropRatePct: i.dropRatePct,
      eventsWithItem: i.batchesWithItem,
      totalQuantity: i.totalQuantity,
      avgValuePerAppearance: i.avgValuePerAppearance,
      totalValue: i.totalValue,
    })),
    filters: {
      factions: data.filters?.factions ?? [],
      spaces: data.filters?.spaces ?? [],
    },
  }
}

/** Unify salvaging (factionRanking) and v2 loot intel (dimensionRanking) for shared UI. */
export function normalizeLootIntelDisplay(data: LootIntelDisplayPayload): LootIntelResponse | null {
  if (!data) return null

  if ('dimensionRanking' in data && Array.isArray(data.dimensionRanking)) {
    return {
      ...data,
      dimensionRanking: data.dimensionRanking ?? [],
      items: data.items ?? [],
      meta: {
        ...data.meta,
        minSampleEvents:
          data.meta.minSampleEvents ?? (data.meta as { minSampleBatches?: number }).minSampleBatches ?? 20,
        totalEvents:
          data.meta.totalEvents ?? (data.meta as { totalBatches?: number }).totalBatches ?? 0,
      },
    }
  }

  if ('factionRanking' in data && Array.isArray(data.factionRanking)) {
    return mapSalvagingToDisplay(data as SalvageIntelResponse)
  }

  return null
}
