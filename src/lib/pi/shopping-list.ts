import type { PiColonyAnalysis } from '@/lib/pi/types'
import { getCommodityName } from '@/lib/pi/pi-static-data'

export interface ShoppingListItem {
  typeId: number
  name: string
  /** Units to buy to sustain `periodHours` of operation. */
  quantity: number
  /** Import demand per hour that produced the quantity. */
  perHour: number
}

export interface ShoppingListPlanet {
  characterId: number
  characterName: string
  planetId: number
  planetLabel: string
  items: ShoppingListItem[]
}

export interface ShoppingListCharacter {
  characterId: number
  characterName: string
  items: ShoppingListItem[]
}

export interface ShoppingList {
  periodHours: number
  perPlanet: ShoppingListPlanet[]
  perCharacter: ShoppingListCharacter[]
  total: ShoppingListItem[]
}

/** Which balance set drives the buy list — designed (potential) 24/7 needs by default. */
export type ShoppingRateMode = 'potential' | 'current'

function accumulate(
  acc: Map<number, { name: string; perHour: number }>,
  typeId: number,
  name: string,
  perHour: number
): void {
  if (perHour <= 0) return
  const entry = acc.get(typeId) ?? { name, perHour: 0 }
  entry.perHour += perHour
  acc.set(typeId, entry)
}

function toItems(
  acc: Map<number, { name: string; perHour: number }>,
  periodHours: number
): ShoppingListItem[] {
  return [...acc.entries()]
    .map(([typeId, { name, perHour }]) => ({
      typeId,
      name,
      perHour,
      quantity: Math.ceil(perHour * periodHours),
    }))
    .filter((i) => i.quantity > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Consolidated buy list to sustain `periodHours` of PI operation — the sum of
 * each colony's imported inputs (materials it must buy), rolled up per planet,
 * per character, and in total. Uses the designed (potential) import needs by
 * default so a stock-up covers full 24/7 operation.
 */
export function buildShoppingList(
  colonies: PiColonyAnalysis[],
  periodHours: number,
  rateMode: ShoppingRateMode = 'potential'
): ShoppingList {
  const totalAcc = new Map<number, { name: string; perHour: number }>()
  const perCharacterAcc = new Map<number, Map<number, { name: string; perHour: number }>>()
  const perPlanet: ShoppingListPlanet[] = []

  for (const colony of colonies) {
    const balances = rateMode === 'current' ? colony.balances.current : colony.balances.potential
    const planetAcc = new Map<number, { name: string; perHour: number }>()

    for (const balance of balances) {
      if (balance.importNeededPerHour <= 0) continue
      const name = balance.name || getCommodityName(balance.typeId)
      accumulate(planetAcc, balance.typeId, name, balance.importNeededPerHour)
      accumulate(totalAcc, balance.typeId, name, balance.importNeededPerHour)

      const charAcc =
        perCharacterAcc.get(colony.characterId) ??
        new Map<number, { name: string; perHour: number }>()
      accumulate(charAcc, balance.typeId, name, balance.importNeededPerHour)
      perCharacterAcc.set(colony.characterId, charAcc)
    }

    const items = toItems(planetAcc, periodHours)
    if (items.length > 0) {
      const planetName = colony.planetName ?? colony.solarSystemName
      perPlanet.push({
        characterId: colony.characterId,
        characterName: colony.characterName,
        planetId: colony.planetId,
        planetLabel: planetName
          ? `${colony.planetTypeLabel} — ${planetName}`
          : colony.planetTypeLabel,
        items,
      })
    }
  }

  // Group every character's planets together (not the colonies' incoming order,
  // which can interleave characters) — then keep planets of the same character
  // in a stable, readable order by label.
  perPlanet.sort(
    (a, b) =>
      a.characterName.localeCompare(b.characterName) || a.planetLabel.localeCompare(b.planetLabel)
  )

  const perCharacter: ShoppingListCharacter[] = [...perCharacterAcc.entries()]
    .map(([characterId, acc]) => {
      const colony = colonies.find((c) => c.characterId === characterId)
      return {
        characterId,
        characterName: colony?.characterName ?? String(characterId),
        items: toItems(acc, periodHours),
      }
    })
    .filter((c) => c.items.length > 0)
    .sort((a, b) => a.characterName.localeCompare(b.characterName))

  return {
    periodHours,
    perPlanet,
    perCharacter,
    total: toItems(totalAcc, periodHours),
  }
}

/**
 * EVE Multibuy clipboard format: one line per item, `Name<TAB>Quantity`.
 * Pasting this into the in-game Multibuy window fills the buy order.
 */
export function toMultibuyText(items: ShoppingListItem[]): string {
  return items.map((i) => `${i.name}\t${i.quantity}`).join('\n')
}
