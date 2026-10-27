import { render, screen } from '@testing-library/react'
import { CharacterPlanetGroup } from './CharacterPlanetGroup'
import { I18nProvider } from '@/i18n/client'
import type { PiColonyAnalysis } from '@/lib/pi/types'

function colony(planetId: number, characterId: number, netIsk: number): PiColonyAnalysis {
  return {
    planetId,
    characterId,
    planetType: 'temperate',
    planetTypeLabel: 'Temperate',
    potentialNetIskPerHour: netIsk,
    currentNetIskPerHour: netIsk,
    potentialExportRevenuePerHour: netIsk,
    potentialImportCostPerHour: 0,
    currentExportRevenuePerHour: netIsk,
    currentImportCostPerHour: 0,
    isStale: false,
    warnings: [],
    extractors: [],
  } as unknown as PiColonyAnalysis
}

describe('CharacterPlanetGroup net ISK/h', () => {
  it('sums the character’s own colonies for the header total', () => {
    // Each colony is standalone now — the header shows a plain sum.
    const colonies = [colony(1, 1, 5_000_000), colony(2, 1, 3_000_000)]

    render(
      <I18nProvider locale="en">
        <CharacterPlanetGroup
          characterId={1}
          characterName="Alice"
          colonies={colonies}
          rateMode="current"
          onSelectColony={() => {}}
        />
      </I18nProvider>
    )

    // 5M + 3M = 8M
    expect(screen.getByText(/^8(\.\d+)?M$/)).toBeInTheDocument()
  })
})
