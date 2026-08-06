import { prisma } from '@/lib/prisma'

export interface ResolvedName {
  typeId: number
  name: string
  /** m³ per unit (SDE), null when the SDE has no volume on record for this type. */
  volume: number | null
  /** SDE group name (e.g. "Ice Product") for a quick visual cue on the appraisal. */
  groupName: string | null
}

export interface NameResolution {
  /** Distinct input names that matched a published SDE type (case-insensitive). */
  resolved: Map<string, ResolvedName>
  /** Distinct input names with no published SDE match — surfaced, never dropped. */
  unresolved: string[]
}

const MAX_NAMES = 500

/**
 * Resolve pasted item names to published SDE types in one query (case-insensitive,
 * exact name). Mirrors /api/sde/resolve-types' batch shape. Returns a lower-cased
 * lookup plus the list of names that didn't resolve, so the caller can show the
 * user exactly what was skipped instead of a silently short total (regra de ouro).
 */
export async function resolveNamesToTypes(names: string[]): Promise<NameResolution> {
  const cleaned = [...new Set(names.map((n) => n.trim()).filter(Boolean))].slice(0, MAX_NAMES)
  const resolved = new Map<string, ResolvedName>()
  if (cleaned.length === 0) return { resolved, unresolved: [] }

  const rows = await prisma.eveType.findMany({
    where: {
      published: true,
      OR: cleaned.map((n) => ({ name: { equals: n, mode: 'insensitive' as const } })),
    },
    select: { id: true, name: true, volume: true, group: { select: { name: true } } },
  })

  const byLower = new Map<string, ResolvedName>()
  for (const r of rows) {
    byLower.set(r.name.toLowerCase(), {
      typeId: r.id,
      name: r.name,
      volume: r.volume ?? null,
      groupName: r.group?.name ?? null,
    })
  }

  const unresolved: string[] = []
  for (const n of cleaned) {
    const hit = byLower.get(n.toLowerCase())
    if (hit) resolved.set(n.toLowerCase(), hit)
    else unresolved.push(n)
  }

  return { resolved, unresolved }
}
