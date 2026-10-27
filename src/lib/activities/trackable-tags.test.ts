import { hasTrackableTag, TRACKABLE_TAG_ALIASES } from './trackable-tags'

describe('trackable-tags', () => {
  it('accepts canonical Ratter tag', () => {
    expect(hasTrackableTag(['Ratter'], 'ratter')).toBe(true)
  })

  it('accepts legacy ratting alias', () => {
    expect(hasTrackableTag(['ratting'], 'ratter')).toBe(true)
  })

  it('accepts miner tag case-insensitively', () => {
    expect(hasTrackableTag(['Miner'], 'miner')).toBe(true)
  })

  it('rejects unrelated tags', () => {
    expect(hasTrackableTag(['Explorer'], 'ratter')).toBe(false)
  })

  it('documents ratter aliases', () => {
    expect(TRACKABLE_TAG_ALIASES.ratter).toContain('ratting')
  })
})
