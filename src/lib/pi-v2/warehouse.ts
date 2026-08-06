/**
 * Armazém de PI — o estoque que está no container, não no planeta.
 *
 * Fecha a única limitação aberta da lista de compra: até aqui ela descontava só o
 * estoque DENTRO das colônias (o que a ESI de PI expõe), e o material parado num
 * container da base não era contado. A quantidade pedida ficava maior que a real,
 * e a diferença era justamente o que o Rodrigo já descontava à mão.
 *
 * O jogador designa **um ou mais containers** (possivelmente de personagens
 * diferentes) e o módulo soma o que há dentro deles, por typeId.
 *
 * ## Por que uma árvore, e não um filtro
 *
 * Em `/characters/{id}/assets/` um item **dentro de um container** tem
 * `location_id` = `item_id` **do container**, não o id da estação. Filtrar por
 * estação, portanto, **não vê o conteúdo de container nenhum** — mostraria estoque
 * zero exatamente para quem organiza o PI em containers. Então subimos a cadeia de
 * `location_id` até uma raiz configurada (conta) ou até um id que não é item de
 * ninguém (é estação/estrutura: não conta). Container dentro de container sai de
 * graça.
 *
 * ## Zero ≠ não sei, mais uma vez
 *
 * Container vazio e container **que não foi encontrado** produzem o mesmo zero e
 * significam o oposto. `item_id` de container muda quando ele é reempacotado ou
 * movido, então config velha aponta para o nada — e isso NÃO pode virar desconto
 * zero em silêncio, nem estoque zero na tela. Cada container carrega o seu estado,
 * e só `ok`/`empty` entram no desconto.
 *
 * Note que aqui o erro inverte de direção: deixar de contar estoque faz o jogador
 * comprar **em excesso**, não faltar. É menos grave que o contrário — e continua
 * tendo que ser dito.
 *
 * Puro: recebe assets já buscados e devolve números. Nenhuma dependência de ESI.
 */

import { getCommodityName, getCommodityTier, type PiCommodityTier } from '@/lib/pi-v2/sde'
import { PI_ISOTOPE_TYPE_IDS } from '@/lib/pi-v2/jf-data'

/** Um container designado como armazém. */
export interface WarehouseContainerConfig {
  /** `item_id` do container nos assets. É a raiz da árvore. */
  itemId: number
  /** Nome (do `/assets/names/`) ou o tipo — rótulo de tela e de mensagem de erro. */
  name: string
  /** Dono. Assets são por personagem, e container pessoal só o dono enxerga. */
  characterId: number
  /** Onde estava quando foi escolhido, para o jogador reconhecer. */
  locationName?: string
}

/** O formato que a ESI devolve, reduzido ao que este módulo usa. */
export interface EsiAssetItem {
  item_id: number
  type_id: number
  quantity: number
  location_id: number
  location_flag?: string
}

/** Assets de um personagem, ou o motivo de não termos. */
export type CharacterAssetsResult =
  | { ok: true; assets: EsiAssetItem[] }
  | { ok: false; reason: 'no_scope' | 'fetch_failed' }

export type WarehouseContainerState =
  /** Encontrado, com conteúdo. */
  | 'ok'
  /** Encontrado e vazio — estoque zero DE VERDADE. */
  | 'empty'
  /** O `item_id` não existe nos assets do dono: config velha (reempacotado, movido, vendido). */
  | 'not_found'
  /** O personagem não concedeu `esi-assets`. */
  | 'no_scope'
  /** A ESI falhou para aquele personagem. */
  | 'fetch_failed'

/** Os estados que podem alimentar o desconto. Os outros suspendem o dele. */
const COUNTED_STATES: ReadonlySet<WarehouseContainerState> = new Set(['ok', 'empty'])

export function containerCounts(state: WarehouseContainerState): boolean {
  return COUNTED_STATES.has(state)
}

export interface WarehouseContainerStatus {
  itemId: number
  name: string
  characterId: number
  state: WarehouseContainerState
  /** Tipos de PI/isótopo distintos encontrados dentro. */
  piTypeCount: number
  /**
   * Tipos distintos que NÃO são PI nem isótopo. Não entram no estoque, mas são
   * contados: é como o jogador confirma que designou o container certo.
   */
  otherTypeCount: number
  /** Cadeias de `location_id` truncadas por profundidade — dado inconsistente. */
  anomalies: number
}

export interface WarehouseStock {
  /** typeId → quantidade. Só do que de fato conta (containers `ok`/`empty`). */
  byType: Record<number, number>
  containers: WarehouseContainerStatus[]
  /**
   * true quando algum container não pôde ser lido. O desconto fica PARCIAL e a
   * tela é obrigada a dizer que a lista pode estar pedindo demais.
   */
  incomplete: boolean
}

