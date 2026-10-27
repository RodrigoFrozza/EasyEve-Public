/**
 * Agrupamento por personagem.
 *
 * PI se joga um personagem por vez: loga, resolve os planetas dele, sai, entra no
 * próximo. A ordem global por urgência responde "o que é mais grave"; ela não
 * responde "o que eu faço agora", que é a pergunta de quem está com o cliente
 * aberto. Estes testes travam as duas ordens que fazem a tela bater com o jogo:
 * qual personagem logar primeiro, e o que atacar dentro dele.
 */

import { groupColoniesByCharacter } from '@/lib/pi-v2/grouping'
import { BUCKET_RANK, type ColonyBucket, type ColonyUrgency } from '@/lib/pi-v2/urgency'
import type { PortfolioColony } from '@/lib/pi-v2/portfolio'

function colony(
  characterId: number,
  characterName: string,
  planetId: number,
  bucket: ColonyBucket
): PortfolioColony {
  const urgency: ColonyUrgency = {
    bucket,
    rank: BUCKET_RANK[bucket],
    action: { kind: 'none' },
  }
  return {
    characterId,
    characterName,
    planetId,
    planetName: `P${planetId}`,
    solarSystemId: 1,
    solarSystemName: 'SYS',
    planetType: 'barren',
    planetTypeLabel: 'Barren',
    urgency,
  } as unknown as PortfolioColony
}

/** Como o portfólio chega da API: já ordenado por urgência global. */
const portfolio: PortfolioColony[] = [
  colony(3, 'Fleet Citizen 03', 31, 'stalled'),
  colony(1, 'Zeca Setaum', 11, 'degraded'),
  colony(3, 'Fleet Citizen 03', 32, 'attention'),
  colony(2, 'Rodrigo Frozza', 21, 'attention'),
  colony(1, 'Zeca Setaum', 12, 'restock_soon'),
  colony(2, 'Rodrigo Frozza', 22, 'running'),
  colony(1, 'Zeca Setaum', 13, 'running'),
]

describe('groupColoniesByCharacter', () => {
  it('teste 1 — três personagens viram três grupos', () => {
    const groups = groupColoniesByCharacter(portfolio)
    expect(groups).toHaveLength(3)
    expect(groups.map((g) => g.characterName)).toEqual([
      'Fleet Citizen 03',
      'Zeca Setaum',
      'Rodrigo Frozza',
    ])
  })

  it('teste 2 — o personagem com a colônia mais urgente vem primeiro', () => {
    // "Em qual eu logo primeiro?" O dono do `stalled` abre a tela.
    const groups = groupColoniesByCharacter(portfolio)
    expect(groups[0]!.characterId).toBe(3)
    expect(groups[0]!.colonies[0]!.urgency.bucket).toBe('stalled')
    // E o mais tranquilo fica por último.
    expect(groups[2]!.characterId).toBe(2)
  })

  it('teste 3 — dentro do grupo, a ordem é a de urgência', () => {
    const groups = groupColoniesByCharacter(portfolio)
    const zeca = groups.find((g) => g.characterId === 1)!
    expect(zeca.colonies.map((c) => c.urgency.bucket)).toEqual([
      'degraded',
      'restock_soon',
      'running',
    ])
    // A ordem vem do servidor, não é recalculada aqui: ranks não decrescem.
    for (const group of groups) {
      const ranks = group.colonies.map((c) => c.urgency.rank)
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    }
  })

  it('teste 4 — filtrado por um personagem, sobra só o grupo dele', () => {
    const onlyZeca = portfolio.filter((c) => c.characterId === 1)
    const groups = groupColoniesByCharacter(onlyZeca)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.characterName).toBe('Zeca Setaum')
    expect(groups[0]!.colonies).toHaveLength(3)
  })

  it('cada grupo carrega o próprio resumo, no vocabulário do contador do topo', () => {
    const groups = groupColoniesByCharacter(portfolio)
    const zeca = groups.find((g) => g.characterId === 1)!
    expect(zeca.counters.total).toBe(3)
    expect(zeca.counters.degraded).toBe(1)
    expect(zeca.counters.restockSoon).toBe(1)
    expect(zeca.counters.running).toBe(1)
    expect(zeca.counters.stalled).toBe(0)
  })

  it('portfólio vazio não inventa grupo', () => {
    expect(groupColoniesByCharacter([])).toEqual([])
  })

  it('não perde nem duplica colônia', () => {
    const groups = groupColoniesByCharacter(portfolio)
    const total = groups.reduce((sum, g) => sum + g.colonies.length, 0)
    expect(total).toBe(portfolio.length)
    const ids = groups.flatMap((g) => g.colonies.map((c) => `${c.characterId}-${c.planetId}`))
    expect(new Set(ids).size).toBe(portfolio.length)
  })
})
