/**
 * Transform test for `syncModuleStats` — feeds a realistic fake ESI `universe/types/{id}` payload
 * (mirroring the real Light Neutron Blaster II response captured 2026-07-14) through the sync and
 * asserts the resulting `ModuleStats` columns, without touching a real database or ESI.
 *
 * This is the regression guard for the dogma-attribute-ids.ts fixes: cpu/fireRate/optimalRange/
 * falloffRange/trackingSpeed/capacitorNeed/damageMultiplier must all be non-zero and correct, and
 * fields with no valid module-level attribute (damage, hullBonus) must be 0 rather than garbage.
 */

const mockModuleStatsUpsert = jest.fn()
const mockModuleDogmaAttributeDeleteMany = jest.fn()
const mockModuleDogmaAttributeCreateMany = jest.fn()
const mockEveTypeFindUnique = jest.fn()
const mockEsiGet = jest.fn()
const mockResolveModuleTypeMetadata = jest.fn()
const mockVerifyModuleReadinessForHardware = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    moduleStats: {
      upsert: (...args: unknown[]) => mockModuleStatsUpsert(...args),
    },
    moduleDogmaAttribute: {
      deleteMany: (...args: unknown[]) => mockModuleDogmaAttributeDeleteMany(...args),
      createMany: (...args: unknown[]) => mockModuleDogmaAttributeCreateMany(...args),
    },
    eveType: {
      findUnique: (...args: unknown[]) => mockEveTypeFindUnique(...args),
    },
  },
}))

jest.mock('@/lib/esi-client', () => ({
  esiClient: {
    get: (...args: unknown[]) => mockEsiGet(...args),
  },
}))

jest.mock('@/lib/server-logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

jest.mock('@/lib/sde/module-type-metadata', () => ({
  resolveModuleTypeMetadata: (...args: unknown[]) => mockResolveModuleTypeMetadata(...args),
}))

jest.mock('@/lib/fits/dogma-data-integrity', () => ({
  verifyModuleReadinessForHardware: (...args: unknown[]) =>
    mockVerifyModuleReadinessForHardware(...args),
}))

// Real dogma_attributes captured from ESI for Light Neutron Blaster II (typeId 3178) on 2026-07-14,
// trimmed to the ids exercised by MODULE_SYNC_DOGMA_IDS plus a couple of universal/noise attributes
// (6 = capacitorNeed, 9 = generic module "own hp" — must NOT leak into hullBonus).
const LNB_II_ESI_TYPE = {
  name: 'Light Neutron Blaster II',
  group_id: 74,
  category_id: 7,
  dogma_attributes: [
    { attribute_id: 6, value: 1.4161 }, // capacitorNeed (Activation Cost)
    { attribute_id: 9, value: 40.0 }, // hp (module's own hitpoints — universal noise)
    { attribute_id: 30, value: 9.0 }, // power (Powergrid Usage)
    { attribute_id: 47, value: 1.0 }, // slots (NOT fire rate)
    { attribute_id: 50, value: 18.0 }, // cpu (CPU usage)
    { attribute_id: 51, value: 3500.0 }, // speed (Rate of fire, ms)
    { attribute_id: 54, value: 1800.0 }, // maxRange (Optimal Range)
    { attribute_id: 64, value: 4.41 }, // damageMultiplier (Damage Modifier)
    { attribute_id: 158, value: 2500.0 }, // falloff (Accuracy falloff)
    { attribute_id: 160, value: 379.8 }, // trackingSpeed (Turret Tracking)
    { attribute_id: 633, value: 5.0 }, // metaLevelOld
  ],
  dogma_effects: [
    { effect_id: 12, is_default: false }, // HI_POWER
    { effect_id: 16, is_default: false },
    { effect_id: 34, is_default: true },
    { effect_id: 42, is_default: false }, // TURRET_FITTED
    { effect_id: 3025, is_default: false },
  ],
}

describe('syncModuleStats transform (Light Neutron Blaster II fixture)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEveTypeFindUnique.mockResolvedValue(null)
    mockEsiGet.mockResolvedValue({ data: LNB_II_ESI_TYPE })
    mockResolveModuleTypeMetadata.mockResolvedValue({
      name: 'Light Neutron Blaster II',
      nameSource: 'esi',
      groupId: 74,
      groupIdSource: 'esi',
      categoryId: 7,
      categoryIdSource: 'esi',
      groupName: 'Hybrid Weapon',
      qualityWarning: undefined,
    })
    mockVerifyModuleReadinessForHardware.mockReturnValue([])
    mockModuleStatsUpsert.mockResolvedValue({})
    mockModuleDogmaAttributeDeleteMany.mockResolvedValue({})
    mockModuleDogmaAttributeCreateMany.mockResolvedValue({})
  })

  it('maps the fake ESI payload to the correct ModuleStats columns', async () => {
    const { syncModuleStats } = await import('./module-stats-esi-sync')

    await syncModuleStats(3178)

    expect(mockModuleStatsUpsert).toHaveBeenCalledTimes(1)
    const call = mockModuleStatsUpsert.mock.calls[0][0] as { where: { typeId: number }; create: Record<string, unknown> }
    expect(call.where).toEqual({ typeId: 3178 })

    const stats = call.create

    // Fitting resources — attr 50/30, previously read attr 129 (maxPassengers, always 0).
    expect(stats.cpu).toBe(18.0)
    expect(stats.powerGrid).toBe(9.0)

    // Turret stats — gated by isWeapon, now derived from the TURRET_FITTED effect (42) instead of the
    // bogus MODULE_GROUPS group-id check that never matched a real turret.
    expect(stats.fireRate).toBe(3500.0)
    expect(stats.optimalRange).toBe(1800.0)
    expect(stats.falloffRange).toBe(2500.0)
    expect(stats.trackingSpeed).toBe(379.8)
    expect(stats.damageMultiplier).toBeCloseTo(4.41)

    // No valid module-level damage attribute exists (ammo-dependent) — must be 0, not attr 6's value.
    expect(stats.damage).toBe(0)

    // Capacitor need — attr 6, previously id 100 (404 from ESI, always fell back to 0).
    expect(stats.capacitorNeed).toBeCloseTo(1.4161)

    // hullBonus must NOT leak the module's own generic "hp" attribute (9 = 40 here); no validated
    // hull-HP-bonus attribute exists yet, so this must be 0, not 40.
    expect(stats.hullBonus).toBe(0)

    // Not a shield/armor/hull repair or booster module — these must stay 0.
    expect(stats.shieldBoost).toBe(0)
    expect(stats.armorRepair).toBe(0)
    expect(stats.hullRepair).toBe(0)

    expect(stats.slotType).toBe('high')
    expect(stats.name).toBe('Light Neutron Blaster II')
  })
})
