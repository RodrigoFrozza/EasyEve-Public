import { encryptToken, decryptToken } from './token-cipher'

describe('token-cipher', () => {
  it('round-trips a plaintext token through encrypt/decrypt', () => {
    const original = 'eyJhbGciOiJSUzI1NiJ9.mock.access-token-payload'
    const encrypted = encryptToken(original)

    expect(encrypted).not.toBe(original)
    expect(encrypted.startsWith('v1:')).toBe(true)
    expect(decryptToken(encrypted)).toBe(original)
  })

  it('produces a different ciphertext each time (random IV)', () => {
    const original = 'refresh-token-value'
    const first = encryptToken(original)
    const second = encryptToken(original)

    expect(first).not.toBe(second)
    expect(decryptToken(first)).toBe(original)
    expect(decryptToken(second)).toBe(original)
  })

  it('passes legacy plaintext values through unchanged on decrypt', () => {
    const legacyPlaintext = 'this-was-never-encrypted'
    expect(decryptToken(legacyPlaintext)).toBe(legacyPlaintext)
  })

  it('throws when the ciphertext has been tampered with', () => {
    const encrypted = encryptToken('some-token')
    const tampered = encrypted.slice(0, -4) + 'abcd'

    expect(() => decryptToken(tampered)).toThrow()
  })
})
