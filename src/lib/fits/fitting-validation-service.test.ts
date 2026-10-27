import {
  applyFitMutation,
  normalizeEditorModules,
  validateFittingState,
  validateModuleChargesAgainstDb,
} from '@/lib/fits/fitting-validation-service'
import { inferModuleSlotTypeFromEffects } from '@/lib/dogma-calculator'
import { calculateFitStats } from '@/lib/dogma-calculator'
import { verifyShipFittingReadiness } from '@/lib/fits/dogma-data-integrity'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    shipStats: { findUnique: jest.fn() },
    moduleStats: { findMany: jest.fn() },
    chargeStats: { findMany: jest.fn() },
  },
}))

jest.mock('@/lib/fits/dogma-data-integrity', () => ({
  verifyShipFittingReadiness: jest.fn(),
}))

jest.mock('@/lib/fits/skill-profile-resolver', () => ({
  resolveSkillProfileForFitting: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/server-logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock('@/lib/dogma-calculator', () => {
  const actual = jest.requireActual('@/lib/dogma-calculator')
  return {
    ...actual,
    calculateFitStats: jest.fn(),
  }
})

describe('normalizeEditorModules', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(verifyShipFittingReadiness as jest.Mock).mockReturnValue([])
  })

  it('maps numeric id to typeId', () => {
    const m = normalizeEditorModules([{ id: 123, slot: 'high', slotIndex: 0 }])
    expect(m).toHaveLength(1)
    expect(m[0].typeId).toBe(123)
    expect(m[0].slot).toBe('high')
  })

  it('normalizes mid to med', () => {
    const m = normalizeEditorModules([{ typeId: 1, slot: 'mid', slotIndex: 0 }])
    expect(m[0].slot).toBe('med')
  })

  it('returns ship_data_incomplete when hull is missing required dogma data', async () => {
    ;(prisma.shipStats.findUnique as jest.Mock).mockResolvedValue({ typeId: 1 })
    ;(verifyShipFittingReadiness as jest.Mock).mockReturnValue(['missing_cpu'])
    const result = await validateFittingState({ shipTypeId: 1, modules: [] as any })
    expect(result.success).toBe(false)
    expect(result.errors).toEqual(['ship_data_incomplete:missing_cpu'])
  })

  it('returns module_not_in_database when module rows are missing', async () => {
    ;(prisma.shipStats.findUnique as jest.Mock).mockResolvedValue({
      typeId: 1,
      highSlots: 2,
      medSlots: 2,
      lowSlots: 2,
      rigSlots: 2,
      subsystemSlots: 0,
    })
    ;(prisma.moduleStats.findMany as jest.Mock).mockResolvedValue([])
    const result = await validateFittingState({
      shipTypeId: 1,
      modules: [{ typeId: 999, slot: 'high', slotIndex: 0 }] as any,
    })
    expect(result.success).toBe(false)
    expect(result.errors).toContain('module_999_not_in_database')
  })

  it('rejects invalid slot index explicitly', async () => {
    ;(prisma.shipStats.findUnique as jest.Mock).mockResolvedValue({
      typeId: 1,
      highSlots: 1,
      medSlots: 1,
      lowSlots: 1,
      rigSlots: 1,
      subsystemSlots: 0,
    })
    ;(prisma.moduleStats.findMany as jest.Mock).mockResolvedValue([{ typeId: 123 }])
    ;(prisma.chargeStats.findMany as jest.Mock).mockResolvedValue([
      { typeId: 77, name: 'S', groupId: 1, chargeSize: 1 },
    ])

    const result = await validateFittingState({
      shipTypeId: 1,
      modules: [{ typeId: 123, slot: 'high', slotIndex: 9 }] as any,
    })

    expect(result.success).toBe(false)
    expect(result.errors.join(' | ')).toContain('targets HIGH-9')
  })

  it('setCharge mutation updates module charge and validates next state', async () => {
    ;(prisma.shipStats.findUnique as jest.Mock).mockResolvedValue({
      typeId: 1,
      highSlots: 2,
      medSlots: 2,
      lowSlots: 2,
      rigSlots: 2,
      subsystemSlots: 0,
    })
    ;(prisma.moduleStats.findMany as jest.Mock).mockResolvedValue([{ typeId: 123 }])
    ;(prisma.chargeStats.findMany as jest.Mock).mockResolvedValue([
      { typeId: 77, name: 'S', groupId: 1, chargeSize: 1 },
    ])
    ;(calculateFitStats as jest.Mock).mockResolvedValue({
      validation: { canFit: true, errors: [], slotErrors: {} },
    })

    const result = await applyFitMutation({
      action: 'setCharge',
      shipTypeId: 1,
      modules: [{ typeId: 123, slot: 'high', slotIndex: 0 }] as any,
      slot: 'high',
      slotIndex: 0,
      charge: { id: 77, name: 'S', quantity: 1 },
    })

    expect(result.success).toBe(true)
    expect(result.modules[0].charge?.id).toBe(77)
  })

  it('validateModuleChargesAgainstDb reports invalid charge group and size', async () => {
    ;(prisma.moduleStats.findMany as jest.Mock).mockResolvedValue([
      {
        typeId: 1,
        name: 'Launcher',
        chargeGroup1: 10,
        chargeSize: 2,
      },
    ])
    ;(prisma.chargeStats.findMany as jest.Mock).mockResolvedValue([
      { typeId: 200, name: 'Wrong Charge', groupId: 20, chargeSize: 1 },
    ])
    const result = await validateModuleChargesAgainstDb([
      { typeId: 1, slot: 'high', slotIndex: 0, chargeTypeId: 200 } as any,
    ])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.join(' | ')).toContain('not allowed')
      expect(result.errors.join(' | ')).toContain('size mismatch')
    }
  })
})

describe('inferModuleSlotTypeFromEffects', () => {
  it('returns high from effectIds', () => {
    expect(
      inferModuleSlotTypeFromEffects({ effects: { effectIds: [12] }, slotType: null })
    ).toBe('high')
  })

  it('falls back to slotType', () => {
    expect(inferModuleSlotTypeFromEffects({ effects: {}, slotType: 'low' })).toBe('low')
  })
})
