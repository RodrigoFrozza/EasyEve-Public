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
})
