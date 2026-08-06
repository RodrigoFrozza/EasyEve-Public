/**
 * O caso de ouro do Water **dentro do modelo novo**.
 *
 * A rodada real de 21/07/2026, conferida contra o order book:
 *
 * | hub | mercadoria | frete | efetivo |
 * |---|---|---|---|
 * | UALX-3 (base) | 487,41 | 0 (entrada `local`) | **487,41** |
 * | Jita | 468,00 | 800 ISK/m³ × 0,19 m³ = 152 | 620,00 |
 *
 * A mercadoria é MAIS BARATA em Jita. Comprar lá custaria 27,7M a mais nas 208.850
 * unidades. O teste existe porque o redesenho da Etapa 8 trocou de onde sai o
 * `freightPerM3`: antes era um campo digitado; agora é DERIVADO da perna de cada
 * hub. Se a derivação mudar um número, a decisão de compra muda — e esta é a
 * decisão que já foi validada em ISK de verdade.
 *
 * Também trava a outra ponta: a base entra com `local`, o único 0 que é 0 porque
 * não há nada a mover.
 */

import { chooseHub, quoteHubs, type HubBooks } from '@/lib/pi-v2/pricing/hub-quotes'
import {
  legMarginalRatePerM3,
  type FreightHub,
  JITA_HUB_ID,
} from '@/lib/pi-v2/pricing/freight-model'
import { readFreightPrefs } from '@/lib/pi-v2/freight-prefs'
import type { MarketDepth } from '@/lib/market-prices'

const WATER_M3 = 0.19
const DEMAND = 208_850

const depth = (levels: Array<[price: number, volume: number]>): MarketDepth => ({
  sell: levels.map(([price, volume]) => ({ price, volume, locationId: 1 })),
  buy: [],
  updatedAt: Date.now(),
})

/**
 * A config real do Rodrigo como ela chega do localStorage das Etapas 5/7. O teste
 * parte do que está GRAVADO, não de um objeto montado à mão: é a migração que
 * precisa produzir a decisão certa.
 */
const stored = {
  buyStations: [
    { id: '60003760', name: 'UALX-3', freightPerM3: 0, freightMode: 'local' },
  ],
  jitaFreightPerM3: 800,
}

const prefs = readFreightPrefs(stored)

/** A taxa por item de um hub sai da perna dele — em um lugar só. */
const rateOf = (hub: FreightHub | undefined) => legMarginalRatePerM3(hub?.inbound).ratePerM3

describe('teste 1 — o caso de ouro do Water sobrevive ao modelo novo', () => {
  const jitaHub = prefs.hubs.find((h) => h.id === JITA_HUB_ID)

  const books: HubBooks = {
    stations: [
      {
        id: prefs.baseHub!.id,
        label: prefs.baseHub!.name,
        book: depth([
          [486.49, 154_380],
          [490.0, 200_000],
        ]),
        // A base: entrada `local` → 0, derivado da perna, não digitado.
        freightPerM3: rateOf({ id: 'base', name: 'base', inbound: { method: 'local' } }),
      },
    ],
    jita: { buy: 460, sell: 468 },
    jitaFreightPerM3: rateOf(jitaHub),
  }

  it('a base virou a base, e Jita herdou os 800 ISK/m³ como courier', () => {
    expect(prefs.baseHub).toEqual({ id: '60003760', name: 'UALX-3' })
    expect(rateOf(jitaHub)).toBe(800)
  })

  it('UALX anda o book e fica em 487,41', () => {
    const ualx = quoteHubs(books, DEMAND, WATER_M3).find((q) => q.stationId === '60003760')!
    expect(ualx.unitPrice).toBeCloseTo(487.41, 1)
    expect(ualx.freightPerUnit).toBe(0)
    expect(ualx.effectiveUnitPrice).toBeCloseTo(487.41, 1)
  })

  it('Jita fica em 620,00 — 468 de mercadoria + 152 de frete', () => {
    const jita = quoteHubs(books, DEMAND, WATER_M3).find((q) => q.origin === 'jita')!
    expect(jita.freightPerUnit).toBeCloseTo(152, 6)
    expect(jita.effectiveUnitPrice).toBeCloseTo(620, 6)
  })

  it('o Water sai em UALX, apesar de a mercadoria ser mais cara lá', () => {
    const chosen = chooseHub(quoteHubs(books, DEMAND, WATER_M3))!
    expect(chosen.stationId).toBe('60003760')
  })

  it('a economia bate com os 27,7M da tabela manual', () => {
    const quotes = quoteHubs(books, DEMAND, WATER_M3)
    const ualx = quotes.find((q) => q.stationId === '60003760')!
    const jita = quotes.find((q) => q.origin === 'jita')!
    const economia = (jita.effectiveUnitPrice - ualx.effectiveUnitPrice) * DEMAND
    expect(economia / 1_000_000).toBeCloseTo(27.7, 1)
  })

  it('sem a perna de Jita configurada, a decisão inverte — e por isso ela é rotulada', () => {
    // Não é hipótese acadêmica: `regionFreightPerM3: 0` era o DEFAULT das etapas
    // anteriores. Um hub sem perna entra com 0 e ganharia a comparação sem que
    // ninguém tivesse calculado nada — é o que o rótulo "não configurado" impede
    // de passar em silêncio.
    const semPerna = { ...books, jitaFreightPerM3: rateOf({ id: 'x', name: 'x' }) }
    expect(chooseHub(quoteHubs(semPerna, DEMAND, WATER_M3))!.origin).toBe('jita')
    expect(legMarginalRatePerM3(undefined).note).toBe('unconfigured')
  })
})
