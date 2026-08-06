/**
 * O modelo de frete unificado: base + hubs, cada hub com uma perna.
 *
 * O que estes testes travam é a diferença entre **zero** e **não sei**. O modelo
 * inteiro existe porque as duas coisas produzem o número 0 e significam o oposto:
 *
 *  - a base é 0 porque não há nada a mover (`local`)
 *  - um hub sem perna é 0 porque ninguém disse quanto custa (`unconfigured`)
 *  - um JF sem book de isótopo é 0 porque o combustível é desconhecido
 *    (`no_isotope_price`) — e aí o total do hub tem que sair MARCADO
 *
 * Os dados dos cascos vêm do SDE (`jf-data.ts`, gerado), nunca de constante
 * digitada: o isótopo sai do atributo dogma `jumpDriveConsumptionType` e o cargo,
 * do `capacity` do tipo.
 */

import {
  adviseRefuel,
  chooseSellHub,
  hubKeyFor,
  jfLoadM3,
  jfTripFuelCost,
  legMarginalRatePerM3,
  legShipmentFreight,
  JITA_HUB_ID,
  REGION_HUB_ID,
  type JfLeg,
} from '@/lib/pi-v2/pricing/freight-model'
import { PI_JUMP_FREIGHTERS, getJumpFreighter } from '@/lib/pi-v2/jf-data'

/** O JF do Rodrigo na rota C-J6 → UALX, com a carga cheia declarada. */
const RHEA = 28844
const rheaLeg = (overrides: Partial<JfLeg> = {}): JfLeg => ({
  method: 'jf',
  jfTypeId: RHEA,
  isotopeQtyRoundTrip: 12_000,
  cargoM3: 144_000,
  ...overrides,
})

describe('teste 3 — isótopo e cargo vêm do SDE, pelo jfTypeId', () => {
  it('os quatro jump freighters estão presentes, cada um com o seu isótopo', () => {
    expect(PI_JUMP_FREIGHTERS.map((jf) => jf.name).sort()).toEqual([
      'Anshar',
      'Ark',
      'Nomad',
      'Rhea',
    ])
    // Isótopo distinto por casco: se dois apontassem para o mesmo, o gerador leu
    // o atributo dogma errado.
    const isotopes = new Set(PI_JUMP_FREIGHTERS.map((jf) => jf.isotopeTypeId))
    expect(isotopes.size).toBe(4)
    for (const jf of PI_JUMP_FREIGHTERS) {
      expect(jf.isotopeName).toMatch(/Isotopes$/)
      expect(jf.cargoM3).toBeGreaterThan(100_000)
      expect(jf.isotopeVolumeM3).toBeGreaterThan(0)
    }
  })

  it('o casco resolve por typeId, e um id que não é JF não vira default', () => {
    const rhea = getJumpFreighter(RHEA)!
    expect(rhea.name).toBe('Rhea')
    expect(rhea.isotopeName).toBe('Nitrogen Isotopes')
    // Um typeId qualquer (Water) não pode virar um casco com cargo inventado.
    expect(getJumpFreighter(3645)).toBeUndefined()
  })

  it('carga ausente cai no cargo do casco, do SDE — não num número chutado', () => {
    const jf = getJumpFreighter(RHEA)!
    expect(jfLoadM3(rheaLeg({ cargoM3: 0 }))).toBe(jf.cargoM3)
    // Carga declarada menor (não encheu) é respeitada: é ela que divide o custo.
    expect(jfLoadM3(rheaLeg({ cargoM3: 98_000 }))).toBe(98_000)
  })

  it('custo = qtd × preço, e ISK/m³ = custo ÷ carga', () => {
    const leg = rheaLeg({ isotopeQtyRoundTrip: 12_000, cargoM3: 144_000 })
    const fuel = { isotopeUnitPrice: 590 }
    expect(jfTripFuelCost(leg, fuel)).toBe(12_000 * 590)
    const rate = legMarginalRatePerM3(leg, fuel)
    expect(rate.note).toBe('ok')
    expect(rate.ratePerM3).toBeCloseTo((12_000 * 590) / 144_000, 9)
  })

  it('não encher a nave sobe o ISK/m³ — o custo é fixo por viagem', () => {
    const fuel = { isotopeUnitPrice: 590 }
    const cheio = legMarginalRatePerM3(rheaLeg(), fuel).ratePerM3
    const a68 = legMarginalRatePerM3(rheaLeg({ cargoM3: 144_000 * 0.68 }), fuel).ratePerM3
    expect(a68 / cheio).toBeCloseTo(1 / 0.68, 6)
  })
})

