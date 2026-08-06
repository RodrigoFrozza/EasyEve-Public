import type { SalvageFactionRollup, SalvageItemRollup } from '@prisma/client'

/** Empty string = all space types bucket in rollups */
export const SALVAGE_INTEL_ALL_SPACES = ''

export const MIN_GLOBAL_SAMPLE_BATCHES = 20

export type SalvageIntelFactionRow = {
  npcFaction: string
  spaceType: string
  totalBatches: number
  totalValue: number
  avgIskPerBatch: number
  avgIskPerHour: number | null
  sampleSufficient: boolean
}

export type SalvageIntelItemRow = {
  typeId: number
  itemName: string
  dropRatePct: number
  batchesWithItem: number
  totalQuantity: number
  avgValuePerAppearance: number
  totalValue: number
}

export type SalvageIntelResponse = {
  meta: {
    minSampleBatches: number
    generatedAt: string
    scope: 'global' | 'me'
    sampleSufficient: boolean
    totalBatches: number
  }
  factionRanking: SalvageIntelFactionRow[]
  items: SalvageIntelItemRow[]
  filters: {
    factions: string[]
    spaces: string[]
  }
}

export function rollupSpaceKey(spaceType: string | null | undefined): string {
  return spaceType?.trim() || SALVAGE_INTEL_ALL_SPACES
}

export function decimalToNumber(value: { toNumber?: () => number } | number | bigint): number {
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  if (value && typeof value.toNumber === 'function') return value.toNumber()
  return Number(value)
}

export function computeDropRatePct(batchesWithItem: number, factionTotalBatches: number): number {
  if (factionTotalBatches <= 0) return 0
  return (batchesWithItem / factionTotalBatches) * 100
}

export function buildFactionRankingFromRollups(
  rollups: SalvageFactionRollup[],
  options?: { spaceFilter?: string; minSample?: number }
): SalvageIntelFactionRow[] {
  const minSample = options?.minSample ?? MIN_GLOBAL_SAMPLE_BATCHES
  const spaceFilter = options?.spaceFilter?.trim()

  const rows = rollups
    .filter((r) => {
      if (spaceFilter) return r.spaceType === spaceFilter
      return r.spaceType === SALVAGE_INTEL_ALL_SPACES
    })
    .map((r) => {
      const totalBatches = r.totalBatches
      const totalValue = decimalToNumber(r.totalValue)
      const durationMs = decimalToNumber(r.totalDurationMs)
      const avgIskPerBatch = totalBatches > 0 ? totalValue / totalBatches : 0
      const hours = durationMs > 0 ? durationMs / 3_600_000 : 0
      const avgIskPerHour = hours > 0 ? totalValue / hours : null

      return {
        npcFaction: r.npcFaction,
        spaceType: r.spaceType,
        totalBatches,
        totalValue,
        avgIskPerBatch,
        avgIskPerHour,
        sampleSufficient: totalBatches >= minSample,
      }
    })

  return rows.sort((a, b) => b.avgIskPerBatch - a.avgIskPerBatch)
}

export function buildItemRowsFromRollups(
  itemRollups: SalvageItemRollup[],
  factionTotalBatches: number,
  options?: { spaceFilter?: string; factionFilter?: string }
): SalvageIntelItemRow[] {
  const faction = options?.factionFilter?.trim()
  const spaceFilter = options?.spaceFilter?.trim()
  const spaceKey = spaceFilter || SALVAGE_INTEL_ALL_SPACES

  return itemRollups
    .filter((r) => {
      if (faction && r.npcFaction !== faction) return false
      return r.spaceType === spaceKey
    })
    .map((r) => {
      const batchesWithItem = r.batchesWithItem
      const totalValue = decimalToNumber(r.totalValue)
      return {
        typeId: r.typeId,
        itemName: r.itemName,
        dropRatePct: computeDropRatePct(batchesWithItem, factionTotalBatches),
        batchesWithItem,
        totalQuantity: r.totalQuantity,
        avgValuePerAppearance:
          batchesWithItem > 0 ? totalValue / batchesWithItem : 0,
        totalValue,
      }
    })
    .sort((a, b) => b.dropRatePct - a.dropRatePct || b.totalValue - a.totalValue)
}
