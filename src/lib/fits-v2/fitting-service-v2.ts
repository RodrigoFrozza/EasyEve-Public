import { FitsV2Codes } from '@/lib/fits-v2/errors-v2'
import type { FitsV2Response, FitsV2ResolveResponse, FitsV2State } from '@/lib/fits-v2/types-v2'
import { buildFitSuggestions, defaultRolePresets, simulateCapacitor } from '@/lib/fits-v2/engine'
import {
  applyFitMutation,
  validateFittingState,
  type FitMutationInput,
  type FitValidationResult,
} from '@/lib/fits/fitting-validation-service'
import { FitParser } from '@/lib/fits/fit-parser'
import { FitResolver } from '@/lib/fits/fit-resolver'
import type { CargoItem, Drone, Fit, Module, SkillProfile } from '@/types/fit'

function stateFromResult(shipTypeId: number, result: FitValidationResult): FitsV2State {
  return {
    shipTypeId,
    modules: result.modules,
    drones: result.drones,
    cargo: result.cargo,
  }
}

function inferCode(result: FitValidationResult): string {
  if (!result.stats) {
    const first = result.errors[0] || ''
    if (first.includes('not found') || first.includes('Ship hull stats')) {
      return FitsV2Codes.SHIP_NOT_FOUND
    }
    if (first.startsWith('ship_data_incomplete')) {
      return FitsV2Codes.SHIP_DATA_INCOMPLETE
    }
    if (result.errors.some((e) => e.includes('not_in_database'))) {
      return FitsV2Codes.MODULE_NOT_IN_DATABASE
    }
    return FitsV2Codes.VALIDATION_FAILED
  }
  if (!result.success) {
    return FitsV2Codes.VALIDATION_FAILED
  }
  return FitsV2Codes.OK
}

export function validationToV2Response(shipTypeId: number, result: FitValidationResult): FitsV2Response {
  return {
    success: result.success,
    code: inferCode(result),
    state: stateFromResult(shipTypeId, result),
    stats: result.stats,
    errors: result.errors,
    slotErrors: result.slotErrors,
  }
}

export async function fittingServiceValidate(params: {
  shipTypeId: number
  modules: Module[]
  drones: Drone[]
  cargo: CargoItem[]
  userId: string
  characterId?: number | null
  skillProfile?: SkillProfile | null
}): Promise<FitsV2Response> {
  const result = await validateFittingState({
    shipTypeId: params.shipTypeId,
    modules: params.modules,
    drones: params.drones,
    cargo: params.cargo,
    userId: params.userId,
    characterId: params.characterId,
    skillProfile: params.skillProfile,
  })
  return validationToV2Response(params.shipTypeId, result)
}

export async function fittingServiceMutate(input: FitMutationInput): Promise<FitsV2Response> {
  const result = await applyFitMutation(input)
  return validationToV2Response(input.shipTypeId, result)
}

export async function fittingServiceCapacitor(params: {
  shipTypeId: number
  modules: Module[]
  drones: Drone[]
  cargo: CargoItem[]
  userId: string
  characterId?: number | null
  skillProfile?: SkillProfile | null
}) {
  const base = await fittingServiceValidate(params)
  if (!base.stats) {
    return {
      ...base,
      capacitorSim: null,
    }
  }
  const capacitorSim = simulateCapacitor({
    capacity: base.stats.capacitor.capacity,
    rechargeTimeMs: base.stats.capacitor.rechargeRate,
    usagePerSecond: base.stats.capacitor.usePerSecond,
  })
  return {
    ...base,
    capacitorSim,
  }
}

export async function fittingServiceCompare(params: {
  left: { shipTypeId: number; modules: Module[]; drones: Drone[]; cargo: CargoItem[] }
  right: { shipTypeId: number; modules: Module[]; drones: Drone[]; cargo: CargoItem[] }
  userId: string
}) {
  const [leftFit, rightFit] = await Promise.all([
    fittingServiceValidate({ ...params.left, userId: params.userId }),
    fittingServiceValidate({ ...params.right, userId: params.userId }),
  ])
  const diff =
    leftFit.stats && rightFit.stats
      ? {
          dpsDelta: rightFit.stats.dps.total - leftFit.stats.dps.total,
          ehpDelta: rightFit.stats.ehp.total - leftFit.stats.ehp.total,
          capDelta: rightFit.stats.capacitor.percent - leftFit.stats.capacitor.percent,
          speedDelta: rightFit.stats.velocity.maxSpeed - leftFit.stats.velocity.maxSpeed,
          alignDelta: rightFit.stats.velocity.alignTime - leftFit.stats.velocity.alignTime,
          cpuDelta: rightFit.stats.cpu.remaining - leftFit.stats.cpu.remaining,
          powerDelta: rightFit.stats.power.remaining - leftFit.stats.power.remaining,
        }
      : null
  return { left: leftFit, right: rightFit, diff }
}

