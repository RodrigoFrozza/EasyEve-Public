import { normalizeLootIntelDisplay } from '@/lib/analytics/normalize-loot-intel-display'
import type { SalvageIntelResponse } from '@/lib/analytics/salvaging-intel'

describe('normalizeLootIntelDisplay', () => {
  it('maps salvaging factionRanking to dimensionRanking without throwing', () => {
    const salvage: SalvageIntelResponse = {
      meta: {
        minSampleBatches: 20,
        generatedAt: '2026-01-01T00:00:00Z',
        scope: 'global',
        sampleSufficient: false,
        totalBatches: 5,
      },
      factionRanking: [
        {
          npcFaction: 'Guristas',
          spaceType: '',
          totalBatches: 5,
          totalValue: 1_000_000,
          avgIskPerBatch: 200_000,
          avgIskPerHour: 1_000_000,
          sampleSufficient: false,
        },
      ],
      items: [],
      filters: { factions: [], spaces: [] },
    }

    const intel = normalizeLootIntelDisplay(salvage)
    expect(intel?.dimensionRanking?.[0]?.label).toBe('Guristas')
    expect(intel?.meta.minSampleEvents).toBe(20)
    expect(intel?.meta.totalEvents).toBe(5)
  })

  it('returns null for undefined input', () => {
    expect(normalizeLootIntelDisplay(undefined)).toBeNull()
  })
})