/**
 * Teto de profundidade da subida. Oito níveis cobrem qualquer aninhamento real
 * (container em container em nave em hangar) com folga; passar disso é dado
 * inconsistente ou ciclo, e aí a cadeia é abandonada em vez de travar.
 */
const MAX_DEPTH = 8

/** O que interessa no armazém: PI (P0–P4) e o isótopo que o JF queima. */
const ISOTOPES: ReadonlySet<number> = new Set(PI_ISOTOPE_TYPE_IDS)

export function isWarehouseItem(typeId: number): boolean {
  return getCommodityTier(typeId) != null || ISOTOPES.has(typeId)
}

/**
 * Sobe a cadeia de `location_id` procurando uma das raízes configuradas.
 *
 * Devolve a raiz que contém o item, `null` quando ele está fora de qualquer
 * container designado (chegou numa estação/estrutura), e marca `anomaly` quando a
 * cadeia passou do teto de profundidade.
 */
function findRootContainer(
  asset: EsiAssetItem,
  byId: Map<number, EsiAssetItem>,
  roots: ReadonlySet<number>
): { root: number | null; anomaly: boolean } {
  let current = asset
  for (let depth = 0; depth < MAX_DEPTH; depth += 1) {
    if (roots.has(current.location_id)) return { root: current.location_id, anomaly: false }
    const parent = byId.get(current.location_id)
    // Sem pai: o `location_id` é uma estação ou estrutura, não um item. Fim da linha.
    if (!parent) return { root: null, anomaly: false }
    current = parent
  }
  return { root: null, anomaly: true }
}

export interface BuildWarehouseStockInput {
  config: WarehouseContainerConfig[]
  /** Resultado da busca de assets por personagem. Ausente = nunca buscado. */
  assetsByCharacter: Map<number, CharacterAssetsResult>
}

export function buildWarehouseStock(input: BuildWarehouseStockInput): WarehouseStock {
  const { config, assetsByCharacter } = input

  const byType: Record<number, number> = {}
  const containers: WarehouseContainerStatus[] = []

  // Agrupado por personagem: a árvore é montada uma vez por conjunto de assets, e
  // um container só pode ser achado nos assets do próprio dono.
  const configByCharacter = new Map<number, WarehouseContainerConfig[]>()
  for (const entry of config) {
    const list = configByCharacter.get(entry.characterId) ?? []
    list.push(entry)
    configByCharacter.set(entry.characterId, list)
  }

  for (const [characterId, entries] of configByCharacter) {
    const result = assetsByCharacter.get(characterId)

    // Sem assets deste personagem: o estado do erro vale para todos os containers
    // dele, e nenhum deles desconta.
    if (!result || !result.ok) {
      const state: WarehouseContainerState = !result ? 'fetch_failed' : result.reason
      for (const entry of entries) {
        containers.push({ ...entry, state, piTypeCount: 0, otherTypeCount: 0, anomalies: 0 })
      }
      continue
    }

    const byId = new Map(result.assets.map((asset) => [asset.item_id, asset]))
    const roots = new Set(entries.map((entry) => entry.itemId))
    const found = new Set(result.assets.filter((a) => roots.has(a.item_id)).map((a) => a.item_id))

    const perRoot = new Map<
      number,
      { piTypes: Set<number>; otherTypes: Set<number>; anomalies: number }
    >()
    for (const root of roots) {
      perRoot.set(root, { piTypes: new Set(), otherTypes: new Set(), anomalies: 0 })
    }

    for (const asset of result.assets) {
      // O container designado não é estoque dele mesmo: é o recipiente.
      if (roots.has(asset.item_id)) continue

      const { root, anomaly } = findRootContainer(asset, byId, roots)
      if (anomaly) {
        // Cadeia truncada: não sabemos onde este item está, então ele não entra.
        for (const bucket of perRoot.values()) bucket.anomalies += 1
        continue
      }
      if (root == null) continue

      const bucket = perRoot.get(root)!
      if (isWarehouseItem(asset.type_id)) {
        bucket.piTypes.add(asset.type_id)
        byType[asset.type_id] = (byType[asset.type_id] ?? 0) + asset.quantity
      } else {
        bucket.otherTypes.add(asset.type_id)
      }
    }

    for (const entry of entries) {
      const bucket = perRoot.get(entry.itemId)!
      // Não achado é diferente de vazio: o primeiro é config velha apontando para
      // o nada, e não pode virar desconto zero em silêncio.
      const state: WarehouseContainerState = !found.has(entry.itemId)
        ? 'not_found'
        : bucket.piTypes.size === 0 && bucket.otherTypes.size === 0
          ? 'empty'
          : 'ok'
      containers.push({
        ...entry,
        state,
        piTypeCount: bucket.piTypes.size,
        otherTypeCount: bucket.otherTypes.size,
        anomalies: bucket.anomalies,
      })
    }
  }

  return {
    byType,
    containers,
    incomplete: containers.some((c) => !containerCounts(c.state)),
  }
}

