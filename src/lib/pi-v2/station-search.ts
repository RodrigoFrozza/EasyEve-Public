/**
 * Filtro da busca de estações: só entra o que serve para comprar.
 *
 * A busca da ESI devolve toda estrutura de que o personagem tem conhecimento de
 * docking — inclusive as que não têm módulo de mercado. Cadastrar uma dessas só
 * rende um aviso depois, então elas saem da lista antes de chegar na tela.
 *
 * **Mas "não tem mercado" e "a ESI não respondeu" são coisas diferentes.**
 * Esconder uma estrutura por causa de um soluço da ESI é a mesma falha de sempre
 * — engolir o erro e devolver um default que parece verdade. Aqui:
 *
 *  - `no`      → some da lista (resposta definitiva: sem mercado / sem acesso)
 *  - `yes`     → aparece normal
 *  - `unknown` → aparece **com ressalva**, para o jogador decidir
 *
 * Puro de propósito: nenhuma chamada de rede, para o comportamento poder ser
 * testado sem ESI.
 */

export type StationMarketProbe = 'yes' | 'no' | 'unknown'

/** Como a estação chega na tela, já classificada. */
export type StationMarketState = 'yes' | 'unknown'

export interface StationCandidate {
  structureId: string
  name: string
  /** `unknown` = mercado não confirmado; a UI mostra a ressalva. */
  market: StationMarketState
}

/**
 * Quantas estruturas checar de fato. Cada checagem é uma chamada à ESI; a busca
 * já é uma shortlist (mínimo 3 letras), mas um termo genérico pode devolver
 * bastante. O que passar do teto entra como `unknown` — mostrado com ressalva,
 * nunca escondido por não termos olhado.
 */
export const MAX_MARKET_PROBES = 10

/**
 * Aplica as sondagens aos resultados da busca, preservando a ordem original.
 * Estrutura sem sondagem registrada vira `unknown` — a ausência de resposta
 * nunca pode virar "não tem".
 */
export function keepStationsWithMarket(
  results: Array<{ structureId: string; name: string }>,
  probes: Map<string, StationMarketProbe>
): StationCandidate[] {
  const candidates: StationCandidate[] = []
  for (const result of results) {
    const probe = probes.get(result.structureId) ?? 'unknown'
    if (probe === 'no') continue
    candidates.push({
      structureId: result.structureId,
      name: result.name,
      market: probe === 'yes' ? 'yes' : 'unknown',
    })
  }
  return candidates
}
