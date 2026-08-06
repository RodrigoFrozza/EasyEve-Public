import { generateShareToken } from './share-token'

describe('generateShareToken', () => {
  it('generates a non-empty, URL-safe token', () => {
    const token = generateShareToken()

    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)
    // base64url alphabet only — no '+', '/', or '=' padding, so it's safe to
    // drop straight into a URL path segment.
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('carries high entropy — 16 random bytes (128 bits) base64url-encoded', () => {
    const token = generateShareToken()

    // 16 bytes -> 22 base64url chars with padding stripped (ceil(16*4/3) - 2).
    expect(token.length).toBe(22)
  })

  it('generates a different token on every call (not deterministic/reused)', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateShareToken()))

    expect(tokens.size).toBe(200)
  })

  it('two consecutive calls never return the same token', () => {
    const a = generateShareToken()
    const b = generateShareToken()

    expect(a).not.toBe(b)
  })
})
