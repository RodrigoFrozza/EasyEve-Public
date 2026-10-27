import {
  MIN_GLOBAL_SAMPLE_EVENTS,
  computeDropRatePct,
  buildDimensionRows,
  buildItemRows,
  LOOT_INTEL_ALL_SPACES,
  splitDurationByValue,
  resolveIngestedDurationMs,
  clampLootIntelValue,
  LOOT_INTEL_MAX_EVENT_VALUE,
} from '@/lib/analytics/loot-intel-shared'
import { Prisma } from '@prisma/client'

describe('loot-intel-shared', () => {
  it('computeDropRatePct returns zero when no events', () => {
    expect(computeDropRatePct(3, 0)).toBe(0)
  })

  it('clampLootIntelValue caps an absurd client-supplied value at the sanity ceiling', () => {
    expect(clampLootIntelValue(9e15)).toBe(LOOT_INTEL_MAX_EVENT_VALUE)
  })

  it('clampLootIntelValue passes through realistic values unchanged', () => {
    expect(clampLootIntelValue(1_500_000)).toBe(1_500_000)
  })

  it('clampLootIntelValue treats negative/non-finite values as zero', () => {
    expect(clampLootIntelValue(-500)).toBe(0)
    expect(clampLootIntelValue(NaN)).toBe(0)
    expect(clampLootIntelValue(Infinity)).toBe(0)
  })

  it('computeDropRatePct returns percentage', () => {
    expect(computeDropRatePct(10, 40)).toBe(25)
  })

  it('buildDimensionRows sorts by ISK/h when requested', () => {
    const rows = buildDimensionRows(
      [
        {
          npcFaction: 'Guristas',
          spaceType: LOOT_INTEL_ALL_SPACES,
          totalEvents: 30,
          totalValue: new Prisma.Decimal(3_000_000),
          totalDurationMs: BigInt(3_600_000),
        },
        {
          npcFaction: 'Angel Cartel',
          spaceType: LOOT_INTEL_ALL_SPACES,
          totalEvents: 50,
          totalValue: new Prisma.Decimal(10_000_000),
          totalDurationMs: BigInt(3_600_000),
        },
      ] as never,
      (r) => ({ key: r.npcFaction, label: r.npcFaction }),
      { sortBy: 'iskPerHour', minSample: MIN_GLOBAL_SAMPLE_EVENTS }
    )

    expect(rows[0].label).toBe('Angel Cartel')
    expect(rows[0].avgIskPerHour).toBe(10_000_000)
    expect(rows[0].sampleSufficient).toBe(true)
  })

  it('resolveIngestedDurationMs prefers stored snapshot', () => {
    expect(resolveIngestedDurationMs(BigInt(3600), 7200)).toBe(3600)
    expect(resolveIngestedDurationMs(null, 7200)).toBe(7200)
  })

  it('splitDurationByValue splits proportionally by ISK', () => {
    const split = splitDurationByValue(3_600_000, [
      { key: 1, value: 8_000 },
      { key: 2, value: 4_000 },
    ])
    expect(split.get(1)).toBe(2_400_000)
    expect(split.get(2)).toBe(1_200_000)
    expect([...split.values()].reduce((a, b) => a + b, 0)).toBe(3_600_000)
  })

  it('splitDurationByValue splits equally when values are zero', () => {
    const split = splitDurationByValue(100, [
      { key: 'a', value: 0 },
      { key: 'b', value: 0 },
    ])
    expect(split.get('a')).toBe(50)
    expect(split.get('b')).toBe(50)
  })

  it('buildItemRows computes drop rate and avg value', () => {
    const items = buildItemRows(
      [
        {
          typeId: 42,
          itemName: 'Test Item',
          eventsWithItem: 5,
          totalQuantity: 10,
          totalValue: new Prisma.Decimal(500_000),
        },
      ],
      25
    )

    expect(items[0].dropRatePct).toBe(20)
    expect(items[0].avgValuePerAppearance).toBe(100_000)
  })
})