export async function fittingServiceRecommend(params: {
  shipTypeId: number
  modules: Module[]
  drones: Drone[]
  cargo: CargoItem[]
  userId: string
}) {
  const state = await fittingServiceValidate({ ...params })
  const suggestions = state.stats ? buildFitSuggestions(state.stats, params.modules) : []
  return {
    ...state,
    suggestions,
  }
}

export function fittingServicePresets() {
  return { presets: defaultRolePresets() }
}

export async function fittingServiceExplain(params: {
  shipTypeId: number
  modules: Module[]
  drones: Drone[]
  cargo: CargoItem[]
  userId: string
  characterId?: number | null
  skillProfile?: SkillProfile | null
}) {
  const state = await fittingServiceValidate(params)
  return {
    ...state,
    explain:
      state.stats == null
        ? null
        : {
            history: state.stats.history,
            slotHistory: state.stats.slotHistory,
            provenance: state.stats.provenance ?? {},
          },
  }
}

export async function fittingServiceResolveEft(params: {
  eft: string
  userId: string
}): Promise<
  | { ok: true; response: FitsV2ResolveResponse }
  | { ok: false; response: FitsV2ResolveResponse; httpStatus: number }
> {
  const trimmed = params.eft?.trim()
  if (!trimmed) {
    return {
      ok: false,
      httpStatus: 400,
      response: {
        success: false,
        code: FitsV2Codes.EFT_INVALID,
        state: { shipTypeId: 0, modules: [], drones: [], cargo: [] },
        stats: null,
        errors: ['Missing EFT string'],
        slotErrors: {},
      },
    }
  }

  let parsed
  try {
    parsed = FitParser.parse(trimmed)[0]
  } catch {
    return {
      ok: false,
      httpStatus: 400,
      response: {
        success: false,
        code: FitsV2Codes.EFT_PARSE_FAILED,
        state: { shipTypeId: 0, modules: [], drones: [], cargo: [] },
        stats: null,
        errors: ['Invalid EFT format'],
        slotErrors: {},
      },
    }
  }

  if (!parsed) {
    return {
      ok: false,
      httpStatus: 400,
      response: {
        success: false,
        code: FitsV2Codes.EFT_INVALID,
        state: { shipTypeId: 0, modules: [], drones: [], cargo: [] },
        stats: null,
        errors: ['No fit found in EFT block'],
        slotErrors: {},
      },
    }
  }

  let resolved: Partial<Fit>
  try {
    resolved = await FitResolver.resolve(parsed)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Resolve failed'
    return {
      ok: false,
      httpStatus: 422,
      response: {
        success: false,
        code: FitsV2Codes.EFT_PARSE_FAILED,
        state: { shipTypeId: 0, modules: [], drones: [], cargo: [] },
        stats: null,
        errors: [message],
        slotErrors: {},
      },
    }
  }

  const shipId = resolved.shipId
  if (!shipId) {
    return {
      ok: false,
      httpStatus: 422,
      response: {
        success: false,
        code: FitsV2Codes.SHIP_NOT_FOUND,
        state: { shipTypeId: 0, modules: [], drones: [], cargo: [] },
        stats: null,
        errors: ['Resolved fit missing ship id'],
        slotErrors: {},
        name: resolved.name,
        ship: resolved.ship,
      },
    }
  }

  const validation = await validateFittingState({
    shipTypeId: shipId,
    modules: (resolved.modules || []) as Module[],
    drones: resolved.drones || [],
    cargo: resolved.cargo || [],
    userId: params.userId,
  })

  const base = validationToV2Response(shipId, validation)
  const response: FitsV2ResolveResponse = {
    ...base,
    name: resolved.name,
    ship: resolved.ship,
    shipId: resolved.shipId,
  }

  if (!validation.stats || !validation.success) {
    return {
      ok: false,
      httpStatus: 422,
      response: {
        ...response,
        code: FitsV2Codes.IMPORT_VALIDATION_FAILED,
      },
    }
  }

  return {
    ok: true,
    response,
  }
}
