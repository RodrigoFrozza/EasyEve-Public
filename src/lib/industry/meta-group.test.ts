import { techTier, isFactionGated, META_GROUP } from '@/lib/industry/meta-group'

describe('techTier', () => {
  it('classifies the common tiers', () => {
    expect(techTier(META_GROUP.TECH_I)).toBe('t1')
    expect(techTier(META_GROUP.TECH_II)).toBe('t2')
    expect(techTier(META_GROUP.TECH_III)).toBe('t3')
    expect(techTier(META_GROUP.FACTION)).toBe('faction')
    expect(techTier(META_GROUP.STORYLINE)).toBe('storyline')
    expect(techTier(META_GROUP.OFFICER)).toBe('other')
  })

  it('maps structure meta groups to their tier', () => {
    expect(techTier(META_GROUP.STRUCTURE_TECH_I)).toBe('t1')
    expect(techTier(META_GROUP.STRUCTURE_TECH_II)).toBe('t2')
    expect(techTier(META_GROUP.STRUCTURE_FACTION)).toBe('faction')
  })

  it('treats null/undefined as Tech I baseline', () => {
    expect(techTier(null)).toBe('t1')
    expect(techTier(undefined)).toBe('t1')
  })
})

describe('isFactionGated', () => {
  it('gates Faction and Structure Faction only', () => {
    expect(isFactionGated(META_GROUP.FACTION)).toBe(true)
    expect(isFactionGated(META_GROUP.STRUCTURE_FACTION)).toBe(true)
  })

  it('does not gate T1/T2/T3/storyline/null', () => {
    expect(isFactionGated(META_GROUP.TECH_I)).toBe(false)
    expect(isFactionGated(META_GROUP.TECH_II)).toBe(false)
    expect(isFactionGated(META_GROUP.TECH_III)).toBe(false)
    expect(isFactionGated(META_GROUP.STORYLINE)).toBe(false)
    expect(isFactionGated(null)).toBe(false)
  })
})
