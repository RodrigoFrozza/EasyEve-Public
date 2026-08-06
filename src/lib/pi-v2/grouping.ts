/**
 * Agrupamento do portfólio por personagem.
 *
 * A ordenação global por urgência responde "o que é mais grave"; ela não responde
 * "o que eu faço agora". PI se joga um personagem por vez: você loga, resolve os
 * planetas daquele personagem, sai e entra no próximo. Uma lista plana obrigaria
 * a trocar de conta a cada linha.
 *
 * Então: personagens ordenados pela colônia mais urgente de cada um (em qual
 * logar primeiro), e dentro do bloco a ordem de urgência (o que atacar naquela
 * sessão). O contador do topo continua sendo do portfólio inteiro.
 */

import type { PortfolioColony } from '@/lib/pi-v2/portfolio'
import { countBuckets, type PortfolioCounters } from '@/lib/pi-v2/urgency'

export interface CharacterGroup {
  characterId: number
  characterName: string
  /** Colônias deste personagem, na ordem de urgência. */
  colonies: PortfolioColony[]
  /** Resumo do bloco — o mesmo vocabulário do contador do topo. */
  counters: PortfolioCounters
}

/**
 * Agrupa preservando a ordem de entrada.
 *
 * O portfólio já chega ordenado por urgência do servidor, então preservar a
 * ordem dá as duas coisas de graça: o primeiro personagem visto é o dono da
 * colônia mais urgente, e dentro de cada bloco a ordem já é a de urgência.
 * Nenhuma reordenação — e nenhuma chance de a tela discordar do servidor sobre
 * o que é mais urgente.
 */
export function groupColoniesByCharacter(colonies: PortfolioColony[]): CharacterGroup[] {
  const groups = new Map<number, CharacterGroup>()

  for (const colony of colonies) {
    const existing = groups.get(colony.characterId)
    if (existing) {
      existing.colonies.push(colony)
      continue
    }
    groups.set(colony.characterId, {
      characterId: colony.characterId,
      characterName: colony.characterName,
      colonies: [colony],
      counters: countBuckets([]),
    })
  }

  for (const group of groups.values()) {
    group.counters = countBuckets(group.colonies.map((c) => c.urgency.bucket))
  }

  return [...groups.values()]
}
