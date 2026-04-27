/**
 * EVE Online Cargo Parser & Delta Calculator
 * Parses standard inventory list view text and calculates differences.
 */

export interface CargoItem {
  name: string
  quantity: number
}

/**
 * Parses a clipboard string from EVE inventory list view
 * Example format: "Item Name\tQuantity\tGroup\tSize..."
 */
export function parseEVECargo(text: string): Map<string, number> {
  const cargoMap = new Map<string, number>()
  if (!text) return cargoMap

  const lines = text.split(/\r?\n/)
  
  for (const line of lines) {
    if (!line.trim()) continue

    // Pattern A: Tab-separated (Inventory List View)
    // Supports various column counts. Standard: [Name] \t [Quantity] \t [Group] ...
    const tabParts = line.split('\t')
    if (tabParts.length >= 2) {
      const name = tabParts[0].trim()
      // Take the second column as quantity. If it's not a number, the format might be weird, but usually it's Name\tQty
      const qtyStr = tabParts[1].replace(/[,.]/g, '').replace(' ', '')
      const quantity = parseInt(qtyStr, 10)
      
      if (name && !isNaN(quantity)) {
        cargoMap.set(name, (cargoMap.get(name) || 0) + quantity)
        continue
      }
    }

    // Pattern B: Multi-buy / Simple format
    // Item Name [x]Quantity
    const regex1 = /^(.+?)\s+x?(\d[0-9,.]*)$/ 
    const match1 = line.match(regex1)
    if (match1) {
      const name = match1[1].trim()
      const quantity = parseInt(match1[2].replace(/[,.]/g, ''), 10)
      if (!isNaN(quantity)) {
        cargoMap.set(name, (cargoMap.get(name) || 0) + quantity)
        continue
      }
    }

    // Pattern C: Quantity [x] Item Name (Standard "Copy to clipboard" for some contexts)
    const regex2 = /^(\d[0-9,.]*)\s+x?\b(.+)$/
    const match2 = line.match(regex2)
    if (match2) {
      const quantity = parseInt(match2[1].replace(/[,.]/g, ''), 10)
      const name = match2[2].trim()
      if (!isNaN(quantity)) {
        cargoMap.set(name, (cargoMap.get(name) || 0) + quantity)
        continue
      }
    }
  }

  return cargoMap
}

/**
 * Calculates the delta between two cargo states.
 * Only positive increments are returned as "loot".
 * Consumed items (After < Before) are ignored.
 */
export function calculateLootDelta(beforeText: string, afterText: string): CargoItem[] {
  const before = parseEVECargo(beforeText)
  const after = parseEVECargo(afterText)
  const loot: CargoItem[] = []

  after.forEach((afterQty, name) => {
    const beforeQty = before.get(name) || 0
    const delta = afterQty - beforeQty

    if (delta > 0) {
      loot.push({
        name,
        quantity: delta
      })
    }
  })

  return loot
}

/**
 * Calculates comprehensive delta for Abyssal runs.
 * Returns both gained (loot) and lost (consumed) items.
 */
export function calculateAbyssalDelta(beforeText: string, afterText: string) {
  const before = parseEVECargo(beforeText)
  const after = parseEVECargo(afterText)
  
  const loot: CargoItem[] = []
  const consumed: CargoItem[] = []

  // Items in 'after' (can be new loot or remaining ammo)
  after.forEach((afterQty, name) => {
    const beforeQty = before.get(name) || 0
    const delta = afterQty - beforeQty

    if (delta > 0) {
      loot.push({ name, quantity: delta })
    } else if (delta < 0) {
      consumed.push({ name, quantity: Math.abs(delta) })
    }
  })

  // Items only in 'before' (completely consumed)
  before.forEach((beforeQty, name) => {
    if (!after.has(name)) {
      consumed.push({ name, quantity: beforeQty })
    }
  })

  return { loot, consumed }
}
