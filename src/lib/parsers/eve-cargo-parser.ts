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
    // Note: EVE often leaves Quantity blank if it's 1.
    if (line.includes('\t')) {
      const tabParts = line.split('\t')
      const name = tabParts[0].trim()
      
      if (name) {
        let quantity = 1
        const qtyStr = tabParts[1]?.trim()

        if (qtyStr) {
          // If the second column has a value, try to parse it as a quantity.
          // We ignore it if it contains units like 'm3' or 'ISK' which belong to other columns.
          if (!qtyStr.toLowerCase().includes('m3') && !qtyStr.toLowerCase().includes('isk')) {
            const cleanQty = qtyStr.replace(/[^0-9]/g, '')
            if (cleanQty) {
              const parsed = parseInt(cleanQty, 10)
              if (!isNaN(parsed)) {
                quantity = parsed
              }
            }
          }
        }
        
        cargoMap.set(name, (cargoMap.get(name) || 0) + quantity)
        continue
      }
    }

    // Pattern B: Item Name [x]Quantity (Multi-buy or simple lists)
    const regex1 = /^(.+?)\s+x?(\d[0-9,.]*)$/ 
    const match1 = line.match(regex1)
    if (match1) {
      const name = match1[1].trim()
      const quantity = parseInt(match1[2].replace(/[^0-9]/g, ''), 10)
      if (!isNaN(quantity)) {
        cargoMap.set(name, (cargoMap.get(name) || 0) + quantity)
        continue
      }
    }

    // Pattern C: Quantity [x] Item Name (Standard "Copy to clipboard" for some contexts)
    const regex2 = /^(\d[0-9,.]*)\s+x?\b(.+)$/
    const match2 = line.match(regex2)
    if (match2) {
      const quantity = parseInt(match2[1].replace(/[^0-9]/g, ''), 10)
      const name = match2[2].trim()
      if (!isNaN(quantity)) {
        cargoMap.set(name, (cargoMap.get(name) || 0) + quantity)
        continue
      }
    }

    // Pattern D: Fallback - Simple name (Assume quantity 1)
    const name = line.trim()
    if (name) {
      cargoMap.set(name, (cargoMap.get(name) || 0) + 1)
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
