import { getActivityFinancialMetrics } from './activity-metrics'

describe('getActivityFinancialMetrics', () => {
  it('computes ratting gross and net with taxes', () => {
    const metrics = getActivityFinancialMetrics({
      type: 'ratting',
      data: {
        automatedBounties: 1_000_000,
        automatedEss: 200_000,
        additionalBounties: 50_000,
        estimatedLootValue: 300_000,
        estimatedSalvageValue: 100_000,
        automatedTaxes: 80_000,
      },
    })

    expect(metrics.gross).toBe(1_650_000)
    expect(metrics.net).toBe(1_570_000)
  })

  it('applies corp tax only to bounty income, not loot or salvage', () => {
    const metrics = getActivityFinancialMetrics({
      type: 'ratting',
      data: {
        automatedBounties: 100_000,
        automatedTaxes: 150_000,
        estimatedLootValue: 500_000_000,
        estimatedSalvageValue: 25_000_000,
        estimatedEscalationValue: 10_000_000,
      },
    })

    expect(metrics.gross).toBe(535_100_000)
    expect(metrics.net).toBe(535_000_000)
  })

  it('uses mining fallbacks (miningValue > totalEstimatedValue > totalValue)', () => {
    const metricsFromMiningValue = getActivityFinancialMetrics({
      type: 'mining',
      data: { miningValue: 9_000_000, totalEstimatedValue: 4_000_000, totalValue: 2_000_000 },
    })
    expect(metricsFromMiningValue.net).toBe(9_000_000)

    const metricsFromEstimated = getActivityFinancialMetrics({
      type: 'mining',
      data: { totalEstimatedValue: 4_000_000, totalValue: 2_000_000 },
    })
    expect(metricsFromEstimated.net).toBe(4_000_000)

    const metricsFromTotalValue = getActivityFinancialMetrics({
      type: 'mining',
      data: { totalValue: 2_000_000 },
    })
    expect(metricsFromTotalValue.net).toBe(2_000_000)
  })

  it('uses totalLootValue for exploration, abyssal, and salvaging', () => {
    expect(getActivityFinancialMetrics({ type: 'exploration', data: { totalLootValue: 500_000 } }).net).toBe(500_000)
    expect(getActivityFinancialMetrics({ type: 'abyssal', data: { totalLootValue: 750_000 } }).net).toBe(750_000)
    expect(getActivityFinancialMetrics({ type: 'salvaging', data: { totalLootValue: 320_000 } }).net).toBe(320_000)
  })

  it('prefers run sums over stale totalLootValue for abyssal', () => {
    const metrics = getActivityFinancialMetrics({
      type: 'abyssal',
      data: {
        totalLootValue: 999_999,
        runs: [
          { lootValue: 250_000, status: 'completed' },
          { lootValue: 50_000, status: 'success' },
        ],
      },
    })

    expect(metrics.totalLootValue).toBe(300_000)
    expect(metrics.net).toBe(300_000)
  })

  it('excludes non-completed runs (death/in-progress) from the abyssal gross total', () => {
    const metrics = getActivityFinancialMetrics({
      type: 'abyssal',
      data: {
        runs: [
          { lootValue: 250_000, status: 'completed' },
          { lootValue: 9_000_000, status: 'death' },
        ],
      },
    })

    expect(metrics.totalLootValue).toBe(250_000)
    expect(metrics.net).toBe(250_000)
  })

  it('falls back to lootValue when runs are absent', () => {
    const metrics = getActivityFinancialMetrics({
      type: 'abyssal',
      data: { lootValue: 125_000 },
    })

    expect(metrics.totalLootValue).toBe(125_000)
  })

  it('is resilient to partial/legacy payloads', () => {
    const metrics = getActivityFinancialMetrics({
      type: 'ratting',
      data: {
        grossBounties: '900000',
        estimatedLootValue: '100000',
      },
    })

    expect(metrics.gross).toBe(1_000_000)
    expect(metrics.net).toBe(1_000_000)
  })

  it('falls back to log.value for exploration site logs', () => {
    const metrics = getActivityFinancialMetrics({
      type: 'exploration',
      data: {
        logs: [
          { type: 'site', value: 250_000, date: '2024-01-01T10:00:00Z' },
          { type: 'site', value: 150_000, date: '2024-01-01T11:00:00Z' },
        ],
      },
    })

    expect(metrics.gross).toBe(400_000)
    expect(metrics.totalLootValue).toBe(400_000)
  })

  it('computes escalations net as bountyAfterTax + loot - purchase cost', () => {
    const metrics = getActivityFinancialMetrics({
      type: 'escalations',
      data: {
        automatedBounties: 100_000_000,
        automatedEss: 20_000_000,
        automatedTaxes: 10_000_000,
        estimatedEscalationLootValue: 200_000_000,
        estimatedEscalationCostValue: 50_000_000,
      },
    })

    expect(metrics.gross).toBe(320_000_000)
    expect(metrics.net).toBe(260_000_000)
  })
})
