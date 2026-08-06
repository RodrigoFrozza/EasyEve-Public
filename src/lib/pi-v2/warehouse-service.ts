/**
 * Camada de dados do Armazém: busca os assets e entrega o estoque pronto.
 *
 * Duas responsabilidades, as duas com a mesma disciplina do resto do módulo:
 *
 *  1. **Ler os containers designados** e somar o que há dentro (`readWarehouse`).
 *  2. **Listar candidatos** para o jogador escolher qual container é o armazém
 *     (`listWarehouseCandidates`) — sob demanda, só quando ele abre a config.
 *
 * Falha nunca é invisível. O scope é checado ANTES da chamada (dá um estado
 * próprio, `no_scope`, em vez de um erro genérico), e `getCharacterAssets` é
 * chamado com `throwOnError` porque o default dele devolve `[]` em erro — um
 * armazém "vazio" por falha de ESI viraria desconto indevido na lista de compra.
 */

import {
  getCharacterAssetNames,
  getCharacterAssets,
  getStructureNamesBatch,
  hasAssetReadScope,
  logger,
  safeDecryptToken,
} from '@/lib/pi-v2/host'
import {
  buildWarehouseItems,
  buildWarehouseStock,
  isWarehouseItem,
  type CharacterAssetsResult,
  type EsiAssetItem,
  type WarehouseContainerConfig,
  type WarehouseContainerStatus,
  type WarehouseItemStatus,
  type WarehouseView,
} from '@/lib/pi-v2/warehouse'

export type { WarehouseView }

export interface WarehouseCharacter {
  id: number
  name: string
  accessToken?: string | null
}

export interface ReadWarehouseInput {
  characters: WarehouseCharacter[]
  config: WarehouseContainerConfig[]
  /** Consumo do portfólio por hora, por typeId — a base da autonomia. */
  consumptionPerHour: Map<number, number>
  /** Cadência de visita: a régua de "acabando". */
  cadenceHrs: number
}

/** Busca os assets de um personagem, classificando a falha em vez de engoli-la. */
async function fetchCharacterAssets(
  character: WarehouseCharacter
): Promise<CharacterAssetsResult> {
  // O scope é checado antes: sem ele nem vale gastar a chamada, e o estado próprio
  // deixa a tela dizer "re-autorize este personagem" em vez de "falhou".
  if (!hasAssetReadScope(safeDecryptToken(character.accessToken) ?? '')) {
    return { ok: false, reason: 'no_scope' }
  }
  try {
    const assets = (await getCharacterAssets(character.id, {
      throwOnError: true,
    })) as EsiAssetItem[]
    return { ok: true, assets }
  } catch (error) {
    logger.warn('PiV2Warehouse', `Assets do personagem ${character.id} falharam`, error)
    return { ok: false, reason: 'fetch_failed' }
  }
}

export async function readWarehouse(input: ReadWarehouseInput): Promise<WarehouseView> {
  const { characters, config, consumptionPerHour, cadenceHrs } = input

  // Só os personagens que de fato têm container configurado: ler assets de quem
  // não tem armazém seria chamada de ESI para jogar fora.
  const neededIds = new Set(config.map((c) => c.characterId))
  const owners = characters.filter((c) => neededIds.has(c.id))

  const results = await Promise.all(
    owners.map(async (character) => [character.id, await fetchCharacterAssets(character)] as const)
  )

  const stock = buildWarehouseStock({
    config,
    assetsByCharacter: new Map(results),
  })

  return {
    stock: stock.byType,
    containers: stock.containers,
    items: buildWarehouseItems({
      stock: stock.byType,
      consumptionPerHour,
      cadenceHrs,
    }),
    incomplete: stock.incomplete,
    fetchedAt: new Date().toISOString(),
  }
}

