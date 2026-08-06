import { normalizeEveImageSize } from '@/lib/eve-images'

describe('eve-images', () => {
  it('normalizes display sizes to valid CDN powers of two', () => {
    expect(normalizeEveImageSize(16)).toBe(32)
    expect(normalizeEveImageSize(24)).toBe(32)
    expect(normalizeEveImageSize(32)).toBe(32)
    expect(normalizeEveImageSize(40)).toBe(64)
    expect(normalizeEveImageSize(128)).toBe(128)
  })
})
