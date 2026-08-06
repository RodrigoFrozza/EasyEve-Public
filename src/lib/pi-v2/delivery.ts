/**
 * Entrega — **o que levar para cada personagem, e para cada planeta dele.**
 *
 * A lista de compra responde "o que comprar e onde"; ela é agrupada por HUB,
 * porque é assim que a compra é executada (uma ida por hub). Mas a compra é só
 * metade da rodada: depois de comprado, o material precisa ser distribuído — e aí
 * o agrupamento útil é outro, o de **destino**: logar num personagem, carregar o
 * que os planetas dele consomem, subir. Um multibuy da lista inteira não diz
 * quanto de cada coisa desce em qual planeta.
 *
 * ## A quantidade aqui é BRUTA, de propósito
 *
 * É o consumo do período naquele destino, **sem descontar** o que já está no
 * launchpad e sem descontar o Armazém. A lista de compra desconta (compra-se o
 * que falta); a entrega, não (leva-se o que o planeta consome). São perguntas
 * diferentes e é esperado que os dois totais não batam — a tela diz isso em vez
 * de deixar o jogador achar que um dos dois está errado.
 *
 * ## Arredondamento
 *
 * Cada destino arredonda **para cima**, individualmente: não se entrega 0,4 de
 * Water, e arredondar para baixo deixaria o planeta seco no fim do período. Como
 * efeito, a soma das entregas pode passar em algumas unidades do total bruto da
 * lista de compra, que arredonda uma vez só no agregado. É o lado certo do erro.
 *
 * Puro e client-safe: consome apenas o que `ShoppingLine` já carrega. Nenhum
 * import de SDE, ESI ou Prisma — este módulo roda no botão de copiar.
 */

import type { PiCommodityTier } from '@/lib/pi-v2/sde'
import type { ShoppingLine } from '@/lib/pi-v2/shopping-types'

export interface DeliveryItem {
  typeId: number
  name: string
  tier?: PiCommodityTier
  /** Consumo BRUTO do período neste destino, arredondado para cima. */
  quantity: number
  volumePerUnit: number
  totalVolumeM3: number
}

export interface DeliveryPlanet {
  planetId: number
  planetName?: string
  items: DeliveryItem[]
  totalVolumeM3: number
}

export interface DeliveryCharacter {
  characterId: number
  characterName: string
  /** Os planetas deste personagem, cada um com o que consome. */
  planets: DeliveryPlanet[]
  /**
   * O mesmo material somado nos planetas dele — o que ele carrega numa ida só.
   *
   * ⚠️ Não é a soma exata dos planetas: cada planeta arredonda para cima, e o
   * agregado do personagem arredonda uma vez. A diferença é de unidades.
   */
  items: DeliveryItem[]
  totalVolumeM3: number
}

function tierRank(tier?: PiCommodityTier): number {
  return tier ?? -1
}

/** Tier primeiro, nome depois: a ordem em que o material é reconhecido no hangar. */
function sortItems(items: DeliveryItem[]): DeliveryItem[] {
  return items.sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || a.name.localeCompare(b.name))
}

interface Accumulator {
  typeId: number
  name: string
  tier?: PiCommodityTier
  volumePerUnit: number
  /** Cru, ainda fracionário — só o total vira unidade inteira. */
  raw: number
}

function finish(acc: Map<number, Accumulator>): { items: DeliveryItem[]; totalVolumeM3: number } {
  const items: DeliveryItem[] = []
  let totalVolumeM3 = 0
  for (const entry of acc.values()) {
    const quantity = Math.ceil(entry.raw)
    if (quantity <= 0) continue
    const totalM3 = quantity * entry.volumePerUnit
    totalVolumeM3 += totalM3
    items.push({
      typeId: entry.typeId,
      name: entry.name,
      tier: entry.tier,
      quantity,
      volumePerUnit: entry.volumePerUnit,
      totalVolumeM3: totalM3,
    })
  }
  return { items: sortItems(items), totalVolumeM3 }
}

function add(acc: Map<number, Accumulator>, line: ShoppingLine, quantity: number): void {
  const entry = acc.get(line.typeId) ?? {
    typeId: line.typeId,
    name: line.name,
    tier: line.tier,
    volumePerUnit: line.volumePerUnit,
    raw: 0,
  }
  entry.raw += quantity
  acc.set(line.typeId, entry)
}

/**
 * Vira a lista de compra do avesso: de "por hub de origem" para "por destino".
 *
 * A fonte é o `breakdown` de cada linha, que o modelo de demanda já produz por
 * (personagem, planeta) — nenhuma conta nova, nenhum caminho paralelo de cálculo.
 */
export function buildDelivery(lines: ShoppingLine[]): DeliveryCharacter[] {
  const byCharacter = new Map<
    number,
    {
      characterId: number
      characterName: string
      total: Map<number, Accumulator>
      planets: Map<number, { planetId: number; planetName?: string; acc: Map<number, Accumulator> }>
    }
  >()

  for (const line of lines) {
    for (const entry of line.breakdown) {
      if (entry.quantity <= 0) continue
      const character = byCharacter.get(entry.characterId) ?? {
        characterId: entry.characterId,
        characterName: entry.characterName,
        total: new Map<number, Accumulator>(),
        planets: new Map<
          number,
          { planetId: number; planetName?: string; acc: Map<number, Accumulator> }
        >(),
      }
      const planet = character.planets.get(entry.planetId) ?? {
        planetId: entry.planetId,
        planetName: entry.planetName,
        acc: new Map<number, Accumulator>(),
      }
      add(planet.acc, line, entry.quantity)
      add(character.total, line, entry.quantity)
      character.planets.set(entry.planetId, planet)
      byCharacter.set(entry.characterId, character)
    }
  }

  const characters: DeliveryCharacter[] = []
  for (const character of byCharacter.values()) {
    const planets: DeliveryPlanet[] = []
    for (const planet of character.planets.values()) {
      const { items, totalVolumeM3 } = finish(planet.acc)
      if (items.length === 0) continue
      planets.push({
        planetId: planet.planetId,
        planetName: planet.planetName,
        items,
        totalVolumeM3,
      })
    }
    if (planets.length === 0) continue
    // Nome quando há; senão o id — nunca um rótulo inventado.
    planets.sort((a, b) =>
      (a.planetName ?? String(a.planetId)).localeCompare(b.planetName ?? String(b.planetId))
    )
    const { items, totalVolumeM3 } = finish(character.total)
    characters.push({
      characterId: character.characterId,
      characterName: character.characterName,
      planets,
      items,
      totalVolumeM3,
    })
  }

  // Ordem alfabética de personagem: a entrega não tem urgência própria (quem está
  // urgente é assunto do portfólio), então a ordem previsível vale mais.
  characters.sort((a, b) => a.characterName.localeCompare(b.characterName))
  return characters
}

const CSV_HEADER = ['item', 'tier', 'quantidade', 'volume_m3'] as const

function csvCell(value: string | number | undefined): string {
  if (value == null) return ''
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** CSV de uma remessa — o que desce naquele destino, e quanto ocupa. */
export function toDeliveryCsv(items: DeliveryItem[]): string {
  const rows = items.map((i) =>
    [i.name, i.tier ?? '', i.quantity, Math.round(i.totalVolumeM3 * 100) / 100]
      .map(csvCell)
      .join(',')
  )
  return [CSV_HEADER.join(','), ...rows].join('\n')
}
