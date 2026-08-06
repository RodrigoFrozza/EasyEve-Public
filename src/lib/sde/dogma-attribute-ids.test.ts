import {
  DOGMA_EFFECT_IDS,
  MODULE_SYNC_DOGMA_IDS,
  SHIP_DOGMA_ATTRIBUTE_IDS,
  moduleDogmaAttributeLabel,
} from './dogma-attribute-ids'

describe('dogma-attribute-ids', () => {
  it('exposes stable hull slot effect ids', () => {
    expect(DOGMA_EFFECT_IDS.HI_POWER).toBe(12)
    expect(DOGMA_EFFECT_IDS.MED_POWER).toBe(13)
    expect(DOGMA_EFFECT_IDS.LO_POWER).toBe(11)
  })

  it('uses modern hull high/med/low dogma ids', () => {
    expect(SHIP_DOGMA_ATTRIBUTE_IDS.highSlots).toBe(14)
    expect(SHIP_DOGMA_ATTRIBUTE_IDS.medSlots).toBe(13)
    expect(SHIP_DOGMA_ATTRIBUTE_IDS.lowSlots).toBe(12)
  })

  it('resolves module dogma labels', () => {
    expect(moduleDogmaAttributeLabel(MODULE_SYNC_DOGMA_IDS.CPU_NEEDED)).toBe('CPU_NEEDED')
    expect(moduleDogmaAttributeLabel(999999)).toMatch(/^attr_/)
  })

  describe('MODULE_SYNC_DOGMA_IDS ESI ground truth (2026-07-14 audit)', () => {
    // Each value below was confirmed against live ESI `dogma/attributes/{id}` and a real reference
    // module's `universe/types/{id}` payload. See the field-level comments on MODULE_SYNC_DOGMA_IDS
    // for the reference typeId used and the ESI attribute name/description.
    it('turret fields (Light Neutron Blaster II, typeId 3178)', () => {
      expect(MODULE_SYNC_DOGMA_IDS.CPU_NEEDED).toBe(50) // cpu
      expect(MODULE_SYNC_DOGMA_IDS.POWER_NEEDED).toBe(30) // power
      expect(MODULE_SYNC_DOGMA_IDS.FIRE_RATE).toBe(51) // speed (Rate of fire)
      expect(MODULE_SYNC_DOGMA_IDS.OPTIMAL_RANGE).toBe(54) // maxRange
      expect(MODULE_SYNC_DOGMA_IDS.FALLOFF_RANGE).toBe(158) // falloff
      expect(MODULE_SYNC_DOGMA_IDS.TRACKING_SPEED).toBe(160) // trackingSpeed
      expect(MODULE_SYNC_DOGMA_IDS.CAPACITOR_NEEDED).toBe(6) // capacitorNeed
      expect(MODULE_SYNC_DOGMA_IDS.DAMAGE_MULTIPLIER).toBe(64) // damageMultiplier
    })

    it('shield/armor/hull resonance multipliers (Damage Control II, typeId 2048)', () => {
      expect(MODULE_SYNC_DOGMA_IDS.SHIELD_EM_MULTIPLIER).toBe(271)
      expect(MODULE_SYNC_DOGMA_IDS.SHIELD_EXP_MULTIPLIER).toBe(272)
      expect(MODULE_SYNC_DOGMA_IDS.SHIELD_KIN_MULTIPLIER).toBe(273)
      expect(MODULE_SYNC_DOGMA_IDS.SHIELD_THERM_MULTIPLIER).toBe(274)
      expect(MODULE_SYNC_DOGMA_IDS.ARMOR_EM_MULTIPLIER).toBe(267)
      expect(MODULE_SYNC_DOGMA_IDS.ARMOR_EXP_MULTIPLIER).toBe(268)
      expect(MODULE_SYNC_DOGMA_IDS.ARMOR_KIN_MULTIPLIER).toBe(269)
      expect(MODULE_SYNC_DOGMA_IDS.ARMOR_THERM_MULTIPLIER).toBe(270)
      // Hull family (974-977) must NOT collide with the shield family (271-274) anymore.
      expect(MODULE_SYNC_DOGMA_IDS.HULL_EM_MULTIPLIER).toBe(974)
      expect(MODULE_SYNC_DOGMA_IDS.HULL_EXP_MULTIPLIER).toBe(975)
      expect(MODULE_SYNC_DOGMA_IDS.HULL_KIN_MULTIPLIER).toBe(976)
      expect(MODULE_SYNC_DOGMA_IDS.HULL_THERM_MULTIPLIER).toBe(977)
    })

    it('shield/armor repair amounts (Large Shield Extender II 3841, Medium Armor Repairer II 3530)', () => {
      expect(MODULE_SYNC_DOGMA_IDS.SHIELD_CAPACITY).toBe(72) // capacityBonus, NOT 73 (duration)
      expect(MODULE_SYNC_DOGMA_IDS.SHIELD_BOOST).toBe(68) // shieldBonus
      expect(MODULE_SYNC_DOGMA_IDS.ARMOR_BOOST).toBe(84) // armorDamageAmount, NOT 73 (duration)
      expect(MODULE_SYNC_DOGMA_IDS.ARMOR_HP).toBe(265) // armorHP
    })

    it('stasis web fields (Stasis Webifier I, typeId 526)', () => {
      expect(MODULE_SYNC_DOGMA_IDS.WEB_SPEED_FACTOR).toBe(20) // speedFactor
      expect(MODULE_SYNC_DOGMA_IDS.WEB_RANGE).toBe(54) // maxRange (shared with OPTIMAL_RANGE)
    })

    it('fields with no valid module-level attribute are sentinel (-1), never a real ESI id', () => {
      expect(MODULE_SYNC_DOGMA_IDS.DAMAGE).toBe(-1)
      expect(MODULE_SYNC_DOGMA_IDS.MISSILE_DAMAGE).toBe(-1)
      expect(MODULE_SYNC_DOGMA_IDS.MISSILE_VELOCITY).toBe(-1)
      expect(MODULE_SYNC_DOGMA_IDS.MISSILE_RANGE).toBe(-1)
      expect(MODULE_SYNC_DOGMA_IDS.EXPLOSION_RADIUS).toBe(-1)
      expect(MODULE_SYNC_DOGMA_IDS.EXPLOSION_VELOCITY).toBe(-1)
      expect(MODULE_SYNC_DOGMA_IDS.HULL_BOOST).toBe(-1)
      expect(MODULE_SYNC_DOGMA_IDS.STRUCTURAL_INTEGRITY).toBe(-1)
      expect(MODULE_SYNC_DOGMA_IDS.ECCM_SENSOR_STRENGTH).toBe(-1)
      expect(MODULE_SYNC_DOGMA_IDS.SENSOR_DAMPENER_RANGE).toBe(-1)
      expect(MODULE_SYNC_DOGMA_IDS.TRACKING_DISRUPTOR_RANGE).toBe(-1)
    })

    // Full field -> id table, locked against silent regression. If this snapshot changes, a real
    // attribute id was edited — re-validate against ESI before accepting the new snapshot.
    it('matches the full field->id snapshot', () => {
      expect(MODULE_SYNC_DOGMA_IDS).toMatchSnapshot()
    })
  })
})
