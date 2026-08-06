/**
 * Migração da config de frete — o teste que protege trabalho manual.
 *
 * A config das Etapas 5 e 7 é do Rodrigo e foi feita à mão: ele consultou a
 * transportadora, digitou os termos do contrato, mediu o ISK/m³ do JF cheio. O
 * redesenho da Etapa 8 troca a FORMA de guardar isso. Se a migração perder um
 * número, o prejuízo é o trabalho dele — não um bug de tela.
 *
 * A regra: **nada se perde e nada se inventa.** Em particular, `0` não vira preço:
 * hub sem frete configurado sai SEM perna, e a tela o rotula.
 */

import {
  readFreightPrefs,
  readLegacyStructureRates,
  seedHubsFromLegacy,
} from '@/lib/pi-v2/freight-prefs'
import { JITA_HUB_ID, REGION_HUB_ID } from '@/lib/pi-v2/pricing/freight-model'

const hubById = (prefs: ReturnType<typeof readFreightPrefs>, id: string) =>
  prefs.hubs.find((hub) => hub.id === id)

describe('teste 6 — a config das Etapas 5/7 vira base + hubs sem perda', () => {
  // Exatamente a config real: UALX-3 é a base (frete 0), C-J6 tem contrato de
  // courier com os termos da ITL, e Jita tinha o ISK/m³ solto.
  const stored = {
    groupByCharacter: false,
    shoppingPeriodHrs: 168,
    buyStations: [
      { id: '60003760', name: 'UALX-3 - Mothership Bellicose', freightPerM3: 0, freightMode: 'local' },
      {
        id: '61000001',
        name: 'C-J6MT - Fortizar',
        freightPerM3: 800,
        freightMode: 'contract',
        contract: {
          transporter: 'ITL',
          perM3Rate: 800,
          fullLoadReward: 280_000_000,
          fullLoadVolumeM3: 350_000,
          collateralRate: 0.005,
          minReward: 20_000_000,
        },
      },
    ],
    regionFreightPerM3: 0,
    jitaFreightPerM3: 800,
  }

  const prefs = readFreightPrefs(stored)

  it('a estação que era `local` vira a base central', () => {
    expect(prefs.baseHub).toEqual({ id: '60003760', name: 'UALX-3 - Mothership Bellicose' })
    // E sai da lista de hubs: ela é o destino, não uma origem a alcançar.
    expect(hubById(prefs, '60003760')).toBeUndefined()
  })

  it('o contrato da ITL atravessa inteiro, termo por termo', () => {
    const leg = hubById(prefs, '61000001')!.inbound!
    expect(leg).toEqual({
      method: 'courier',
      transporter: 'ITL',
      perM3Rate: 800,
      fullLoadReward: 280_000_000,
      fullLoadVolumeM3: 350_000,
      collateralRate: 0.005,
      minReward: 20_000_000,
    })
  })

  it('Jita, que era um número solto, vira hub com courier de per m³', () => {
    expect(hubById(prefs, JITA_HUB_ID)!.inbound).toEqual({
      method: 'courier',
      transporter: '',
      perM3Rate: 800,
      fullLoadReward: null,
      fullLoadVolumeM3: null,
      collateralRate: null,
      minReward: null,
    })
  })

  it('Região com 0 vira hub SEM perna — "não configurado", não "grátis"', () => {
    const region = hubById(prefs, REGION_HUB_ID)!
    expect(region.inbound).toBeUndefined()
  })

  it('marca que houve migração, para o hook guardar o backup antes de gravar', () => {
    expect(prefs.migrated).toBe(true)
  })

  it('as duas fontes públicas existem sempre, mesmo em config vazia', () => {
    const vazio = readFreightPrefs({})
    expect(vazio.hubs.map((h) => h.id)).toEqual([REGION_HUB_ID, JITA_HUB_ID])
    expect(vazio.baseHub).toBeNull()
    expect(vazio.migrated).toBe(false)
  })
})

describe('fora da base, frete 0 é "não configurado" — nunca "local"', () => {
  // O caso que apareceu na config real do Rodrigo no primeiro deploy: UALX e C-J6
  // estavam as duas com frete 0. UALX virou a base (certo) e C-J6 virou hub
  // `local` (errado): a tela dizia "você já está nesta estação" sobre um hub a
  // jumps de distância, e ele entrava na escolha por custo efetivo com frete 0
  // sem nenhum aviso.
  const prefs = readFreightPrefs({
    buyStations: [
      { id: '60003760', name: 'UALX-3', freightPerM3: 0, freightMode: 'local' },
      { id: '61000001', name: 'C-J6MT', freightPerM3: 0, freightMode: 'local' },
    ],
  })

  it('a primeira vira a base', () => {
    expect(prefs.baseHub).toEqual({ id: '60003760', name: 'UALX-3' })
  })

  it('a segunda vira hub SEM perna, para a tela poder rotular', () => {
    const cj6 = hubById(prefs, '61000001')!
    expect(cj6).toBeDefined()
    expect(cj6.inbound).toBeUndefined()
  })

  it('`local` já gravado num hub é descartado na leitura, não só na migração', () => {
    // Conserta a config de quem abriu a tela antes deste fix: `local` num hub
    // nunca foi válido, então a leitura o trata como perna ausente.
    const novo = readFreightPrefs({
      baseHub: { id: '60003760', name: 'UALX-3' },
      hubs: [{ id: '61000001', name: 'C-J6MT', inbound: { method: 'local' } }],
    })
    expect(hubById(novo, '61000001')!.inbound).toBeUndefined()
  })
})

