import { parseEveValue } from '@/lib/parsers/eve-value-parser'

/**
 * Parse a single pasted line from overview / probe / cargo list.
 * Supports:
 * 1. "Name\tQty\tVol\tVal\tDist" (Mining Scanner)
 * 2. "Qty Name", "Name Qty", "Name\tQty", "Qty\tName" (Legacy)
 */
export function parseMiningScanLine(line: string): { name: string; quantity: number } | null {
  const raw = line.trim()
  if (!raw) return null

  // 1. Try Tab-Separated (multi-column)
  const parts = raw.split(/\t+/).map((s) => s.trim()).filter(Boolean)
  if (parts.length >= 2) {
    // Check if it's the 5-column format: Name, Qty, Volume, Value, Distance
    // Or just Name, Qty
    const a = parts[0]
    const b = parts[1]
    
    // In many EVE copies, the first part is Name, second is Qty
    const qb = parseEveValue(b)
    if (qb !== null && isNaN(Number(a))) {
      return { name: a, quantity: qb }
    }
    
    // Inverse: Qty, Name
    const qa = parseEveValue(a)
    if (qa !== null && isNaN(Number(b))) {
      return { name: b, quantity: qa }
    }
  }

  // 2. Try Regex for "Qty Name"
  const lead = raw.match(/^([\d\s,.]+)\s+(.+)$/)
  if (lead) {
    const q = parseEveValue(lead[1])
    if (q !== null && isNaN(Number(lead[2]))) {
      return { name: lead[2].trim(), quantity: q }
    }
  }

  // 3. Try Regex for "Name Qty"
  const trail = raw.match(/^(.+?)\s+([\d\s,.]+)$/)
  if (trail) {
    const q = parseEveValue(trail[2])
    if (q !== null && isNaN(Number(trail[1]))) {
      return { name: trail[1].trim(), quantity: q }
    }
  }

  return null
}

export function parseMiningScanBlock(text: string): { name: string; quantity: number }[] {
  const out: { name: string; quantity: number }[] = []
  for (const line of text.split(/\r?\n/)) {
    const row = parseMiningScanLine(line)
    if (row) out.push(row)
  }
  return out
}