describe('teste 4 — onde abastecer é o isótopo mais barato', () => {
  it('origem mais barata → abastece na origem, com a economia da viagem', () => {
    // Os números que o Rodrigo mediu: C-J6 a 590, UALX a 742.
    const advice = adviseRefuel({
      isotopeQtyRoundTrip: 12_000,
      originPrice: 590,
      destinationPrice: 742,
    })
    expect(advice.at).toBe('origin')
    expect(advice.price).toBe(590)
    expect(advice.savingsPerTrip).toBeCloseTo((742 - 590) * 12_000, 6)
  })

  it('destino mais barato → abastece no destino', () => {
    const advice = adviseRefuel({
      isotopeQtyRoundTrip: 12_000,
      originPrice: 900,
      destinationPrice: 742,
    })
    expect(advice.at).toBe('destination')
    expect(advice.price).toBe(742)
  })

  it('empate fica na origem — abastecer antes de sair não depende do destino', () => {
    const advice = adviseRefuel({
      isotopeQtyRoundTrip: 12_000,
      originPrice: 700,
      destinationPrice: 700,
    })
    expect(advice.at).toBe('origin')
    expect(advice.savingsPerTrip).toBe(0)
  })

  it('com book de um lado só, usa o lado que existe — sem comparar com zero', () => {
    const semOrigem = adviseRefuel({
      isotopeQtyRoundTrip: 100,
      originPrice: null,
      destinationPrice: 742,
    })
    expect(semOrigem.at).toBe('destination')
    expect(semOrigem.price).toBe(742)
    // Preço 0 é ausência de book, não um isótopo grátis.
    const zeroNaOrigem = adviseRefuel({
      isotopeQtyRoundTrip: 100,
      originPrice: 0,
      destinationPrice: 742,
    })
    expect(zeroNaOrigem.at).toBe('destination')
  })
})

describe('teste 5 — sem preço de isótopo o frete não zera: herda a incerteza', () => {
  const leg = rheaLeg()

  it('a taxa por item sai 0, mas rotulada', () => {
    const rate = legMarginalRatePerM3(leg, { isotopeUnitPrice: null })
    expect(rate.ratePerM3).toBe(0)
    expect(rate.note).toBe('no_isotope_price')
  })

  it('o total do hub sai `unpriced` e cai no linear — a tela é obrigada a avisar', () => {
    const freight = legShipmentFreight({
      leg,
      fuel: { isotopeUnitPrice: null },
      volumeM3: 40_000,
      collateralValue: 1_000_000_000,
      linearFreight: 0,
    })
    expect(freight.unpriced).toBe(true)
    expect(freight.binding).toBe('jf_fuel')
    expect(freight.cost).toBe(0)
  })

  it('sem a quantidade do DOTLAN também não inventa combustível', () => {
    const semQtd = rheaLeg({ isotopeQtyRoundTrip: 0 })
    expect(jfTripFuelCost(semQtd, { isotopeUnitPrice: 590 })).toBeNull()
    expect(legMarginalRatePerM3(semQtd, { isotopeUnitPrice: 590 }).note).toBe('no_isotope_price')
  })
})

describe('o custo do envio por método', () => {
  const shipment = (over: Partial<Parameters<typeof legShipmentFreight>[0]>) =>
    legShipmentFreight({
      volumeM3: 40_000,
      collateralValue: 2_000_000_000,
      linearFreight: 123_456,
      ...over,
    })

  it('teste 7 — a base tem entrada local, e local não entra como custo', () => {
    const rate = legMarginalRatePerM3({ method: 'local' })
    expect(rate.ratePerM3).toBe(0)
    expect(rate.note).toBe('ok')
    const freight = shipment({ leg: { method: 'local' } })
    expect(freight.cost).toBe(0)
    expect(freight.unpriced).toBe(false)
  })

  it('hub sem perna é 0 rotulado como não configurado — não é "de graça"', () => {
    const rate = legMarginalRatePerM3(undefined)
    expect(rate.ratePerM3).toBe(0)
    expect(rate.note).toBe('unconfigured')
    // Sem perna, o total cai no linear: é o que se sabe, e não é uma invenção.
    expect(shipment({ leg: undefined }).cost).toBe(123_456)
  })

  it('courier preserva a fórmula da Parte A — teto e piso', () => {
    const leg = {
      method: 'courier' as const,
      transporter: 'ITL',
      perM3Rate: 800,
      fullLoadReward: 1_000_000,
    }
    // MIN(full load, volume × per m³): 40.000 × 800 = 32M > 1M → o teto manda.
    const freight = shipment({ leg })
    expect(freight.binding).toBe('full_load')
    expect(freight.cost).toBe(1_000_000)
    expect(legMarginalRatePerM3(leg).ratePerM3).toBe(800)
  })

  it('courier sem per m³ e sem o m³ da carga cheia não é atribuível por item', () => {
    const rate = legMarginalRatePerM3({
      method: 'courier',
      transporter: 'ITL',
      fullLoadReward: 280_000_000,
    })
    expect(rate.ratePerM3).toBe(0)
    expect(rate.note).toBe('not_attributable')
  })

  it('JF: uma viagem enquanto cabe; o que não cabe exige outra ida', () => {
    const leg = rheaLeg({ isotopeQtyRoundTrip: 12_000, cargoM3: 144_000 })
    const fuel = { isotopeUnitPrice: 590 }
    const uma = shipment({ leg, fuel, volumeM3: 100_000 })
    expect(uma.trips).toBe(1)
    expect(uma.cost).toBe(12_000 * 590)
    expect(uma.binding).toBe('jf_fuel')

    // 150.000 m³ não caberia num Rhea cheio: são duas idas, e o custo dobra.
    const duas = shipment({ leg, fuel, volumeM3: 150_000 })
    expect(duas.trips).toBe(2)
    expect(duas.cost).toBe(2 * 12_000 * 590)
  })
})

