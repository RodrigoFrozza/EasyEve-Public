import { validationToV2Response } from '@/lib/fits-v2/fitting-service-v2'
import { FitsV2Codes } from '@/lib/fits-v2/errors-v2'
import { normalizeFitsV2RequestBody } from '@/lib/fits-v2/state-normalizer-v2'
import type { FitValidationResult } from '@/lib/fits/fitting-validation-service'
import type { ShipStats } from '@/types/fit'

describe('fits-v2 fitting-service-v2', () => {
  it('validationToV2Response maps ship hull missing to SHIP_NOT_FOUND', () => {
    const result: FitValidationResult = {
      success: false,
      modules: [],
      drones: [],
      cargo: [],
      stats: null,
      errors: ['Ship hull stats not found in database'],
      slotErrors: {},
    }
    const env = validationToV2Response(12345, result)
    expect(env.code).toBe(FitsV2Codes.SHIP_NOT_FOUND)
    expect(env.state.shipTypeId).toBe(12345)
    expect(env.stats).toBeNull()
  })

  it('validationToV2Response marks OK when stats exist and success', () => {
    const stats = { validation: { canFit: true, errors: [], slotErrors: {} } } as unknown as ShipStats
    const result: FitValidationResult = {
      success: true,
      modules: [],
      drones: [],
      cargo: [],
      stats,
      errors: [],
      slotErrors: {},
    }
    const env = validationToV2Response(1, result)
    expect(env.code).toBe(FitsV2Codes.OK)
    expect(env.success).toBe(true)
  })

  it('normalizeFitsV2RequestBody maps legacy numeric id to typeId', () => {
    const normalized = normalizeFitsV2RequestBody({
      shipTypeId: 597,
      modules: [{ id: 1234, slot: 'high', slotIndex: 0 }],
      drones: [],
      cargo: [],
    })
    expect(normalized).not.toBeNull()
    expect(normalized!.shipTypeId).toBe(597)
    expect(normalized!.modules[0].typeId).toBe(1234)
  })

  it('normalizeFitsV2RequestBody returns null without shipTypeId', () => {
    expect(normalizeFitsV2RequestBody({ modules: [] })).toBeNull()
  })

  it('maps ship_data_incomplete errors to SHIP_DATA_INCOMPLETE', () => {
    const result: FitValidationResult = {
      success: false,
      modules: [{ typeId: 10, slot: 'high', slotIndex: 0 } as any],
      drones: [],
      cargo: [],
      stats: null,
      errors: ['ship_data_incomplete:missing_cpu'],
      slotErrors: { 'high-0': ['ship_data_incomplete:missing_cpu'] },
    }
    const env = validationToV2Response(12345, result)
    expect(env.code).toBe(FitsV2Codes.SHIP_DATA_INCOMPLETE)
    expect(env.slotErrors['high-0']).toEqual(['ship_data_incomplete:missing_cpu'])
  })

  it('maps module_*_not_in_database to MODULE_NOT_IN_DATABASE', () => {
    const result: FitValidationResult = {
      success: false,
      modules: [{ typeId: 10, slot: 'high', slotIndex: 0 } as any],
      drones: [],
      cargo: [],
      stats: null,
      errors: ['module_10_not_in_database'],
      slotErrors: { 'high-0': ['module_10_not_in_database'] },
    }
    const env = validationToV2Response(12345, result)
    expect(env.code).toBe(FitsV2Codes.MODULE_NOT_IN_DATABASE)
    expect(env.slotErrors['high-0']).toEqual(['module_10_not_in_database'])
  })

  it('maps unknown null-stats failures to VALIDATION_FAILED with slotErrors', () => {
    const result: FitValidationResult = {
      success: false,
      modules: [{ typeId: 10, slot: 'high', slotIndex: 0 } as any],
      drones: [],
      cargo: [],
      stats: null,
      errors: ['invalid_slot'],
      slotErrors: { 'high-0': ['invalid_slot'] },
    }
    const env = validationToV2Response(12345, result)
    expect(env.code).toBe(FitsV2Codes.VALIDATION_FAILED)
    expect(env.slotErrors['high-0']).toEqual(['invalid_slot'])
  })
})
