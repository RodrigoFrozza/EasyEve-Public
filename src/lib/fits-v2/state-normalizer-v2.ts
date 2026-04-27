import type { Drone, CargoItem, SkillProfile } from '@/types/fit'
import { normalizeEditorModules } from '@/lib/fits/fitting-validation-service'

export interface NormalizeFitsV2BodyResult {
  shipTypeId: number
  modules: ReturnType<typeof normalizeEditorModules>
  drones: Drone[]
  cargo: CargoItem[]
  characterId?: number | null
  skillProfile?: SkillProfile | null
}

/**
 * Normalizes a client / legacy fit snapshot into the shapes expected by
 * `validateFittingState` / `applyFitMutation`.
 */
export function normalizeFitsV2RequestBody(body: Record<string, unknown>): NormalizeFitsV2BodyResult | null {
  const shipTypeId = Number(body.shipTypeId)
  if (!Number.isFinite(shipTypeId) || shipTypeId <= 0) {
    return null
  }

  const modules = normalizeEditorModules(Array.isArray(body.modules) ? body.modules : [])
  const drones = Array.isArray(body.drones) ? (body.drones as Drone[]) : []
  const cargo = Array.isArray(body.cargo) ? (body.cargo as CargoItem[]) : []
  const characterId =
    body.characterId === undefined || body.characterId === null
      ? undefined
      : typeof body.characterId === 'number'
        ? body.characterId
        : Number(body.characterId)

  const skillProfile =
    body.skillProfile && typeof body.skillProfile === 'object'
      ? (body.skillProfile as SkillProfile)
      : undefined

  return {
    shipTypeId,
    modules,
    drones,
    cargo,
    characterId: Number.isNaN(Number(characterId)) ? undefined : characterId,
    skillProfile,
  }
}
