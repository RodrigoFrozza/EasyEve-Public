/**
 * EVE Online Cargo Parser & Delta Calculator
 * Parses standard inventory list view text and calculates differences.
 */

export interface CargoItem {
  name: string
  quantity: number
}

type CargoEntry = {
  displayName: string
  quantity: number
}

function normalizeCargoKey(name: string): string {
  return name.trim().toLowerCase()
}

/**
 * Item quantities are always whole counts, never fractional, so any dot or
 * comma present is a thousand separator (never a decimal point) — unlike
 * eve-value-parser's parseEveValue, which has to guess between the two for
 * genuinely fractional values (ISK, m3).
 */
function parseQuantityToken(raw: string): number | null {
  const digitsOnly = raw.replace(/[^0-9]/g, '')
  if (!digitsOnly) return null
  const parsed = parseInt(digitsOnly, 10)
  return isNaN(parsed) ? null : parsed
}

function isHeaderLine(line: string): boolean {
  const normalized = line.trim().toLowerCase()
  return (
    normalized === 'name\tquantity' ||
    normalized.startsWith('name\tquantity\t') ||
    normalized === 'item type\tquantity'
  )
}

function addCargoEntry(cargoMap: Map<string, CargoEntry>, name: string, quantity: number): void {
  const key = normalizeCargoKey(name)
  const displayName = name.trim()
  const existing = cargoMap.get(key)
  if (existing) {
    existing.quantity += quantity
  } else {
    cargoMap.set(key, { displayName, quantity })
  }
}

/**
 * Parses ONE line into a { name, quantity } entry, trying each recognized paste
 * pattern in order (tab-separated inventory view, "Name xQty", "Qty x Name", bare
 * name). Returns null for a blank/header line. Shared by both the merging
 * (`parseEVECargoEntries`) and line-preserving (`parseEVECargoLines`) parsers so
 * the pattern logic only lives in one place.
 */
function parseCargoLine(line: string): CargoEntry | null {
  if (!line.trim() || isHeaderLine(line)) return null

  // Pattern A: Tab-separated (Inventory List View)
  if (line.includes('\t')) {
    const tabParts = line.split('\t')
    const name = tabParts[0].trim()

    if (name) {
      let quantity = 1
      const qtyStr = tabParts[1]?.trim()

      if (qtyStr) {
        if (!qtyStr.toLowerCase().includes('m3') && !qtyStr.toLowerCase().includes('isk')) {
          const parsed = parseQuantityToken(qtyStr)
          if (parsed !== null) {
            quantity = parsed
          }
        }
      }

      return { displayName: name, quantity }
    }
  }

  // Pattern B: Item Name [x]Quantity (Multi-buy or simple lists)
  const regex1 = /^(.+?)\s+x?(\d[0-9,.]*)$/
  const match1 = line.match(regex1)
  if (match1) {
    const name = match1[1].trim()
    const quantity = parseQuantityToken(match1[2])
    if (quantity !== null) {
      return { displayName: name, quantity }
    }
  }

  // Pattern C: Quantity [x] Item Name
  const regex2 = /^(\d[0-9,.]*)\s+x?\b(.+)$/
  const match2 = line.match(regex2)
  if (match2) {
    const quantity = parseQuantityToken(match2[1])
    const name = match2[2].trim()
    if (quantity !== null) {
      return { displayName: name, quantity }
    }
  }

  const name = line.trim()
  if (name) {
    return { displayName: name, quantity: 1 }
  }

  return null
}

/**
 * Parses cargo with case-insensitive keys and preserved display names.
 */
export function parseEVECargoEntries(text: string): Map<string, CargoEntry> {
  const cargoMap = new Map<string, CargoEntry>()
  if (!text) return cargoMap

  const lines = text.split(/\r?\n/)

  for (const line of lines) {
    const parsed = parseCargoLine(line)
    if (parsed) addCargoEntry(cargoMap, parsed.displayName, parsed.quantity)
  }

  return cargoMap
}

/**
 * Like {@link parseEVECargoEntries} but does NOT merge identical items — returns
 * one entry per pasted line, in paste order, duplicates included verbatim. Used
 * by the appraisal's "stack" toggle so a seller pasting the same item from
 * several separate stacks/containers can show them as distinct lines instead of
 * one merged total.
 */
export function parseEVECargoLines(text: string): CargoEntry[] {
  if (!text) return []
  return text
    .split(/\r?\n/)
    .map(parseCargoLine)
    .filter((entry): entry is CargoEntry => entry !== null)
}

/**
 * Parses a clipboard string from EVE inventory list view
 * Example format: "Item Name\tQuantity\tGroup\tSize..."
 * Map keys are normalized (lowercase); values are quantities only.
 */
export function parseEVECargo(text: string): Map<string, number> {
  const cargoMap = new Map<string, number>()
  parseEVECargoEntries(text).forEach((entry, key) => {
    cargoMap.set(key, entry.quantity)
  })
  return cargoMap
}

function mapToDisplayItems(cargoMap: Map<string, CargoEntry>): CargoItem[] {
  return Array.from(cargoMap.values()).map(({ displayName, quantity }) => ({
    name: displayName,
    quantity,
  }))
}

/**
 * Calculates the delta between two cargo states.
 * Only positive increments are returned as "loot".
 */
export function calculateLootDelta(beforeText: string, afterText: string): CargoItem[] {
  const before = parseEVECargoEntries(beforeText)
  const after = parseEVECargoEntries(afterText)
  const loot = new Map<string, CargoEntry>()

  after.forEach((afterEntry, key) => {
    const beforeQty = before.get(key)?.quantity || 0
    const delta = afterEntry.quantity - beforeQty
    if (delta > 0) {
      loot.set(key, { displayName: afterEntry.displayName, quantity: delta })
    }
  })

  return mapToDisplayItems(loot)
}

/**
 * Calculates comprehensive delta for Abyssal runs.
 * Returns both gained (loot) and lost (consumed) items.
 */
export function calculateAbyssalDelta(beforeText: string, afterText: string) {
  const before = parseEVECargoEntries(beforeText)
  const after = parseEVECargoEntries(afterText)

  const loot = new Map<string, CargoEntry>()
  const consumed = new Map<string, CargoEntry>()

  after.forEach((afterEntry, key) => {
    const beforeQty = before.get(key)?.quantity || 0
    const delta = afterEntry.quantity - beforeQty

    if (delta > 0) {
      loot.set(key, { displayName: afterEntry.displayName, quantity: delta })
    } else if (delta < 0) {
      consumed.set(key, { displayName: afterEntry.displayName, quantity: Math.abs(delta) })
    }
  })

  before.forEach((beforeEntry, key) => {
    if (!after.has(key)) {
      const existing = consumed.get(key)
      if (existing) {
        existing.quantity += beforeEntry.quantity
      } else {
        consumed.set(key, { displayName: beforeEntry.displayName, quantity: beforeEntry.quantity })
      }
    }
  })

  return {
    loot: mapToDisplayItems(loot),
    consumed: mapToDisplayItems(consumed),
  }
}
