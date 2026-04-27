import DogmaCalculator, {
  checkModuleCompatibility,
  DOGMA_ATTRIBUTES,
  getChargeCompatibilityErrors,
} from './dogma-calculator'
import { prisma } from '@/lib/prisma'

// Mock Prisma (must match @/lib/prisma used by dogma-calculator)
jest.mock('@/lib/prisma', () => ({
  prisma: {
    shipStats: {
      findUnique: jest.fn(),
    },
    moduleStats: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    chargeStats: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  },
}))

describe('DogmaCalculator', () => {
  const baseShip = {
    typeId: 601,
    name: 'Ibis',
    groupId: 25,
    highSlots: 2,
    medSlots: 2,
    lowSlots: 2,
    rigSlots: 3,
    subsystemSlots: 4,
    cpu: 100,
    powerGrid: 50,
    capacitor: 500,
    capacitorRecharge: 100,
    shieldCapacity: 500,
    armorHP: 400,
    hullHP: 600,
    shieldEmResist: 1,
    shieldExpResist: 0.25,
    shieldKinResist: 0.4,
    shieldThermResist: 0.2,
    armorEmResist: 0.5,
    armorExpResist: 0.1,
    armorKinResist: 0.25,
    armorThermResist: 0.45,
    hullEmResist: 0.33,
    hullExpResist: 0.33,
    hullKinResist: 0.33,
    hullThermResist: 0.33,
    maxVelocity: 300,
    agility: 0.5,
    mass: 1000000,
    warpSpeed: 5,
    calibration: 400,
    droneBay: 25,
    cargo: 200,
    droneBandwidth: 0,
    maxLockedTargets: 3,
    maxTargetRange: 30000,
    signatureRadius: 100,
    scanResolution: 200,
    sensorStrength: 10,
    sensorType: 'radar',
    turretHardpoints: 2,
    launcherHardpoints: 1,
    rigSize: 2,
    dogmaAttributes: [],
    traits: [],
  }

  const baseModule = (overrides: Record<string, unknown> = {}) => ({
    typeId: 1001,
    name: 'Test Module',
    slotType: 'high',
    groupName: 'Test Group',
    groupId: 10,
    categoryId: 7,
    effects: { effectIds: [12] },
    dogmaAttributes: [],
    cpu: 5,
    powerGrid: 5,
    calibration: 0,
    damage: 0,
    damageMultiplier: 1,
    optimalRange: 0,
    falloffRange: 0,
    trackingSpeed: 0,
    fireRate: 1,
    speedBonus: 0,
    mass: 0,
    shieldBonus: 0,
    armorBonus: 0,
    hullBonus: 0,
    capacitorBonus: 0,
    capacitorNeed: 0,
    ...overrides,
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should correctly calculate basic ship stats without modules', async () => {
    ;(prisma.shipStats.findUnique as jest.Mock).mockResolvedValue(baseShip)

    const fit = {
      high: [],
      med: [],
      low: [],
      rig: [],
    }

    const stats = await DogmaCalculator.calculateFitStats(601, fit)

    expect(stats.cpu.total).toBe(100)
    expect(stats.power.total).toBe(50)
    expect(stats.tank.shield.hp).toBe(500)
    expect(stats.tank.armor.hp).toBe(400)
    expect(stats.tank.hull.hp).toBe(600)
    
    // Calculator exposes resistance (1 - resonance)
    expect(stats.resistance.shield.em).toBeCloseTo(0)
    expect(stats.resistance.shield.exp).toBeCloseTo(0.75)
    expect(stats.resistance.shield.kin).toBeCloseTo(0.6)
    expect(stats.resistance.armor.em).toBeCloseTo(0.5)
  })

  it('should handle missing ship stats by throwing error', async () => {
    ;(prisma.shipStats.findUnique as jest.Mock).mockResolvedValue(null)

    const fit = { high: [], med: [], low: [], rig: [] }
    
    await expect(DogmaCalculator.calculateFitStats(99999, fit)).rejects.toThrow()
  })

  it('should calculate DPS with weapons', async () => {
    const mockWeapon = baseModule({
      typeId: 123,
      name: 'Heavy Missile Launcher I',
      groupName: 'Missile Launcher',
      effects: { effectIds: [12, 40], isLauncher: true, isTurret: false },
      damage: 100,
      fireRate: 5,
    })

    ;(prisma.shipStats.findUnique as jest.Mock).mockResolvedValue({
      ...baseShip,
      typeId: 602,
      cpu: 1000,
      powerGrid: 1000,
      shieldEmResist: 0,
      shieldExpResist: 0,
      shieldKinResist: 0,
      shieldThermResist: 0,
      armorEmResist: 0,
      armorExpResist: 0,
      armorKinResist: 0,
      armorThermResist: 0,
      hullEmResist: 0,
      hullExpResist: 0,
      hullKinResist: 0,
      hullThermResist: 0,
    })
    ;(prisma.moduleStats.findUnique as jest.Mock).mockImplementation(({ where }) => {
      if (where.typeId === 123) return Promise.resolve(mockWeapon)
      return Promise.resolve(null)
    })

    const fit = {
      high: [{ typeId: 123, quantity: 1 }],
      med: [],
      low: [],
      rig: [],
    }

    const stats = await DogmaCalculator.calculateFitStats(602, fit)

    // Missile branch applies the combat engine application factor, so effective DPS is below raw 20.
    expect(stats.dps.missile).toBeCloseTo(14.580296087995109, 8)
    expect(stats.dps.total).toBeCloseTo(14.580296087995109, 8)
  })

  it('rejects modules restricted to other ship groups', () => {
    const stats = { validation: { canFit: true, errors: [], slotErrors: {} } } as any
    checkModuleCompatibility(
      baseModule({
        dogmaAttributes: [{ attributeId: DOGMA_ATTRIBUTES.CAN_FIT_SHIP_GROUP_1, value: 1234 }],
      }) as any,
      baseShip as any,
      stats,
      'high-0'
    )
    expect(stats.validation.canFit).toBe(false)
    expect(stats.validation.errors.join(' | ')).toContain('cannot be fitted on this ship group')
  })

  it('rejects modules restricted to other ship types', () => {
    const stats = { validation: { canFit: true, errors: [], slotErrors: {} } } as any
    checkModuleCompatibility(
      baseModule({
        dogmaAttributes: [{ attributeId: DOGMA_ATTRIBUTES.CAN_FIT_SHIP_TYPE_1, value: 999999 }],
      }) as any,
      baseShip as any,
      stats,
      'high-0'
    )
    expect(stats.validation.canFit).toBe(false)
    expect(stats.validation.errors.join(' | ')).toContain('restricted to specific ship types')
  })

  it('rejects slot mismatch between fitted slot and dogma slot', async () => {
    ;(prisma.shipStats.findUnique as jest.Mock).mockResolvedValue({ ...baseShip, typeId: 700 })
    ;(prisma.moduleStats.findUnique as jest.Mock).mockResolvedValue(
      baseModule({ typeId: 2001, slotType: 'high', effects: { effectIds: [12] } })
    )

    const stats = await DogmaCalculator.calculateFitStats(700, {
      high: [],
      med: [{ typeId: 2001, slot: 'med', slotIndex: 0 }],
      low: [],
      rig: [],
    } as any)

    expect(stats.validation.canFit).toBe(false)
    expect(stats.validation.errors.join(' | ')).toContain('requires a high slot, not med')
  })

  it('rejects hardpoint overflow', async () => {
    ;(prisma.shipStats.findUnique as jest.Mock).mockResolvedValue({
      ...baseShip,
      typeId: 701,
      turretHardpoints: 1,
    })
    ;(prisma.moduleStats.findUnique as jest.Mock).mockResolvedValue(
      baseModule({ typeId: 2100, effects: { effectIds: [12, 42], isTurret: true } })
    )

    const stats = await DogmaCalculator.calculateFitStats(701, {
      high: [
        { typeId: 2100, slot: 'high', slotIndex: 0 },
        { typeId: 2100, slot: 'high', slotIndex: 1 },
      ],
      med: [],
      low: [],
      rig: [],
    } as any)

    expect(stats.validation.canFit).toBe(false)
    expect(stats.validation.errors.join(' | ')).toContain('Turret hardpoints exceeded')
  })

  it('rejects CPU/Powergrid overflow', async () => {
    ;(prisma.shipStats.findUnique as jest.Mock).mockResolvedValue({
      ...baseShip,
      typeId: 702,
      cpu: 1,
      powerGrid: 1,
    })
    ;(prisma.moduleStats.findUnique as jest.Mock).mockResolvedValue(
      baseModule({ typeId: 2200, cpu: 9, powerGrid: 9 })
    )

    const stats = await DogmaCalculator.calculateFitStats(702, {
      high: [
        { typeId: 2200, slot: 'high', slotIndex: 0 },
        { typeId: 2200, slot: 'high', slotIndex: 1 },
      ],
      med: [],
      low: [],
      rig: [],
    } as any)

    expect(stats.validation.canFit).toBe(false)
    expect(stats.validation.errors).toEqual(expect.arrayContaining(['CPU overflow', 'Powergrid overflow']))
  })

  it('rejects strategic cruiser fit with missing subsystems', async () => {
    ;(prisma.shipStats.findUnique as jest.Mock).mockResolvedValue({
      ...baseShip,
      typeId: 703,
      groupId: 1305,
      subsystemSlots: 4,
    })
    ;(prisma.moduleStats.findUnique as jest.Mock).mockResolvedValue(
      baseModule({ typeId: 2300, slotType: 'subsystem', effects: { effectIds: [3499] } })
    )

    const stats = await DogmaCalculator.calculateFitStats(703, {
      high: [],
      med: [],
      low: [],
      rig: [],
      subsystem: [{ typeId: 2300, slot: 'subsystem', slotIndex: 0 }],
    } as any)

    expect(stats.validation.canFit).toBe(false)
    expect(stats.validation.errors.join(' | ')).toContain('require exactly 4 subsystems')
  })

  it('enforces max-active dogma per group', async () => {
    ;(prisma.shipStats.findUnique as jest.Mock).mockResolvedValue({ ...baseShip, typeId: 704 })
    ;(prisma.moduleStats.findUnique as jest.Mock).mockResolvedValue(
      baseModule({
        typeId: 2400,
        groupId: 999,
        groupName: 'Limiter',
        dogmaAttributes: [{ attributeId: DOGMA_ATTRIBUTES.MAX_GROUP_ACTIVE, value: 1 }],
      })
    )

    const stats = await DogmaCalculator.calculateFitStats(704, {
      high: [
        { typeId: 2400, slot: 'high', slotIndex: 0 },
        { typeId: 2400, slot: 'high', slotIndex: 1 },
      ],
      med: [],
      low: [],
      rig: [],
    } as any)

    expect(stats.validation.canFit).toBe(false)
    expect(stats.validation.errors.join(' | ')).toContain('Only 1 Limiter allowed per ship')
  })
})

describe('getChargeCompatibilityErrors', () => {
  it('returns group and size failures from a single ruleset', () => {
    const errs = getChargeCompatibilityErrors(
      { name: 'Blaster', chargeGroup1: 10, chargeSize: 2 },
      { name: 'Antimatter', groupId: 20, chargeSize: 1 }
    )
    expect(errs).toHaveLength(2)
    expect(errs.join(' | ')).toContain('not allowed')
    expect(errs.join(' | ')).toContain('size mismatch')
  })
})