/** Um container que o jogador pode designar como armazém. */
export interface WarehouseCandidate {
  itemId: number
  /** Nome dado em jogo, quando houver; senão o rótulo do tipo. */
  name: string
  typeId: number
  characterId: number
  characterName: string
  /** Onde está — nome da estrutura quando dá para resolver, senão o id. */
  locationName: string
  locationId: number
  /** true quando está na base central: é quase sempre o que ele quer. */
  atBase: boolean
  /** Quantos tipos de PI/isótopo tem dentro — ajuda a reconhecer o certo. */
  piTypeCount: number
  /** Tipos que não são PI. */
  otherTypeCount: number
}

export interface ListCandidatesInput {
  characters: WarehouseCharacter[]
  /** Id da base central, para marcar os containers que estão nela. */
  baseId?: string | null
}

export interface ListCandidatesResult {
  candidates: WarehouseCandidate[]
  /** Personagens sem o scope: a tela pede re-autorização em vez de sumir com eles. */
  charactersWithoutScope: number[]
  /** Personagens cuja busca falhou. */
  charactersFailed: number[]
}

/**
 * Lista os containers de cada personagem.
 *
 * **Como se sabe que um item é container:** existe outro asset com
 * `location_id === item_id` dele. É a definição operacional — robusta, sem
 * depender de grupo do SDE, e cobre qualquer coisa que contenha (inclusive nave,
 * que é um armazém legítimo para quem guarda PI num freighter parado).
 */
export async function listWarehouseCandidates(
  input: ListCandidatesInput
): Promise<ListCandidatesResult> {
  const { characters, baseId } = input

  const charactersWithoutScope: number[] = []
  const charactersFailed: number[] = []
  const candidates: WarehouseCandidate[] = []

  const perCharacter = await Promise.all(
    characters.map(async (character) => ({
      character,
      result: await fetchCharacterAssets(character),
    }))
  )

  for (const { character, result } of perCharacter) {
    if (!result.ok) {
      if (result.reason === 'no_scope') charactersWithoutScope.push(character.id)
      else charactersFailed.push(character.id)
      continue
    }

    const assets = result.assets
    const byId = new Map(assets.map((a) => [a.item_id, a]))

    // Quem contém alguém é container. E de passagem contamos o conteúdo, que é o
    // que faz o jogador reconhecer o box certo na lista.
    const contents = new Map<number, { pi: Set<number>; other: Set<number> }>()
    for (const asset of assets) {
      if (!byId.has(asset.location_id)) continue
      const bucket = contents.get(asset.location_id) ?? { pi: new Set(), other: new Set() }
      if (isWarehouseItem(asset.type_id)) bucket.pi.add(asset.type_id)
      else bucket.other.add(asset.type_id)
      contents.set(asset.location_id, bucket)
    }
    if (contents.size === 0) continue

    const containerIds = [...contents.keys()]
    const [names, structureNames] = await Promise.all([
      getCharacterAssetNames(character.id, containerIds).catch(() => []),
      getStructureNamesBatch(
        [...new Set(containerIds.map((id) => byId.get(id)!.location_id))],
        character.id
      ).catch(() => new Map<number, string>()),
    ])
    const nameById = new Map(
      (names as Array<{ item_id: number; name: string }>).map((n) => [n.item_id, n.name])
    )

    for (const itemId of containerIds) {
      const asset = byId.get(itemId)!
      const bucket = contents.get(itemId)!
      const locationId = asset.location_id
      candidates.push({
        itemId,
        // Container sem nome em jogo cai no id: nunca inventamos um rótulo.
        name: nameById.get(itemId)?.trim() || `#${itemId}`,
        typeId: asset.type_id,
        characterId: character.id,
        characterName: character.name,
        locationId,
        locationName: structureNames.get(locationId) ?? String(locationId),
        atBase: baseId != null && String(locationId) === String(baseId),
        piTypeCount: bucket.pi.size,
        otherTypeCount: bucket.other.size,
      })
    }
  }

  // Os que estão na base primeiro, e entre eles os com mais PI dentro: é a ordem
  // em que ele vai reconhecer o container que procura.
  candidates.sort(
    (a, b) =>
      Number(b.atBase) - Number(a.atBase) ||
      b.piTypeCount - a.piTypeCount ||
      a.name.localeCompare(b.name)
  )

  return { candidates, charactersWithoutScope, charactersFailed }
}
