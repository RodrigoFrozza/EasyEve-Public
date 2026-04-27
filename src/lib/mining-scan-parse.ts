function parseEveQuantityToken(raw: string): number | null {
  const compact = raw.replace(/\s/g, '').replace(/,/g, '')
  if (!/^\d+(\.\d+)?$/.test(compact)) return null
  const n = Number(compact)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n)
}

/**
 * Parse a single pasted line from overview / probe / cargo list.
 * Supports "Qty Name", "Name Qty", "Name\tQty", "Qty\tName".
 */
export function parseMiningScanLine(line: string): { name: string; quantity: number } | null {
  const raw = line.trim()
  if (!raw) return null

  const parts = raw.split(/\t+/).map((s) => s.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const a = parts[0]
    const b = parts[1]
    const qa = parseEveQuantityToken(a)
    const qb = parseEveQuantityToken(b)
    if (qa != null && qb == null) return { name: b, quantity: qa }
    if (qb != null && qa == null) return { name: a, quantity: qb }
  }

  const lead = raw.match(/^([\d\s,]+)\s+(.+)$/)
  if (lead) {
    const q = parseEveQuantityToken(lead[1])
    if (q != null) return { name: lead[2].trim(), quantity: q }
  }

  const trail = raw.match(/^(.+?)\s+([\d\s,]+)$/)
  if (trail) {
    const q = parseEveQuantityToken(trail[2])
    if (q != null) return { name: trail[1].trim(), quantity: q }
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
