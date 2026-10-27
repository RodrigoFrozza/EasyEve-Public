import { render, screen } from '@testing-library/react'
import { PlanetTile } from './PlanetTile'
import { I18nProvider } from '@/i18n/client'
import type { PiColonyAnalysis, PiBufferStatus } from '@/lib/pi/types'

const RUNNING_BUFFER: PiBufferStatus = { status: 'running' }

function colony(overrides: {
  bufferStatus?: PiBufferStatus
  bufferStatusCurrent?: PiBufferStatus
  isStale?: boolean
  warnings?: string[]
  extractors?: Array<{ isExpired: boolean }>
} = {}): PiColonyAnalysis {
  return {
    planetId: 1,
    characterId: 1,
    planetType: 'temperate',
    planetTypeLabel: 'Temperate',
    planetName: 'WE-KK2 II',
    solarSystemName: 'WE-KK2',
    potentialNetIskPerHour: 1_000_000,
    currentNetIskPerHour: 1_000_000,
    potentialExportRevenuePerHour: 1_000_000,
    potentialImportCostPerHour: 0,
    currentExportRevenuePerHour: 1_000_000,
    currentImportCostPerHour: 0,
    isStale: overrides.isStale ?? false,
    warnings: overrides.warnings ?? [],
    extractors: overrides.extractors ?? [],
    config: { planetId: 1, surplusForSale: false },
    balances: { potential: [], current: [] },
    bufferStatus: overrides.bufferStatus ?? RUNNING_BUFFER,
    bufferStatusCurrent: overrides.bufferStatusCurrent ?? RUNNING_BUFFER,
    pinBuffers: { potential: [], current: [] },
  } as unknown as PiColonyAnalysis
}

function renderTile(
  c: PiColonyAnalysis,
  rateMode: 'potential' | 'current' = 'current',
  showWarnings = true
) {
  return render(
    <I18nProvider locale="en">
      <PlanetTile colony={c} rateMode={rateMode} showWarnings={showWarnings} onClick={() => {}} />
    </I18nProvider>
  )
}

describe('PlanetTile colonyProblem — degraded buffer status', () => {
  it('does not go silent for a degraded colony (regression: used to fall through to null)', async () => {
    // Before the fix, `buffer.status === 'degraded'` matched none of the `if`
    // branches in colonyProblem() and fell through to the generic
    // warningCount/isStale fallbacks or `return null` — the amber
    // "partial production" problem the badge/banner already show simply
    // vanished from the dashboard tile.
    const c = colony({ bufferStatusCurrent: { status: 'degraded', timeToStopHrs: -1 } })
    renderTile(c, 'current')

    expect(await screen.findByText('Partial production')).toBeInTheDocument()
  })

  it('shows a commodity-specific message when the limiting commodity is known', async () => {
    const c = colony({
      bufferStatusCurrent: { status: 'degraded', timeToStopHrs: -3, limitingTypeId: 2268 },
    })
    renderTile(c, 'current')

    expect(await screen.findByText('Partial production — missing Aqueous Liquids')).toBeInTheDocument()
  })

  it('falls back to the generic message when no limiting commodity is known', async () => {
    const c = colony({ bufferStatusCurrent: { status: 'degraded', timeToStopHrs: 0 } })
    renderTile(c, 'current')

    expect(await screen.findByText('Partial production')).toBeInTheDocument()
    expect(screen.queryByText(/missing/i)).not.toBeInTheDocument()
  })

  it('never shows a "stops in ..." countdown for degraded (timeToStopHrs is stale/<=0)', async () => {
    // `degraded` is always a reclassified `stalled`, so timeToStopHrs is
    // typically <= 0. Showing it would misleadingly read "stops in 0m" for a
    // colony that is still exporting something — the countdown must be
    // suppressed for this status regardless of what timeToStopHrs holds.
    const c = colony({
      bufferStatusCurrent: { status: 'degraded', timeToStopHrs: -1, limitingTypeId: 2268 },
    })
    renderTile(c, 'current')

    await screen.findByText('Partial production — missing Aqueous Liquids')
    expect(screen.queryByText(/stops in/i)).not.toBeInTheDocument()
    // Ancorado à duração: `/0m/i` casava com o ISK/h renderizado ("1.00M/h"),
    // reprovando o teste por um "0M" que não é countdown nenhum.
    expect(screen.queryByText(/\b0m\b/)).not.toBeInTheDocument()
  })

  it('respects rateMode: potential reads bufferStatus, current reads bufferStatusCurrent', async () => {
    const c = colony({
      bufferStatus: { status: 'running' },
      bufferStatusCurrent: { status: 'degraded', timeToStopHrs: -1, limitingTypeId: 2268 },
    })

    const potentialRender = renderTile(c, 'potential')
    expect(potentialRender.container.querySelector('.text-amber-300')).toBeNull()
    potentialRender.unmount()

    renderTile(c, 'current')
    expect(await screen.findByText('Partial production — missing Aqueous Liquids')).toBeInTheDocument()
  })

  it('suppresses the problem message when showWarnings is false', () => {
    const c = colony({
      bufferStatusCurrent: { status: 'degraded', timeToStopHrs: -1, limitingTypeId: 2268 },
    })
    const { container } = renderTile(c, 'current', false)

    expect(container.querySelector('.text-amber-300')).toBeNull()
  })
})

describe('PlanetTile colonyProblem — regression for neighboring statuses', () => {
  it('keeps the existing stalled message (countdown + missing commodity)', async () => {
    const c = colony({
      bufferStatusCurrent: { status: 'stalled', timeToStopHrs: 2, limitingTypeId: 3645 },
    })
    renderTile(c, 'current')

    expect(await screen.findByText('Stops in 2h — missing Water')).toBeInTheDocument()
  })

  it('keeps the existing starving_soon message (countdown + missing commodity)', async () => {
    const c = colony({
      bufferStatus: { status: 'starving_soon', timeToStopHrs: 0.5, limitingTypeId: 2073 },
    })
    renderTile(c, 'potential')

    expect(await screen.findByText('Stops in 30m — missing Microorganisms')).toBeInTheDocument()
  })
})

describe('PlanetTile colonyProblem — healthy colony', () => {
  it('shows no problem message at all', () => {
    const c = colony()
    const { container } = renderTile(c, 'current')

    expect(container.querySelector('.text-amber-300')).toBeNull()
  })
})
