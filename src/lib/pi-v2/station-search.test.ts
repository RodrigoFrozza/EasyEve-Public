/**
 * Filtro da busca de estações.
 *
 * A regra que estes testes existem para travar: **"não tem mercado" e "a ESI não
 * respondeu" não são a mesma coisa.** Esconder uma estrutura por causa de um
 * soluço da ESI é a mesma falha de sempre — engolir o erro e devolver um default
 * que parece verdade. Some quem NÃO tem; quem não deu para checar aparece com
 * ressalva e o jogador decide.
 */

import {
  keepStationsWithMarket,
  MAX_MARKET_PROBES,
  type StationMarketProbe,
} from '@/lib/pi-v2/station-search'

const results = [
  { structureId: '1', name: 'UALX-3 - Mothership Bellicose' },
  { structureId: '2', name: 'Sem Mercado' },
  { structureId: '3', name: 'C-J6MT - Fortizar' },
]

const probes = (entries: Record<string, StationMarketProbe>) =>
  new Map<string, StationMarketProbe>(Object.entries(entries))

describe('keepStationsWithMarket', () => {
  it('teste 1 — 3 estruturas, 2 com mercado → só as 2 aparecem', () => {
    const kept = keepStationsWithMarket(results, probes({ '1': 'yes', '2': 'no', '3': 'yes' }))
    expect(kept.map((s) => s.structureId)).toEqual(['1', '3'])
    expect(kept.every((s) => s.market === 'yes')).toBe(true)
  })

  it('teste 2 — estrutura sem mercado não aparece', () => {
    const kept = keepStationsWithMarket(results, probes({ '1': 'no', '2': 'no', '3': 'no' }))
    expect(kept).toEqual([])
  })

  it('teste 3 — erro transitório da ESI NÃO some: aparece com ressalva', () => {
    const kept = keepStationsWithMarket(results, probes({ '1': 'yes', '2': 'unknown', '3': 'no' }))
    expect(kept.map((s) => s.structureId)).toEqual(['1', '2'])
    expect(kept.find((s) => s.structureId === '2')!.market).toBe('unknown')
  })

  it('estrutura não sondada vira `unknown`, nunca "não tem"', () => {
    // Além do teto de sondagens: a ausência de resposta não pode virar negativa.
    const kept = keepStationsWithMarket(results, probes({ '1': 'yes' }))
    expect(kept).toHaveLength(3)
    expect(kept.filter((s) => s.market === 'unknown').map((s) => s.structureId)).toEqual(['2', '3'])
  })

  it('preserva a ordem da busca', () => {
    const kept = keepStationsWithMarket(results, probes({ '1': 'yes', '2': 'yes', '3': 'yes' }))
    expect(kept.map((s) => s.name)).toEqual(results.map((r) => r.name))
  })

  it('sem resultados, não inventa nada', () => {
    expect(keepStationsWithMarket([], probes({ '1': 'yes' }))).toEqual([])
  })

  it('o teto de sondagens é positivo e pequeno — cada uma é uma chamada à ESI', () => {
    expect(MAX_MARKET_PROBES).toBeGreaterThan(0)
    expect(MAX_MARKET_PROBES).toBeLessThanOrEqual(20)
  })
})
