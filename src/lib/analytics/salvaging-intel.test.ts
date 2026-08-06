import {
  MIN_GLOBAL_SAMPLE_BATCHES,
  computeDropRatePct,
  buildFactionRankingFromRollups,
  buildItemRowsFromRollups,
  SALVAGE_INTEL_ALL_SPACES,
} from '@/lib/analytics/salvaging-intel'
import type { SalvageFactionRollup, SalvageItemRollup } from '@prisma/client'
import { Prisma } from '@prisma/client'

function factionRollup(
  partial: Partial<SalvageFactionRollup> & Pick<SalvageFactionRollup, 'npcFaction' | 'spaceType' | 'totalBatches'>
): SalvageFactionRollup {
  return {
    id: '1',
    totalValue: new Prisma.Decimal(1_000_000),
    totalDurationMs: BigInt(3_600_000),
    ...partial,
  } as SalvageFactionRollup
}

function itemRollup(
  partial: Partial<SalvageItemRollup> &
    Pick<SalvageItemRollup, 'npcFaction' | 'spaceType' | 'typeId' | 'itemName' | 'batchesWithItem'>
): SalvageItemRollup {
  return {
    id: '1',
    totalQuantity: 10,
    totalValue: new Prisma.Decimal(500_000),
    ...partial,
  } as SalvageItemRollup
}

describe('computeDropRatePct', () => {
  it('returns zero when no batches', () => {
    expect(computeDropRatePct(5, 0)).toBe(0)
  })

  it('computes percentage of batches containing item', () => {
    expect(computeDropRatePct(25, 100)).toBe(25)
  })
})

describe('buildFactionRankingFromRollups', () => {
  it('ranks factions by avg ISK per batch using all-spaces bucket', () => {
    const rollups = [
      factionRollup({
        npcFaction: 'Angel Cartel',
        spaceType: SALVAGE_INTEL_ALL_SPACES,
        totalBatches: 50,
        totalValue: new Prisma.Decimal(5_000_000),
      }),
      factionRollup({
        npcFaction: 'Guristas',
        spaceType: SALVAGE_INTEL_ALL_SPACES,
        totalBatches: 40,
        totalValue: new Prisma.Decimal(6_000_000),
      }),
    ]

    const ranked = buildFactionRankingFromRollups(rollups)
    expect(ranked[0].npcFaction).toBe('Guristas')
    expect(ranked[0].avgIskPerBatch).toBe(150_000)
    expect(ranked[1].npcFaction).toBe('Angel Cartel')
    expect(ranked[0].sampleSufficient).toBe(true)
  })

  it('marks insufficient sample below threshold', () => {
    const rollups = [
      factionRollup({
        npcFaction: 'Sansha',
        spaceType: SALVAGE_INTEL_ALL_SPACES,
        totalBatches: 5,
        totalValue: new Prisma.Decimal(100_000),
      }),
    ]
    const ranked = buildFactionRankingFromRollups(rollups, { minSample: MIN_GLOBAL_SAMPLE_BATCHES })
    expect(ranked[0].sampleSufficient).toBe(false)
  })
})

describe('buildItemRowsFromRollups', () => {
  it('builds drop rates against faction batch total', () => {
    const items = [
      itemRollup({
        npcFaction: 'Blood Raider',
        spaceType: SALVAGE_INTEL_ALL_SPACES,
        typeId: 123,
        itemName: 'Wreck Salvage',
        batchesWithItem: 10,
        totalQuantity: 20,
        totalValue: new Prisma.Decimal(2_000_000),
      }),
    ]

    const rows = buildItemRowsFromRollups(items, 50, {
      factionFilter: 'Blood Raider',
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].dropRatePct).toBe(20)
    expect(rows[0].avgValuePerAppearance).toBe(200_000)
  })
})
