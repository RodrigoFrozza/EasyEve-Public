import { prisma } from '@/lib/prisma'
import { calculateFitStats, getChargeCompatibilityErrors } from '@/lib/dogma-calculator'
import type { Module, FitSlot, Drone, CargoItem, ShipStats, SkillProfile } from '@/types/fit'
import { verifyShipFittingReadiness } from '@/lib/fits/dogma-data-integrity'
import { resolveSkillProfileForFitting } from '@/lib/fits/skill-profile-resolver'
import { logger } from '@/lib/server-logger'

export type FitHardwareSlot = 'high' | 'med' | 'low' | 'rig' | 'subsystem'

export type FitMutationAction =
  | 'validateOnly'
  | 'fitModule'
  | 'unfitModule'
  | 'replaceModule'
  | 'setCharge'

export interface FitValidationResult {
  success: boolean
  modules: Module[]
  drones: Drone[]
  cargo: CargoItem[]
  stats: ShipStats | null
  errors: string[]
  slotErrors: Record<string, string[]>
}

/** Normalizes API/editor module rows (legacy numeric `id` as typeId). */
export function normalizeEditorModules(raw: unknown[]): Module[] {
  if (!Array.isArray(raw)) return []
  const out: Module[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const m = item as Record<string, unknown>
    const typeIdRaw = m.typeId ?? (typeof m.id === 'number' ? m.id : undefined)
    if (typeIdRaw == null || Number.isNaN(Number(typeIdRaw))) continue
    const slotRaw = m.slot != null ? String(m.slot) : undefined
    const slot = slotRaw === 'mid' ? 'med' : slotRaw
    out.push({
      id: m.id != null ? String(m.id) : undefined,
      typeId: Number(typeIdRaw),
      name: typeof m.name === 'string' ? m.name : undefined,
      slot: slot as Module['slot'],
      slotIndex: typeof m.slotIndex === 'number' ? m.slotIndex : undefined,
      offline: Boolean(m.offline),
      charge:
        m.charge && typeof m.charge === 'object'
          ? (m.charge as Module['charge'])
          : undefined,
      chargeTypeId:
        typeof m.chargeTypeId === 'number' ? m.chargeTypeId : undefined,
      groupName: typeof m.groupName === 'string' ? m.groupName : undefined,
    })
  }
  return out
}

function normalizeSlot(slot: string): FitHardwareSlot | null {
  const s = String(slot).toLowerCase().trim()
  if (s === 'mid') return 'med'
  if (s === 'high' || s === 'med' || s === 'low' || s === 'rig' || s === 'subsystem') return s
  return null
}

/** Builds indexed slot arrays from flat module list (authoritative layout for DogmaCalculator). */
export function modulesToFitSlots(
  ship: {
    highSlots: number
    medSlots: number
    lowSlots: number
    rigSlots: number
    subsystemSlots?: number | null
  },
  modules: Module[]
): FitSlot {
  const high = new Array(Math.max(0, ship.highSlots || 0)).fill(null) as unknown as Module[]
  const med = new Array(Math.max(0, ship.medSlots || 0)).fill(null) as unknown as Module[]
  const low = new Array(Math.max(0, ship.lowSlots || 0)).fill(null) as unknown as Module[]
  const rig = new Array(Math.max(0, ship.rigSlots || 0)).fill(null) as unknown as Module[]
  const subSlots = Math.max(0, ship.subsystemSlots || 0)
  const subsystem = subSlots > 0 ? (new Array(subSlots).fill(null) as unknown as Module[]) : undefined

  for (const m of modules) {
    if (!m?.typeId) continue
    const slotKey = m.slot ? normalizeSlot(m.slot) : null
    if (!slotKey) continue
    const idxRaw = m.slotIndex ?? 0
    const bucket =
      slotKey === 'high'
        ? high
        : slotKey === 'med'
          ? med
          : slotKey === 'low'
            ? low
            : slotKey === 'rig'
              ? rig
              : subsystem
    if (!bucket || idxRaw < 0 || idxRaw >= bucket.length) continue
    bucket[idxRaw] = m
  }

  return {
    high,
    med,
    low,
    rig,
    ...(subsystem ? { subsystem } : {}),
  }
}

