/**
 * Import the industry blueprint catalogue from CCP's official SDE (blueprints.jsonl)
 * into Blueprint / BlueprintMaterial / BlueprintProduct. Mirrors official-sde-import.ts
 * (same zip, same streaming helpers) so both refreshes share one download.
 *
 * Only the item-producing activities (manufacturing, reaction, invention) carry
 * materials/products worth persisting; copying/research have time only and are
 * captured just as the Blueprint's activity times where relevant.
 *
 * @see https://developers.eveonline.com/docs/services/static-data/
 */
import { prisma } from '@/lib/prisma'
import {
  assertUnzipAvailable,
  assertZipLocalFileLooksValid,
  findZipEntryName,
  streamLinesFromZip,
} from '@/lib/sde/official-sde-import'

/** Activities whose materials/products we persist (they turn inputs into outputs). */
export const IO_ACTIVITIES = ['manufacturing', 'reaction', 'invention'] as const
export type IoActivity = (typeof IO_ACTIVITIES)[number]

export interface ParsedBlueprintMaterial {
  activity: IoActivity
  typeId: number
  quantity: number
}

export interface ParsedBlueprintProduct {
  activity: IoActivity
  typeId: number
  quantity: number
  probability: number | null
}

export interface ParsedBlueprint {
  blueprintTypeId: number
  maxProductionLimit: number | null
  manufacturingTime: number | null
  reactionTime: number | null
  inventionTime: number | null
  materials: ParsedBlueprintMaterial[]
  products: ParsedBlueprintProduct[]
}

interface RawIoEntry {
  typeID?: number
  quantity?: number
  probability?: number
}
interface RawActivity {
  time?: number
  materials?: RawIoEntry[]
  products?: RawIoEntry[]
}

function intOrNull(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.floor(n) : null
}

/**
 * Parse one blueprints.jsonl line into normalized rows. Returns null for a line
 * with no usable blueprint id. Materials/products with a non-positive type or
 * quantity are dropped (never persisted as a zero/placeholder — regra de ouro).
 */
export function parseBlueprintLine(line: string): ParsedBlueprint | null {
  let o: Record<string, unknown>
  try {
    o = JSON.parse(line)
  } catch {
    return null
  }

  const blueprintTypeId = intOrNull(o.blueprintTypeID ?? o._key)
  if (blueprintTypeId == null || blueprintTypeId <= 0) return null

  const activities = (o.activities ?? {}) as Record<string, RawActivity>
  const materials: ParsedBlueprintMaterial[] = []
  const products: ParsedBlueprintProduct[] = []

  for (const activity of IO_ACTIVITIES) {
    const act = activities[activity]
    if (!act) continue
    for (const m of act.materials ?? []) {
      const typeId = intOrNull(m.typeID)
      const quantity = intOrNull(m.quantity)
      if (typeId && typeId > 0 && quantity && quantity > 0) {
        materials.push({ activity, typeId, quantity })
      }
    }
    for (const p of act.products ?? []) {
      const typeId = intOrNull(p.typeID)
      const quantity = intOrNull(p.quantity)
      if (typeId && typeId > 0 && quantity && quantity > 0) {
        const probability =
          typeof p.probability === 'number' && p.probability > 0 && p.probability < 1
            ? p.probability
            : null
        products.push({ activity, typeId, quantity, probability })
      }
    }
  }

  return {
    blueprintTypeId,
    maxProductionLimit: intOrNull(o.maxProductionLimit),
    manufacturingTime: intOrNull(activities.manufacturing?.time),
    reactionTime: intOrNull(activities.reaction?.time),
    inventionTime: intOrNull(activities.invention?.time),
    materials,
    products,
  }
}

export type BlueprintImportOptions = {
  dryRun?: boolean
  /** Blueprints per DB transaction (each flush upserts BPs + rewrites their I/O rows). */
  batchSize?: number
  onProgress?: (phase: string, data?: Record<string, unknown>) => void | Promise<void>
}

export type BlueprintImportStats = {
  blueprintsUpserted: number
  materialsWritten: number
  productsWritten: number
  dryRun: boolean
}

async function flushBatch(batch: ParsedBlueprint[]): Promise<void> {
  const ids = batch.map((b) => b.blueprintTypeId)
  await prisma.$transaction([
    // Rewrite this batch's I/O rows (no natural key on them) — delete then recreate,
    // so a re-run is idempotent and reflects recipe changes after a CCP patch.
    prisma.blueprintMaterial.deleteMany({ where: { blueprintTypeId: { in: ids } } }),
    prisma.blueprintProduct.deleteMany({ where: { blueprintTypeId: { in: ids } } }),
    ...batch.map((b) =>
      prisma.blueprint.upsert({
        where: { blueprintTypeId: b.blueprintTypeId },
        create: {
          blueprintTypeId: b.blueprintTypeId,
          maxProductionLimit: b.maxProductionLimit,
          manufacturingTime: b.manufacturingTime,
          reactionTime: b.reactionTime,
          inventionTime: b.inventionTime,
        },
        update: {
          maxProductionLimit: b.maxProductionLimit,
          manufacturingTime: b.manufacturingTime,
          reactionTime: b.reactionTime,
          inventionTime: b.inventionTime,
        },
      })
    ),
    prisma.blueprintMaterial.createMany({
      data: batch.flatMap((b) =>
        b.materials.map((m) => ({
          blueprintTypeId: b.blueprintTypeId,
          activity: m.activity,
          typeId: m.typeId,
          quantity: m.quantity,
        }))
      ),
    }),
    prisma.blueprintProduct.createMany({
      data: batch.flatMap((b) =>
        b.products.map((p) => ({
          blueprintTypeId: b.blueprintTypeId,
          activity: p.activity,
          typeId: p.typeId,
          quantity: p.quantity,
          probability: p.probability,
        }))
      ),
    }),
  ])
}

export async function importBlueprintsFromZip(
  zipPath: string,
  options?: BlueprintImportOptions
): Promise<BlueprintImportStats> {
  assertUnzipAvailable()
  assertZipLocalFileLooksValid(zipPath)
  const member = findZipEntryName(zipPath, 'blueprints.jsonl')

  const dryRun = options?.dryRun === true
  const batchSize = Math.min(200, Math.max(20, options?.batchSize ?? 100))

  let blueprintsUpserted = 0
  let materialsWritten = 0
  let productsWritten = 0
  let seen = 0

  let batch: ParsedBlueprint[] = []
  const flush = async () => {
    if (batch.length === 0) return
    if (!dryRun) await flushBatch(batch)
    blueprintsUpserted += batch.length
    materialsWritten += batch.reduce((s, b) => s + b.materials.length, 0)
    productsWritten += batch.reduce((s, b) => s + b.products.length, 0)
    await options?.onProgress?.('batch', { seen, blueprintsUpserted })
    batch = []
  }

  const lineIter = await streamLinesFromZip(zipPath, member)
  for await (const line of lineIter) {
    const parsed = parseBlueprintLine(line)
    if (!parsed) continue
    seen++
    batch.push(parsed)
    if (batch.length >= batchSize) await flush()
  }
  await flush()

  await options?.onProgress?.('finished', {
    blueprintsUpserted,
    materialsWritten,
    productsWritten,
    dryRun,
  })

  return { blueprintsUpserted, materialsWritten, productsWritten, dryRun }
}
