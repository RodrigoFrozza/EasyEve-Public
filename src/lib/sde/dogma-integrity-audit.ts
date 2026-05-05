/**
 * Compare aggregated `ShipStats` / `ModuleStats` rows against raw dogma rows
 * (`ShipDogmaAttribute` / `ModuleDogmaAttribute`) to detect sync drift.
 */
import type { ShipStats } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { mapDogmaToShipStats, type ShipEsiLayoutMeta } from '@/lib/sde/ship-dogma-sync'
import { MODULE_SYNC_DOGMA_IDS as M } from '@/lib/sde/dogma-attribute-ids'

const EPS = 0.02

function nearlyEqual(a: number | null | undefined, b: number | null | undefined): boolean {
  const x = Number(a ?? 0)
  const y = Number(b ?? 0)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return (a ?? null) === (b ?? null)
  return Math.abs(x - y) <= EPS || (Math.abs(x - y) / Math.max(Math.abs(x), Math.abs(y), 1e-9) < 0.001)
}

async function attrsMapFromShipDogma(typeId: number): Promise<Record<number, number>> {
  const rows = await prisma.shipDogmaAttribute.findMany({
    where: { shipTypeId: typeId },
    select: { attributeId: true, value: true },
  })
  return Object.fromEntries(rows.map((r) => [r.attributeId, r.value]))
}

async function attrsMapFromModuleDogma(typeId: number): Promise<Record<number, number>> {
  const rows = await prisma.moduleDogmaAttribute.findMany({
    where: { moduleTypeId: typeId },
    select: { attributeId: true, value: true },
  })
  return Object.fromEntries(rows.map((r) => [r.attributeId, r.value]))
}

export type ShipDriftFinding = {
  typeId: number
  name: string
  field: string
  stored: number | null | undefined
  expected: number | null | undefined
}

/**
 * Recompute `ShipStats`-like fields from persisted dogma rows and compare to `ShipStats`.
 * Uses empty layout meta (numeric fields do not depend on faction/race for this check).
 */
export async function auditShipStatsAgainstDogma(typeId: number): Promise<ShipDriftFinding[]> {
  const [stats, attrs] = await Promise.all([
    prisma.shipStats.findUnique({ where: { typeId } }),
    attrsMapFromShipDogma(typeId),
  ])
  if (!stats) return []
  if (Object.keys(attrs).length === 0) {
    return [{ typeId, name: stats.name, field: '_missing_dogma_rows', stored: null, expected: null }]
  }

  const meta: ShipEsiLayoutMeta = {
    raceId: stats.raceId,
    groupId: stats.groupId,
    groupName: stats.groupName,
    factionName: stats.factionName ?? undefined,
  }
  const expected = mapDogmaToShipStats(attrs, meta)
  const findings: ShipDriftFinding[] = []

  const checks: [keyof typeof expected, keyof ShipStats][] = [
    ['highSlots', 'highSlots'],
    ['medSlots', 'medSlots'],
    ['lowSlots', 'lowSlots'],
    ['rigSlots', 'rigSlots'],
    ['cpu', 'cpu'],
    ['powerGrid', 'powerGrid'],
    ['shieldCapacity', 'shieldCapacity'],
    ['armorHP', 'armorHP'],
    ['hullHP', 'hullHP'],
    ['maxVelocity', 'maxVelocity'],
    ['mass', 'mass'],
    ['agility', 'agility'],
  ]

  for (const [expKey, dbKey] of checks) {
    const e = expected[expKey] as number | null | undefined
    const s = stats[dbKey] as number | null | undefined
    if (!nearlyEqual(e, s)) {
      findings.push({ typeId, name: stats.name, field: String(expKey), stored: s, expected: e })
    }
  }

  return findings
}

export type ModuleDriftFinding = {
  typeId: number
  name: string
  field: string
  stored: number | null | undefined
  expected: number | null | undefined
}

/** Compare key `ModuleStats` columns to raw `ModuleDogmaAttribute` values (same IDs as sync). */
export async function auditModuleStatsAgainstDogma(typeId: number): Promise<ModuleDriftFinding[]> {
  const [stats, attrs] = await Promise.all([
    prisma.moduleStats.findUnique({ where: { typeId } }),
    attrsMapFromModuleDogma(typeId),
  ])
  if (!stats) return []
  if (Object.keys(attrs).length === 0) {
    return [{ typeId, name: stats.name, field: '_missing_dogma_rows', stored: null, expected: null }]
  }

  const findings: ModuleDriftFinding[] = []
  const pairs: [keyof typeof stats, number][] = [
    ['cpu', M.CPU_NEEDED],
    ['powerGrid', M.POWER_NEEDED],
    ['calibration', M.CALIBRATION_COST],
    ['chargeSize', M.CHARGE_SIZE],
  ]

  for (const [field, attrId] of pairs) {
    const raw = attrs[attrId]
    if (raw === undefined) continue
    const stored = stats[field] as number | null | undefined
    const expected =
      field === 'calibration' || field === 'chargeSize' ? Math.round(Number(raw)) : Number(raw)
    const s = field === 'calibration' || field === 'chargeSize' ? Math.round(Number(stored ?? 0)) : Number(stored ?? 0)
    if (!nearlyEqual(s, expected)) {
      findings.push({ typeId, name: stats.name, field: String(field), stored: s, expected })
    }
  }

  return findings
}

export type DogmaIntegrityAuditSummary = {
  ships: { sampled: number; rowsWithDrift: number; findings: ShipDriftFinding[] }
  modules: { sampled: number; rowsWithDrift: number; findings: ModuleDriftFinding[] }
}

export async function runDogmaAggregateIntegrityAudit(options: {
  shipSample: number
  moduleSample: number
}): Promise<DogmaIntegrityAuditSummary> {
  const shipSample = Math.max(0, Math.min(500, Math.floor(options.shipSample)))
  const moduleSample = Math.max(0, Math.min(500, Math.floor(options.moduleSample)))

  const shipIds = await prisma.shipStats.findMany({
    take: shipSample,
    orderBy: { typeId: 'asc' },
    select: { typeId: true },
  })
  const moduleIds = await prisma.moduleStats.findMany({
    take: moduleSample,
    orderBy: { typeId: 'asc' },
    select: { typeId: true },
  })

  const shipFindings: ShipDriftFinding[] = []
  for (const { typeId } of shipIds) {
    shipFindings.push(...(await auditShipStatsAgainstDogma(typeId)))
  }
  const moduleFindings: ModuleDriftFinding[] = []
  for (const { typeId } of moduleIds) {
    moduleFindings.push(...(await auditModuleStatsAgainstDogma(typeId)))
  }

  const shipDriftKeys = new Set(shipFindings.map((f) => f.typeId))
  const moduleDriftKeys = new Set(moduleFindings.map((f) => f.typeId))

  return {
    ships: {
      sampled: shipIds.length,
      rowsWithDrift: shipDriftKeys.size,
      findings: shipFindings,
    },
    modules: {
      sampled: moduleIds.length,
      rowsWithDrift: moduleDriftKeys.size,
      findings: moduleFindings,
    },
  }
}
