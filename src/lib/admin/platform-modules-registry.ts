import type { ModulePrice, PrismaClient } from '@prisma/client'

/**
 * Canonical platform module keys (order = admin UI + public config).
 * Must stay aligned with `ModulePrice.module` values used in API gates
 * (`fits`, `market`, activity `type` lowercased, etc.).
 */
export const ORDERED_PLATFORM_MODULE_KEYS = [
  'fits',
  'market',
  'mining',
  'ratting',
  'abyssal',
  'exploration',
  'crab',
  'escalations',
  'pvp',
] as const

const CANONICAL_SET = new Set<string>(ORDERED_PLATFORM_MODULE_KEYS)

/**
 * Ensures every canonical module has a real `ModulePrice` row (idempotent).
 * Does not overwrite existing rows (skipDuplicates on `module` unique key).
 */
export async function ensurePlatformModuleRows(prisma: PrismaClient): Promise<void> {
  await prisma.modulePrice.createMany({
    data: ORDERED_PLATFORM_MODULE_KEYS.map((module) => ({
      module,
      price: 0,
      isActive: true,
    })),
    skipDuplicates: true,
  })
}

/** Admin list: canonical order first, then any non-canonical DB rows (sorted). */
export function orderPlatformModulesForAdmin(stored: ModulePrice[]): ModulePrice[] {
  const byModule = new Map<string, ModulePrice>()
  for (const row of stored) {
    byModule.set(row.module.toLowerCase(), row)
  }

  const out: ModulePrice[] = []
  for (const key of ORDERED_PLATFORM_MODULE_KEYS) {
    const row = byModule.get(key)
    if (row) out.push(row)
  }

  const extras = stored
    .filter((r) => !CANONICAL_SET.has(r.module.toLowerCase()))
    .sort((a, b) => a.module.localeCompare(b.module))

  return [...out, ...extras]
}

/** Public `{ module, isActive }[]` in canonical order + extras. */
export function buildOrderedModulePublicConfig(
  stored: Array<Pick<ModulePrice, 'module' | 'isActive'>>
): Array<{ module: string; isActive: boolean }> {
  const byModule = new Map<string, { module: string; isActive: boolean }>()
  for (const row of stored) {
    const k = row.module.toLowerCase()
    byModule.set(k, { module: row.module, isActive: row.isActive })
  }

  const out: Array<{ module: string; isActive: boolean }> = []
  for (const key of ORDERED_PLATFORM_MODULE_KEYS) {
    const row = byModule.get(key)
    if (row) out.push({ module: row.module, isActive: row.isActive })
  }

  for (const row of stored) {
    if (!CANONICAL_SET.has(row.module.toLowerCase())) {
      out.push({ module: row.module, isActive: row.isActive })
    }
  }

  return out
}
