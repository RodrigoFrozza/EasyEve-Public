import { inferNpcFactionFromRegion, REGION_NPC_FACTION_MAP } from './region-npc-factions'

describe('inferNpcFactionFromRegion', () => {
  it('maps an Amarr empire region to Blood Raider', () => {
    expect(inferNpcFactionFromRegion('Domain', 'Highsec')).toBe('Blood Raider')
  })

  it('maps a Caldari empire region to Guristas', () => {
    expect(inferNpcFactionFromRegion('The Forge', 'Highsec')).toBe('Guristas')
  })

  it('maps a known null-sec pirate region regardless of security band', () => {
    expect(inferNpcFactionFromRegion('Venal', 'Nullsec')).toBe('Guristas')
    expect(inferNpcFactionFromRegion('Stain', 'Nullsec')).toBe('Sansha')
  })

  it('returns Sleepers for Wormhole space regardless of region name', () => {
    expect(inferNpcFactionFromRegion(undefined, 'Wormhole')).toBe('Sleepers')
    expect(inferNpcFactionFromRegion('Some J-Space Pseudo Region', 'Wormhole')).toBe('Sleepers')
  })

  it('returns Triglavian for Pochven regardless of region name', () => {
    expect(inferNpcFactionFromRegion('Pochven', 'Pochven')).toBe('Triglavian')
  })

  it('returns undefined (never a placeholder string) for an unmapped region', () => {
    expect(inferNpcFactionFromRegion('Some Unmapped Region', 'Nullsec')).toBeUndefined()
    expect(inferNpcFactionFromRegion(undefined, 'Nullsec')).toBeUndefined()
  })

  it('has no empty or duplicate-cased keys in the static map', () => {
    for (const [region, faction] of Object.entries(REGION_NPC_FACTION_MAP)) {
      expect(region.trim().length).toBeGreaterThan(0)
      expect(faction.trim().length).toBeGreaterThan(0)
    }
  })
})
