/**
 * O armazém: ler o que está DENTRO dos containers designados.
 *
 * O que estes testes travam é a razão de existir da árvore. Em `/assets` um item
 * dentro de um container tem `location_id` = `item_id` do container, então filtrar
 * pela estação não vê o conteúdo de container nenhum — mostraria estoque zero
 * exatamente para quem organiza o PI em containers, que é o caso do Rodrigo.
 *
 * E travam a outra metade: container **vazio** e container **não encontrado**
 * produzem o mesmo zero e significam o oposto.
 */

import {
  buildWarehouseItems,
  buildWarehouseStock,
  isWarehouseItem,
  type CharacterAssetsResult,
  type EsiAssetItem,
  type WarehouseContainerConfig,
} from '@/lib/pi-v2/warehouse'
import { getCommodityTier } from '@/lib/pi-v2/sde'

const BASE = 60_003_760 // UALX-3, uma estrutura: não é item de ninguém
const WATER = 3645 // P1
const STERILE = 2875 // P4
const NITROGEN = 17_888 // isótopo do Rhea — não é P0–P4
const TRITANIUM = 34 // nem PI nem isótopo

const CHAR = 90_001
const OTHER_CHAR = 90_002

const asset = (
  itemId: number,
  locationId: number,
  typeId: number,
  quantity = 1
): EsiAssetItem => ({
  item_id: itemId,
  location_id: locationId,
  type_id: typeId,
  quantity,
})

/** Um container é só um item que contém outros; o type_id dele não importa aqui. */
const CONTAINER_TYPE = 3465

const container = (itemId: number, locationId: number) =>
  asset(itemId, locationId, CONTAINER_TYPE)

function build(
  config: WarehouseContainerConfig[],
  assets: Record<number, CharacterAssetsResult>
) {
  return buildWarehouseStock({
    config,
    assetsByCharacter: new Map(Object.entries(assets).map(([id, r]) => [Number(id), r])),
  })
}

const cfg = (itemId: number, characterId = CHAR, name = `Box ${itemId}`) => ({
  itemId,
  name,
  characterId,
})

describe('teste 1 — a árvore: o que está dentro conta, o que está fora não', () => {
  // Armazém (1000) no hangar da base, com Water solto e um container aninhado.
  const assets: EsiAssetItem[] = [
    container(1000, BASE),
    asset(1001, 1000, WATER, 5000),
    container(1002, 1000), // container DENTRO do armazém
    asset(1003, 1002, STERILE, 10), // conteúdo do aninhado
    asset(1004, BASE, WATER, 999), // Water solto no hangar, FORA do armazém
  ]
  const result = build([cfg(1000)], { [CHAR]: { ok: true, assets } })

  it('soma o que está dentro do container designado', () => {
    expect(result.byType[WATER]).toBe(5000)
  })

  it('conta o conteúdo de container aninhado — a subida cobre de graça', () => {
    expect(result.byType[STERILE]).toBe(10)
  })

  it('NÃO conta o que está no hangar fora do armazém', () => {
    // Se contasse, seriam 5.999 de Water. É o filtro que a designação de container
    // existe para dar.
    expect(result.byType[WATER]).not.toBe(5999)
  })

  it('o container designado não é estoque dele mesmo — é o recipiente', () => {
    expect(result.byType[CONTAINER_TYPE]).toBeUndefined()
  })

  it('o container aninhado aparece como "outro item", não como PI', () => {
    const status = result.containers[0]!
    expect(status.state).toBe('ok')
    expect(status.piTypeCount).toBe(2) // Water + Sterile Conduits
    expect(status.otherTypeCount).toBe(1) // o container aninhado
  })

  it('está completo: nada ficou sem ler', () => {
    expect(result.incomplete).toBe(false)
  })
})