function validateModuleSlotAssignments(
  ship: {
    highSlots: number
    medSlots: number
    lowSlots: number
    rigSlots: number
    subsystemSlots?: number | null
  },
  modules: Module[]
): { ok: true } | { ok: false; errors: string[]; slotErrors: Record<string, string[]> } {
  const errors: string[] = []
  const slotErrors: Record<string, string[]> = {}
  const seen = new Set<string>()
  const capacities: Record<FitHardwareSlot, number> = {
    high: Math.max(0, ship.highSlots || 0),
    med: Math.max(0, ship.medSlots || 0),
    low: Math.max(0, ship.lowSlots || 0),
    rig: Math.max(0, ship.rigSlots || 0),
    subsystem: Math.max(0, ship.subsystemSlots || 0),
  }

  const add = (slotKey: string, msg: string) => {
    errors.push(msg)
    if (!slotErrors[slotKey]) slotErrors[slotKey] = []
    slotErrors[slotKey].push(msg)
  }

  for (const m of modules) {
    const slot = normalizeSlot(m.slot ?? '')
    const slotKey = `${m.slot ?? 'unknown'}-${m.slotIndex ?? 'na'}`
    if (!slot) {
      add(slotKey, `Module ${m.typeId} has invalid slot "${String(m.slot ?? '')}"`)
      continue
    }
    if (!Number.isInteger(m.slotIndex) || (m.slotIndex ?? -1) < 0) {
      add(slotKey, `Module ${m.typeId} has invalid slot index "${String(m.slotIndex ?? '')}"`)
      continue
    }
    const idx = m.slotIndex as number
    const max = capacities[slot]
    if (idx >= max) {
      add(slotKey, `Module ${m.typeId} targets ${slot.toUpperCase()}-${idx} but hull supports ${max} ${slot} slots`)
      continue
    }
    const canonical = `${slot}-${idx}`
    if (seen.has(canonical)) {
      add(canonical, `Duplicate module placement at ${canonical}`)
      continue
    }
    seen.add(canonical)
  }

  if (errors.length > 0) return { ok: false, errors, slotErrors }
  return { ok: true }
}

function dronesToFitSlotModules(drones: Drone[] | undefined): Module[] {
  return (drones || []).map(
    (d) =>
      ({
        typeId: d.id,
        name: d.name,
        quantity: d.quantity,
        slot: 'drone',
      }) as Module
  )
}

export async function validateModuleChargesAgainstDb(modules: Module[]): Promise<{
  ok: true
} | { ok: false; errors: string[]; slotErrors: Record<string, string[]> }> {
  const errors: string[] = []
  const slotErrors: Record<string, string[]> = {}
  const typeIds = [...new Set(modules.map((m) => m.typeId).filter(Boolean))]
  if (typeIds.length === 0) return { ok: true }

  const rows = await prisma.moduleStats.findMany({ where: { typeId: { in: typeIds } } })
  const byType = new Map(rows.map((r) => [r.typeId, r]))
  const chargeIds = [...new Set(modules.map((m) => m.charge?.id ?? m.chargeTypeId).filter((v): v is number => Number.isFinite(Number(v))))]
  const chargeRows =
    chargeIds.length > 0 ? await prisma.chargeStats.findMany({ where: { typeId: { in: chargeIds } } }) : []
  const chargeByType = new Map(chargeRows.map((c) => [c.typeId, c]))

  const add = (slotKey: string, msg: string) => {
    errors.push(msg)
    if (!slotErrors[slotKey]) slotErrors[slotKey] = []
    slotErrors[slotKey].push(msg)
  }

  for (const m of modules) {
    const chargeId = m.charge?.id ?? m.chargeTypeId
    if (!chargeId) continue
    const slotKey = `${m.slot ?? 'unknown'}-${m.slotIndex ?? 0}`
    const row = byType.get(m.typeId)
    if (!row) {
      const msg = `Module type ${m.typeId} not found in database`
      add(slotKey, msg)
      continue
    }

    const charge = chargeByType.get(chargeId)
    if (!charge) {
      const msg = `Charge type ${chargeId} not found`
      add(slotKey, msg)
      continue
    }

    const chargeErrors = getChargeCompatibilityErrors(row, charge)
    if (chargeErrors.length > 0) {
      for (const msg of chargeErrors) add(slotKey, msg)
      continue
    }
  }

  if (errors.length > 0) return { ok: false, errors, slotErrors }
  return { ok: true }
}

