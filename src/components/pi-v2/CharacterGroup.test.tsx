import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@/i18n/client'
import { CharacterGroup } from './CharacterGroup'
import { groupColoniesByCharacter } from '@/lib/pi-v2/grouping'
import { deriveColonyEvents } from '@/lib/pi-v2/events'
import { computeColonyGrid } from '@/lib/pi-v2/grid'
import { projectColonyState } from '@/lib/pi-v2/project-colony'
import { classifyColony } from '@/lib/pi-v2/urgency'
import type { PortfolioColony } from '@/lib/pi-v2/portfolio'
import {
  ANCHOR_ISO,
  sterileConduitsColony,
  summaryWithLastUpdate,
} from '@/lib/pi-v2/__fixtures__/colonies'

/** Colônia real (motor de verdade) com identidade parametrizável. */
function colony(
  characterId: number,
  characterName: string,
  planetId: number,
  waterAmount: number
): PortfolioColony {
  const nowMs = Date.parse(ANCHOR_ISO)
  const layout = sterileConduitsColony({ waterAmount })
  const projection = projectColonyState({
    summary: summaryWithLastUpdate(ANCHOR_ISO),
    layout,
    contract: { visitCadenceHrs: 24 },
    nowMs,
  })
  const events = deriveColonyEvents(projection, nowMs)
  return {
    characterId,
    characterName,
    planetId,
    planetName: `Planeta ${planetId}`,
    solarSystemId: 1,
    solarSystemName: 'SYS',
    planetType: 'barren',
    planetTypeLabel: 'Barren',
    projection,
    events,
    urgency: classifyColony(projection, events),
    grid: computeColonyGrid(layout, 5),
  }
}

describe('CharacterGroup', () => {
  // 200 de Water a −200/h = 1h de autonomia → âmbar (limiar 8h).
  // 4.000 = 20h → informativo, fora do contador de atenção.
  const urgent = colony(7, 'Fleet Citizen 03', 31, 200)
  const calm = colony(7, 'Fleet Citizen 03', 32, 4000)
  const group = groupColoniesByCharacter([urgent, calm])[0]!

  it('mostra o nome do personagem e quantas colônias ele tem', async () => {
    render(
      <I18nProvider locale="en">
        <CharacterGroup group={group} onSelectColony={() => {}} />
      </I18nProvider>
    )
    // Espera numa string TRADUZIDA: o nome do personagem é dado cru e aparece
    // no primeiro render, antes de o locale carregar — esperar por ele não
    // garantiria nada.
    expect(await screen.findByText('2 colonies')).toBeInTheDocument()
    expect(screen.getByText('Fleet Citizen 03')).toBeInTheDocument()
  })

  it('o cabeçalho resume o bloco no vocabulário do contador do topo', async () => {
    render(
      <I18nProvider locale="en">
        <CharacterGroup group={group} onSelectColony={() => {}} />
      </I18nProvider>
    )
    // 1 precisa de ação, 1 só no ritmo — o resumo diz os dois.
    expect(await screen.findByText(/1 needs attention/)).toBeInTheDocument()
    expect(screen.getByText(/1 restock soon/)).toBeInTheDocument()
  })

  it('renderiza os cards das colônias do grupo, na ordem recebida', async () => {
    render(
      <I18nProvider locale="en">
        <CharacterGroup group={group} onSelectColony={() => {}} />
      </I18nProvider>
    )
    await screen.findByText('Planeta 31')
    const names = screen.getAllByText(/^Planeta \d+$/).map((el) => el.textContent)
    expect(names).toEqual(['Planeta 31', 'Planeta 32'])
  })
})