describe('teste 2 — dado inconsistente não trava nem conta', () => {
  it('ciclo de location_id é abandonado e registrado como anomalia', () => {
    // Dois itens apontando um para o outro: a subida alternaria para sempre.
    const assets: EsiAssetItem[] = [
      container(1000, BASE),
      asset(2000, 2001, WATER, 100),
      asset(2001, 2000, WATER, 100),
    ]
    const result = build([cfg(1000)], { [CHAR]: { ok: true, assets } })

    expect(result.byType[WATER]).toBeUndefined()
    expect(result.containers[0]!.anomalies).toBeGreaterThan(0)
  })

  it('aninhamento fundo demais não vira estoque adivinhado', () => {
    // Corrente de 12 níveis: passa do teto de 8 e a cadeia é abandonada.
    const assets: EsiAssetItem[] = [container(1000, BASE)]
    let parent = 1000
    for (let i = 0; i < 12; i += 1) {
      assets.push(container(3000 + i, parent))
      parent = 3000 + i
    }
    assets.push(asset(4000, parent, WATER, 77))

    const result = build([cfg(1000)], { [CHAR]: { ok: true, assets } })
    expect(result.byType[WATER]).toBeUndefined()
  })
})

describe('teste 3 — vários containers, de personagens diferentes', () => {
  const result = build([cfg(1000, CHAR), cfg(5000, OTHER_CHAR)], {
    [CHAR]: { ok: true, assets: [container(1000, BASE), asset(1001, 1000, WATER, 4000)] },
    [OTHER_CHAR]: { ok: true, assets: [container(5000, BASE), asset(5001, 5000, WATER, 1500)] },
  })

  it('somam por typeId', () => {
    expect(result.byType[WATER]).toBe(5500)
  })

  it('cada container reporta o seu estado', () => {
    expect(result.containers).toHaveLength(2)
    expect(result.containers.every((c) => c.state === 'ok')).toBe(true)
  })

  it('um container só é achado nos assets do PRÓPRIO dono', () => {
    // O 5000 é do OTHER_CHAR; procurá-lo nos assets do CHAR tem que dar not_found,
    // não silenciosamente somar.
    const wrong = build([cfg(5000, CHAR)], {
      [CHAR]: { ok: true, assets: [container(1000, BASE), asset(1001, 1000, WATER, 4000)] },
    })
    expect(wrong.containers[0]!.state).toBe('not_found')
    expect(wrong.byType[WATER]).toBeUndefined()
  })
})

describe('teste 4 — zero ≠ não sei: o que suspende o desconto', () => {
  it('vazio é estoque zero DE VERDADE, e desconta', () => {
    const result = build([cfg(1000)], {
      [CHAR]: { ok: true, assets: [container(1000, BASE)] },
    })
    expect(result.containers[0]!.state).toBe('empty')
    expect(result.incomplete).toBe(false)
  })

  it('não encontrado é config velha — não desconta e sai rotulado', () => {
    // `item_id` muda quando o container é reempacotado ou movido: a config aponta
    // para o nada, e isso não pode virar desconto zero em silêncio.
    const result = build([cfg(1000)], {
      [CHAR]: { ok: true, assets: [container(7777, BASE), asset(7778, 7777, WATER, 100)] },
    })
    expect(result.containers[0]!.state).toBe('not_found')
    expect(result.byType[WATER]).toBeUndefined()
    expect(result.incomplete).toBe(true)
  })

  it('sem o scope de assets, o container não desconta', () => {
    const result = build([cfg(1000)], { [CHAR]: { ok: false, reason: 'no_scope' } })
    expect(result.containers[0]!.state).toBe('no_scope')
    expect(result.incomplete).toBe(true)
  })

  it('falha de ESI não vira estoque zero', () => {
    const result = build([cfg(1000)], { [CHAR]: { ok: false, reason: 'fetch_failed' } })
    expect(result.containers[0]!.state).toBe('fetch_failed')
    expect(result.incomplete).toBe(true)
  })

  it('personagem nunca buscado conta como falha, não como vazio', () => {
    const result = build([cfg(1000)], {})
    expect(result.containers[0]!.state).toBe('fetch_failed')
    expect(result.incomplete).toBe(true)
  })

  it('um container ilegível não apaga o estoque dos outros', () => {
    // O desconto fica PARCIAL, não zerado: a lista pede demais, nunca de menos.
    const result = build([cfg(1000, CHAR), cfg(5000, OTHER_CHAR)], {
      [CHAR]: { ok: true, assets: [container(1000, BASE), asset(1001, 1000, WATER, 4000)] },
      [OTHER_CHAR]: { ok: false, reason: 'fetch_failed' },
    })
    expect(result.byType[WATER]).toBe(4000)
    expect(result.incomplete).toBe(true)
  })
})

