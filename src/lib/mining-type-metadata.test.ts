import { shouldRefetchMiningTypeFromEsi } from './mining-type-metadata'

describe('shouldRefetchMiningTypeFromEsi', () => {
  it('returns true when meta is undefined', () => {
    expect(shouldRefetchMiningTypeFromEsi(undefined)).toBe(true)
  })

  it('returns true when name is missing', () => {
    expect(shouldRefetchMiningTypeFromEsi({ name: '', volume: 10, groupId: 18 })).toBe(true)
  })

  it('returns true when volume is zero', () => {
    expect(shouldRefetchMiningTypeFromEsi({ name: 'Veldspar', volume: 0, groupId: 18 })).toBe(true)
  })

  it('returns false for known asteroid ore group with volume 1', () => {
    expect(shouldRefetchMiningTypeFromEsi({ name: 'Veldspar', volume: 1, groupId: 18 })).toBe(false)
    expect(shouldRefetchMiningTypeFromEsi({ name: 'Scordite', volume: 1, groupId: 19 })).toBe(false)
    expect(shouldRefetchMiningTypeFromEsi({ name: 'Plagioclase', volume: 1, groupId: 20 })).toBe(false)
  })

  it('returns true for volume 1 when group is not a known asteroid ore group', () => {
    expect(shouldRefetchMiningTypeFromEsi({ name: 'Some Moon Ore', volume: 1, groupId: 884 })).toBe(true)
    expect(shouldRefetchMiningTypeFromEsi({ name: 'Ice', volume: 1, groupId: 465 })).toBe(true)
  })

  it('returns false for normal volume with valid name', () => {
    expect(shouldRefetchMiningTypeFromEsi({ name: 'Veldspar', volume: 0.1, groupId: 18 })).toBe(false)
  })
})