async function assertAllModulesExistInDb(modules: Module[]): Promise<string[]> {
  const typeIds = [...new Set(modules.map((m) => m.typeId).filter(Boolean))]
  if (!typeIds.length) return []
  const rows = await prisma.moduleStats.findMany({
    where: { typeId: { in: typeIds } },
    select: { typeId: true },
  })
  const found = new Set(rows.map((r) => r.typeId))
  return typeIds.filter((id) => !found.has(id)).map((id) => `module_${id}_not_in_database`)
}

export interface ValidateFittingParams {
  shipTypeId: number
  modules: Module[]
  drones?: Drone[]
  cargo?: CargoItem[]
  userId?: string
  characterId?: number | null
  skillProfile?: SkillProfile | null
}

/**
 * Full server-side validation + dogma stats for a fit snapshot.
 */
export async function validateFittingState(params: ValidateFittingParams): Promise<FitValidationResult> {
  const { shipTypeId, modules, drones = [], cargo = [] } = params
  const ship = await prisma.shipStats.findUnique({ where: { typeId: shipTypeId } })
  if (!ship) {
    return {
      success: false,
      modules,
      drones,
      cargo,
      stats: null,
      errors: ['Ship hull stats not found in database'],
      slotErrors: {},
    }
  }

  const shipIssues = verifyShipFittingReadiness(ship)
  if (shipIssues.length > 0) {
    return {
      success: false,
      modules,
      drones,
      cargo,
      stats: null,
      errors: shipIssues.map((i) => `ship_data_incomplete:${i}`),
      slotErrors: {},
    }
  }

  const missingMods = await assertAllModulesExistInDb(modules)
  if (missingMods.length > 0) {
    logger.warn('Fitting', 'Missing module rows in database', { shipTypeId, missingMods })
    return {
      success: false,
      modules,
      drones,
      cargo,
      stats: null,
      errors: missingMods,
      slotErrors: {},
    }
  }

  const slotIntegrity = validateModuleSlotAssignments(ship, modules)
  if (!slotIntegrity.ok) {
    return {
      success: false,
      modules,
      drones,
      cargo,
      stats: null,
      errors: slotIntegrity.errors,
      slotErrors: slotIntegrity.slotErrors,
    }
  }

  const chargeIntegrity = await validateModuleChargesAgainstDb(modules)
  if (!chargeIntegrity.ok) {
    return {
      success: false,
      modules,
      drones,
      cargo,
      stats: null,
      errors: chargeIntegrity.errors,
      slotErrors: chargeIntegrity.slotErrors,
    }
  }

  const slots = modulesToFitSlots(ship, modules)
  slots.drone = dronesToFitSlotModules(drones)

  let skillProfile: SkillProfile | undefined
  if (params.userId) {
    skillProfile = await resolveSkillProfileForFitting({
      userId: params.userId,
      characterId: params.characterId ?? undefined,
      explicitProfile: params.skillProfile ?? undefined,
    })
  } else if (params.skillProfile?.skills?.length) {
    skillProfile = params.skillProfile
  }

  const stats = await calculateFitStats(shipTypeId, slots, skillProfile)
  const success = stats.validation.canFit

  if (!success) {
    logger.info('Fitting', 'validateFittingState rejected', {
      shipTypeId,
      errors: stats.validation.errors,
      canFit: stats.validation.canFit,
    })
  }

  return {
    success,
    modules,
    drones,
    cargo,
    stats,
    errors: stats.validation.errors,
    slotErrors: stats.validation.slotErrors,
  }
}

