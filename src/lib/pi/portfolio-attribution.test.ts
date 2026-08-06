import {
  computeCharacterNetIsk,
  computePortfolioFinancialTotals,
  computePortfolioTotals,
} from '@/lib/pi/portfolio-attribution'
import type { PiColonyAnalysis } from '@/lib/pi/types'

function colony(
  planetId: number,
  characterId: number,
  potentialNet: number,
  currentNet = potentialNet
): PiColonyAnalysis {
  return {
    planetId,
    characterId,
    potentialNetIskPerHour: potentialNet,
    currentNetIskPerHour: currentNet,
    potentialExportRevenuePerHour: potentialNet,
    potentialImportCostPerHour: 0,
    potentialExportTaxPerHour: 0,
    currentExportRevenuePerHour: currentNet,
    currentImportCostPerHour: 0,
    currentExportTaxPerHour: 0,
  } as PiColonyAnalysis
}

describe('portfolio-attribution (standalone colonies, no networks)', () => {
  it('sums every colony into the portfolio totals', () => {
    const colonies = [colony(1, 100, 50), colony(2, 100, -20), colony(3, 200, 30)]
    const totals = computePortfolioTotals(colonies)
    expect(totals.potentialNetIskPerHour).toBe(60)
    expect(totals.currentNetIskPerHour).toBe(60)
  })

  it('sums only a given character’s colonies for their net ISK', () => {
    const colonies = [colony(1, 100, 50), colony(2, 100, -20), colony(3, 200, 30)]
    expect(computeCharacterNetIsk(colonies, 100, 'potential')).toBe(30)
    expect(computeCharacterNetIsk(colonies, 200, 'potential')).toBe(30)
    expect(computeCharacterNetIsk(colonies, 999, 'potential')).toBe(0)
  })

  it('aggregates the portfolio financial breakdown from every colony', () => {
    const c = colony(3, 200, 30)
    c.potentialExportRevenuePerHour = 40
    c.potentialImportCostPerHour = 10
    c.potentialExportTaxPerHour = 5
    const snapshot = computePortfolioFinancialTotals([c], 'potential')
    expect(snapshot.exportRevenuePerHour).toBe(40)
    expect(snapshot.importCostPerHour).toBe(10)
    expect(snapshot.exportTaxPerHour).toBe(5)
    expect(snapshot.exportGrossPerHour).toBe(45)
    expect(snapshot.netIskPerHour).toBe(30)
  })
})