describe('teste 9 — o filtro: PI e isótopo entram, o resto é contado à parte', () => {
  it('P0–P4 e isótopo são itens de armazém; Tritanium não', () => {
    expect(getCommodityTier(WATER)).toBe(1)
    expect(getCommodityTier(NITROGEN)).toBeUndefined()
    expect(isWarehouseItem(WATER)).toBe(true)
    expect(isWarehouseItem(STERILE)).toBe(true)
    // O isótopo não é P0–P4, mas o frete de JF o precifica: entra.
    expect(isWarehouseItem(NITROGEN)).toBe(true)
    expect(isWarehouseItem(TRITANIUM)).toBe(false)
  })

  it('o que não é PI fica fora do estoque, mas é contado', () => {
    const result = build([cfg(1000)], {
      [CHAR]: {
        ok: true,
        assets: [
          container(1000, BASE),
          asset(1001, 1000, WATER, 5000),
          asset(1002, 1000, NITROGEN, 40_000),
          asset(1003, 1000, TRITANIUM, 1_000_000),
        ],
      },
    })
    expect(result.byType[WATER]).toBe(5000)
    expect(result.byType[NITROGEN]).toBe(40_000)
    expect(result.byType[TRITANIUM]).toBeUndefined()
    // Contado para o jogador confirmar que designou o container certo.
    expect(result.containers[0]!.otherTypeCount).toBe(1)
    expect(result.containers[0]!.piTypeCount).toBe(2)
  })
})

describe('teste 8 — autonomia do portfólio', () => {
  const items = (
    stock: Record<number, number>,
    consumption: Array<[number, number]>,
    cadenceHrs = 24
  ) =>
    buildWarehouseItems({
      stock,
      consumptionPerHour: new Map(consumption),
      cadenceHrs,
    })

  it('autonomia é estoque ÷ consumo por hora', () => {
    // 48.240 unidades a 837/h = 57,6h ≈ 2,4 dias.
    const [item] = items({ [WATER]: 48_240 }, [[WATER, 837]])
    expect(item!.autonomyHrs).toBeCloseTo(48_240 / 837, 6)
    expect(item!.state).toBe('ok')
  })

  it('durar menos que a cadência é "acabando"', () => {
    const [item] = items({ [WATER]: 1000 }, [[WATER, 100]], 24) // 10h < 24h
    expect(item!.state).toBe('running_low')
  })

  it('consumido e sem estoque é "faltando"', () => {
    const [item] = items({}, [[WATER, 100]])
    expect(item!.state).toBe('missing')
    expect(item!.quantity).toBe(0)
    expect(item!.autonomyHrs).toBe(0)
  })

  it('sem consumo NÃO é autonomia infinita — é ausência de consumo', () => {
    // `null` de propósito: a tela precisa dizer "não é consumido", não "dura para
    // sempre", que soam iguais e não são.
    const [item] = items({ [STERILE]: 500 }, [])
    expect(item!.autonomyHrs).toBeNull()
    expect(item!.state).toBe('not_consumed')
  })

  it('estoque 0 e consumo 0 não gera linha — não é falta nem sobra', () => {
    expect(items({ [WATER]: 0 }, [])).toHaveLength(0)
  })

  it('ordena por quem acaba primeiro; sem consumo vai para o fim', () => {
    const list = items(
      { [WATER]: 1000, [STERILE]: 500, [NITROGEN]: 100_000 },
      [
        [WATER, 100], // 10h → running_low
        [NITROGEN, 10], // 10.000h → ok
        [2351, 5], // faltando
      ]
    )
    expect(list.map((i) => i.state)).toEqual(['missing', 'running_low', 'ok', 'not_consumed'])
  })
})