describe('estação com frete numérico solto (Etapa 5, sem modo)', () => {
  const prefs = readFreightPrefs({
    buyStations: [
      { id: '1', name: 'UALX-3', freightPerM3: 0 },
      { id: '2', name: 'C-J6MT', freightPerM3: 208 },
    ],
  })

  it('frete 0 e sem contrato é a base dele', () => {
    expect(prefs.baseHub).toEqual({ id: '1', name: 'UALX-3' })
  })

  it('o número que ele já validou continua valendo, agora como per m³', () => {
    const leg = hubById(prefs, '2')!.inbound!
    expect(leg.method).toBe('courier')
    expect(leg).toMatchObject({ perM3Rate: 208 })
  })
})

describe('formato novo é lido de volta sem alteração', () => {
  it('base, courier e JF sobrevivem a um round-trip', () => {
    const prefs = readFreightPrefs({
      baseHub: { id: '60003760', name: 'UALX-3' },
      hubs: [
        {
          id: '61000001',
          name: 'C-J6MT',
          inbound: { method: 'jf', jfTypeId: 28844, isotopeQtyRoundTrip: 12_000, cargoM3: 144_000 },
          // A saída já é preservada, mesmo sem UI: ela entra com o P&L, e perdê-la
          // aqui obrigaria o jogador a reconfigurar tudo depois.
          outbound: { method: 'courier', transporter: 'GDSO', perM3Rate: 500 },
        },
        { id: JITA_HUB_ID, name: 'Jita', inbound: { method: 'courier', transporter: 'ITL', perM3Rate: 800 } },
      ],
    })
    expect(prefs.baseHub).toEqual({ id: '60003760', name: 'UALX-3' })
    const cj6 = hubById(prefs, '61000001')!
    expect(cj6.inbound).toEqual({
      method: 'jf',
      jfTypeId: 28844,
      isotopeQtyRoundTrip: 12_000,
      cargoM3: 144_000,
      refuelAt: undefined,
    })
    expect(cj6.outbound).toMatchObject({ method: 'courier', transporter: 'GDSO', perM3Rate: 500 })
    expect(hubById(prefs, JITA_HUB_ID)!.inbound).toMatchObject({ perM3Rate: 800 })
    expect(prefs.migrated).toBe(false)
  })

  it('perna com método desconhecido é descartada em vez de adivinhada', () => {
    const prefs = readFreightPrefs({
      hubs: [{ id: '1', name: 'X', inbound: { method: 'teleporte', perM3Rate: 10 } }],
    })
    expect(hubById(prefs, '1')!.inbound).toBeUndefined()
  })

  it('número inválido guardado não vira NaN no preço', () => {
    const prefs = readFreightPrefs({
      hubs: [
        {
          id: '1',
          name: 'X',
          inbound: { method: 'courier', transporter: 'ITL', perM3Rate: 'muito', minReward: -5 },
        },
      ],
    })
    expect(hubById(prefs, '1')!.inbound).toMatchObject({ perM3Rate: null, minReward: null })
  })
})

describe('formato mais antigo (freight.structure*), cujos ids vinham do servidor', () => {
  const stored = {
    groupByCharacter: false,
    shoppingPeriodHrs: 48,
    freight: { structure: 0, structure2: 208, region: 0, jita: 800 },
  }

  it('os fretes públicos migram sozinhos', () => {
    const prefs = readFreightPrefs(stored)
    expect(hubById(prefs, JITA_HUB_ID)!.inbound).toMatchObject({ perM3Rate: 800 })
    expect(hubById(prefs, REGION_HUB_ID)!.inbound).toBeUndefined()
    // Sem os ids, nenhuma estrutura pode ser inventada aqui.
    expect(prefs.baseHub).toBeNull()
    expect(prefs.hubs).toHaveLength(2)
  })

  it('as duas estruturas entram pela semeadura, com o frete que tinham', () => {
    expect(readLegacyStructureRates(stored)).toEqual([0, 208])
    const seeded = seedHubsFromLegacy(
      [
        { id: '60003760', name: 'UALX-3' },
        { id: '61000001', name: 'C-J6MT' },
      ],
      [0, 208]
    )
    // A de frete 0 é a base — é assim que a config antiga dizia "estou aqui".
    expect(seeded.baseHub).toEqual({ id: '60003760', name: 'UALX-3' })
    expect(seeded.hubs).toHaveLength(1)
    expect(seeded.hubs[0]!.inbound).toMatchObject({ method: 'courier', perM3Rate: 208 })
  })

  it('config já migrada não semeia de novo', () => {
    expect(readLegacyStructureRates({ buyStations: [] })).toEqual([])
    expect(readLegacyStructureRates({ hubs: [] })).toEqual([])
  })
})