/**
 * O armazém como a tela o consome.
 *
 * Vive aqui, e não na camada de dados, porque o CLIENTE o usa — e `warehouse.ts`
 * é puro (só SDE e dado gerado), então importá-lo do navegador não arrasta ESI
 * nem Prisma para o bundle.
 */
export interface WarehouseView {
  /** typeId → quantidade. Só do que de fato conta. */
  stock: Record<number, number>
  containers: WarehouseContainerStatus[]
  /** Itens com consumo e autonomia, ordenados por quem acaba primeiro. */
  items: WarehouseItemStatus[]
  /** Algum container não pôde ser lido: o estoque está PARCIAL. */
  incomplete: boolean
  /** Quando os assets foram lidos. Herda o selo de idade do módulo. */
  fetchedAt: string
}

/** Como o item do armazém se comporta frente ao consumo do portfólio. */
export type WarehouseItemState =
  /** Dura mais que a cadência de visita. */
  | 'ok'
  /** Dura menos que a cadência: vai acabar antes da próxima volta. */
  | 'running_low'
  /** O portfólio consome e o armazém não tem nada. */
  | 'missing'
  /** Está no armazém, mas nenhuma colônia consome. */
  | 'not_consumed'

export interface WarehouseItemStatus {
  typeId: number
  name: string
  tier?: PiCommodityTier
  quantity: number
  consumptionPerHour: number
  /**
   * Horas que o estoque cobre. `null` quando nada consome — o que **não** é
   * autonomia infinita, é ausência de consumo. A tela precisa dizer a diferença.
   */
  autonomyHrs: number | null
  state: WarehouseItemState
}

export interface BuildWarehouseItemsInput {
  /** Estoque somado — o `byType` de `buildWarehouseStock`. */
  stock: Record<number, number>
  /** Consumo por hora do portfólio, por typeId (do modelo de demanda). */
  consumptionPerHour: Map<number, number>
  /** Cadência de visita: a régua de "acabando", a mesma dos alertas de buffer. */
  cadenceHrs: number
}

/**
 * A autonomia é **do portfólio**, não da colônia.
 *
 * O material vai para colônias específicas, então este número responde "quanto
 * tempo até eu precisar comprar", e **não** "a colônia X vai parar". Como número
 * de compra é o que interessa; como alarme seria enganoso, e o alarme por colônia
 * continua onde já está (os eventos de buffer).
 */
export function buildWarehouseItems(input: BuildWarehouseItemsInput): WarehouseItemStatus[] {
  const { stock, consumptionPerHour, cadenceHrs } = input

  const typeIds = new Set<number>([
    ...Object.keys(stock).map(Number),
    ...consumptionPerHour.keys(),
  ])

  const items: WarehouseItemStatus[] = []
  for (const typeId of typeIds) {
    const quantity = stock[typeId] ?? 0
    const consumption = consumptionPerHour.get(typeId) ?? 0
    // Estoque 0 e consumo 0 não é linha: não é falta nem sobra, é ausência de assunto.
    if (quantity <= 0 && consumption <= 0) continue

    const autonomyHrs = consumption > 0 ? quantity / consumption : null

    let state: WarehouseItemState
    if (consumption <= 0) state = 'not_consumed'
    else if (quantity <= 0) state = 'missing'
    else if (autonomyHrs != null && autonomyHrs < cadenceHrs) state = 'running_low'
    else state = 'ok'

    items.push({
      typeId,
      name: getCommodityName(typeId),
      tier: getCommodityTier(typeId),
      quantity,
      consumptionPerHour: consumption,
      autonomyHrs,
      state,
    })
  }

  // Quem acaba primeiro aparece primeiro; sem consumo vai para o fim.
  const rank: Record<WarehouseItemState, number> = {
    missing: 0,
    running_low: 1,
    ok: 2,
    not_consumed: 3,
  }
  items.sort(
    (a, b) =>
      rank[a.state] - rank[b.state] ||
      (a.autonomyHrs ?? Number.POSITIVE_INFINITY) - (b.autonomyHrs ?? Number.POSITIVE_INFINITY) ||
      a.name.localeCompare(b.name)
  )
  return items
}