describe('onde ele entrega para vender', () => {
  const base = { id: '60003760', name: 'UALX-3' }

  it('sem saída configurada, vende na base — e o frete é 0 de verdade', () => {
    // É o setup real do Rodrigo: contrato na própria base, sem mover carga. Ele
    // não configura nada e o P&L já reflete isso.
    const choice = chooseSellHub({
      base,
      hubs: [{ id: JITA_HUB_ID, name: 'Jita', inbound: { method: 'courier', transporter: 'ITL', perM3Rate: 850 } }],
    })
    expect(choice.hubKey).toBeNull()
    expect(choice.hubName).toBe('UALX-3')
    expect(choice.ratePerM3).toBe(0)
    expect(choice.note).toBe('ok')
  })

  it('a entrada NÃO vira saída: comprar de Jita não é vender em Jita', () => {
    const choice = chooseSellHub({
      base,
      hubs: [{ id: '61000001', name: 'C-J6MT', inbound: { method: 'courier', transporter: 'ITL', perM3Rate: 800 } }],
    })
    expect(choice.hubKey).toBeNull()
    expect(choice.ratePerM3).toBe(0)
  })

  it('com saída configurada, ela é o destino de venda e traz a taxa', () => {
    const choice = chooseSellHub({
      base,
      hubs: [
        {
          id: JITA_HUB_ID,
          name: 'Jita',
          inbound: { method: 'courier', transporter: 'ITL', perM3Rate: 850 },
          outbound: { method: 'courier', transporter: 'ITL', perM3Rate: 900 },
        },
      ],
    })
    expect(choice.hubKey).toBe(JITA_HUB_ID)
    expect(choice.ratePerM3).toBe(900)
  })

  it('havendo duas saídas, ganha a mais barata por m³', () => {
    const choice = chooseSellHub({
      base,
      hubs: [
        { id: 'a', name: 'A', outbound: { method: 'courier', transporter: '', perM3Rate: 900 } },
        { id: 'b', name: 'B', outbound: { method: 'courier', transporter: '', perM3Rate: 500 } },
      ],
    })
    expect(choice.hubKey).toBe('b')
    expect(choice.ratePerM3).toBe(500)
  })

  it('saída por JF usa o combustível resolvido daquele hub', () => {
    const choice = chooseSellHub({
      base,
      hubs: [{ id: 'a', name: 'A', outbound: rheaLeg() }],
      fuelByHub: new Map([['a', { isotopeUnitPrice: 590 }]]),
    })
    expect(choice.hubKey).toBe('a')
    expect(choice.ratePerM3).toBeCloseTo((12_000 * 590) / 144_000, 9)
  })

  it('saída sem preço de isótopo entra como 0 rotulado, não como grátis', () => {
    const choice = chooseSellHub({
      base,
      hubs: [{ id: 'a', name: 'A', outbound: rheaLeg() }],
    })
    expect(choice.hubKey).toBe('a')
    expect(choice.ratePerM3).toBe(0)
    expect(choice.note).toBe('no_isotope_price')
  })
})

describe('a chave do hub liga o preço à perna que o traz', () => {
  it('estrutura pelo id; fontes públicas pelos ids reservados', () => {
    expect(hubKeyFor('structure', '60003760')).toBe('60003760')
    expect(hubKeyFor('region')).toBe(REGION_HUB_ID)
    expect(hubKeyFor('jita')).toBe(JITA_HUB_ID)
  })
})
