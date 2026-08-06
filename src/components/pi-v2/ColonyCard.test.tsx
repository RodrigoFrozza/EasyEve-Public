import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@/i18n/client'
import { ColonyCard } from './ColonyCard'
import { PortfolioCounters } from './PortfolioCounters'
import { deriveColonyEvents } from '@/lib/pi-v2/events'
import { computeColonyGrid } from '@/lib/pi-v2/grid'
import { projectColonyState } from '@/lib/pi-v2/project-colony'
import { classifyColony, countBuckets } from '@/lib/pi-v2/urgency'
import type { PortfolioColony } from '@/lib/pi-v2/portfolio'
import {
  ANCHOR_ISO,
  HOUR_MS,
  sterileConduitsColony,
  summaryWithLastUpdate,
} from '@/lib/pi-v2/__fixtures__/colonies'
import type { PiColonyLayout } from '@/lib/pi-v2/esi'

function portfolioColony(layout: PiColonyLayout, hoursAfterSnapshot: number): PortfolioColony {
  const nowMs = Date.parse(ANCHOR_ISO) + hoursAfterSnapshot * HOUR_MS
  const projection = projectColonyState({
    summary: summaryWithLastUpdate(ANCHOR_ISO),
    layout,
    contract: { visitCadenceHrs: 24 },
    nowMs,
  })
  const events = deriveColonyEvents(projection, nowMs)
  return {
    characterId: 90001,
    characterName: 'Zeca Setaum',
    planetId: 40000001,
    planetName: '6-IAFR I',
    solarSystemId: 30000001,
    solarSystemName: '6-IAFR',
    planetType: 'barren',
    planetTypeLabel: 'Barren',
    projection,
    events,
    urgency: classifyColony(projection, events),
    grid: computeColonyGrid(layout, 5),
  }
}

function renderCard(layout: PiColonyLayout, hours: number) {
  return render(
    <I18nProvider locale="en">
      <ColonyCard colony={portfolioColony(layout, hours)} onClick={() => {}} />
    </I18nProvider>
  )
}

// O I18nProvider carrega o locale por import dinâmico num efeito: o primeiro
// render sai com as chaves cruas. Por isso a primeira asserção de cada teste usa
// `findByText`, que espera o texto traduzido aparecer.
describe('ColonyCard', () => {
  it('mostra a AÇÃO com o item, não o diagnóstico cru', async () => {
    renderCard(sterileConduitsColony({ waterAmount: 4600 }), 21)
    expect(await screen.findByText('Restock Water')).toBeInTheDocument()
    // "starving_soon" é vocabulário interno e nunca deve vazar para a tela.
    expect(screen.queryByText(/starving_soon/i)).not.toBeInTheDocument()
  })

  it('mostra o prazo da ação', async () => {
    renderCard(sterileConduitsColony({ waterAmount: 4600 }), 21)
    expect(await screen.findByText('in 2h')).toBeInTheDocument()
  })

  it('carrega o selo de idade do dado — obrigatório em toda superfície projetada', async () => {
    renderCard(sterileConduitsColony(), 21)
    expect(await screen.findByText(/read 21h ago/i)).toBeInTheDocument()
  })

  it('dado velho demais mostra o selo vermelho e manda abrir no jogo', async () => {
    renderCard(sterileConduitsColony(), 100)
    expect(await screen.findByText(/out of date/i)).toBeInTheDocument()
    expect(screen.getByText('Open the colony in-game')).toBeInTheDocument()
  })

  it('colônia saudável não inventa tarefa', async () => {
    renderCard(sterileConduitsColony({ waterAmount: 20_000 }), 1)
    expect(await screen.findByText('Nothing to do')).toBeInTheDocument()
  })

  it('cabe em 3 linhas: identidade, ação e contexto', async () => {
    renderCard(sterileConduitsColony({ waterAmount: 4600 }), 21)
    expect(await screen.findByText('6-IAFR I')).toBeInTheDocument()
    expect(screen.getByText(/Zeca Setaum · 6-IAFR/)).toBeInTheDocument()
  })
})

describe('PortfolioCounters', () => {
  const counters = countBuckets([
    'stalled',
    'degraded',
    'degraded',
    'restock_soon',
    'running',
    'running',
  ])

  it('mostra cada balde com seu próprio número', async () => {
    render(
      <I18nProvider locale="en">
        <PortfolioCounters counters={counters} activeFilter={null} onFilterChange={() => {}} />
      </I18nProvider>
    )
    expect(await screen.findByText('6 colonies')).toBeInTheDocument()
    expect(screen.getByText('stalled')).toBeInTheDocument()
    expect(screen.getByText('degraded')).toBeInTheDocument()
    expect(screen.getByText('restock soon')).toBeInTheDocument()
  })

  it('não renderiza balde zerado — "0 parados" é ruído', async () => {
    const clean = countBuckets(['running', 'running'])
    render(
      <I18nProvider locale="en">
        <PortfolioCounters counters={clean} activeFilter={null} onFilterChange={() => {}} />
      </I18nProvider>
    )
    expect(await screen.findByText('running')).toBeInTheDocument()
    expect(screen.queryByText('stalled')).not.toBeInTheDocument()
    expect(screen.queryByText('degraded')).not.toBeInTheDocument()
  })
})
