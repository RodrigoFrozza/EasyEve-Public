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

  it('uses totalLootValue for exploration and abyssal', () => {
    expect(getActivityFinancialMetrics({ type: 'exploration', data: { totalLootValue: 500_000 } }).net).toBe(500_000)
    expect(getActivityFinancialMetrics({ type: 'abyssal', data: { totalLootValue: 750_000 } }).net).toBe(750_000)
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
})