function cloneModules(modules: Module[]): Module[] {
  return modules.map((m) => ({ ...m, charge: m.charge ? { ...m.charge } : undefined }))
}

export interface FitMutationInput {
  action: FitMutationAction
  shipTypeId: number
  modules: Module[]
  drones?: Drone[]
  cargo?: CargoItem[]
  /** Target slot for fit/replace/setCharge */
  slot?: FitHardwareSlot
  slotIndex?: number
  /** Module to fit (typeId required) */
  module?: Partial<Module> & { typeId: number }
  /** Charge to set on module at slot; null clears */
  charge?: { id: number; name: string; quantity: number } | null
  userId?: string
  characterId?: number | null
  skillProfile?: SkillProfile | null
}

/**
 * Applies a single authoritative mutation and returns validated next state or rejection.
 */
export async function applyFitMutation(input: FitMutationInput): Promise<FitValidationResult> {
  const drones = input.drones ?? []
  const cargo = input.cargo ?? []
  let nextModules = cloneModules(input.modules)

  switch (input.action) {
    case 'validateOnly':
      break
    case 'unfitModule': {
      if (input.slot == null || input.slotIndex == null) {
        return {
          success: false,
          modules: nextModules,
          drones,
          cargo,
          stats: null,
          errors: ['unfitModule requires slot and slotIndex'],
          slotErrors: {},
        }
      }
      nextModules = nextModules.filter(
        (m) => !(normalizeSlot(m.slot ?? '') === input.slot && m.slotIndex === input.slotIndex)
      )
      break
    }
    case 'setCharge': {
      if (input.slot == null || input.slotIndex == null) {
        return {
          success: false,
          modules: nextModules,
          drones,
          cargo,
          stats: null,
          errors: ['setCharge requires slot and slotIndex'],
          slotErrors: {},
        }
      }
      nextModules = nextModules.map((m) => {
        if (normalizeSlot(m.slot ?? '') === input.slot && m.slotIndex === input.slotIndex) {
          const next = { ...m }
          if (input.charge == null) {
            delete next.charge
            delete next.chargeTypeId
          } else {
            next.charge = { ...input.charge }
            next.chargeTypeId = input.charge.id
          }
          return next
        }
        return m
      })
      break
    }
    case 'fitModule':
    case 'replaceModule': {
      if (input.slot == null || input.slotIndex == null || !input.module?.typeId) {
        return {
          success: false,
          modules: nextModules,
          drones,
          cargo,
          stats: null,
          errors: ['fitModule or replaceModule requires slot, slotIndex, and module.typeId'],
          slotErrors: {},
        }
      }
      const fitted: Module = {
        id: input.module.id ?? Math.random().toString(36).slice(2, 11),
        typeId: input.module.typeId,
        name: input.module.name,
        slot: input.slot,
        slotIndex: input.slotIndex,
        offline: input.module.offline ?? false,
        charge: input.module.charge,
        chargeTypeId: input.module.chargeTypeId,
      }
      nextModules = nextModules.filter(
        (m) => !(normalizeSlot(m.slot ?? '') === input.slot && m.slotIndex === input.slotIndex)
      )
      nextModules.push(fitted)
      break
    }
    default:
      return {
        success: false,
        modules: nextModules,
        drones,
        cargo,
        stats: null,
        errors: [`Unknown action: ${String((input as FitMutationInput).action)}`],
        slotErrors: {},
      }
  }

  return validateFittingState({
    shipTypeId: input.shipTypeId,
    modules: nextModules,
    drones,
    cargo,
    userId: input.userId,
    characterId: input.characterId,
    skillProfile: input.skillProfile,
  })
}
