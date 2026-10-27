import { isInsideAbyss } from './abyssal-detection'

describe('isInsideAbyss', () => {
  it('detects abyssal deadspace by name', () => {
    expect(isInsideAbyss('Abyssal Deadspace')).toBe(true)
    expect(isInsideAbyss('AD12345')).toBe(true)
    expect(isInsideAbyss('ED999')).toBe(true)
  })

  it('detects abyssal deadspace by solar system id range', () => {
    expect(isInsideAbyss('Some System', 32_000_001)).toBe(true)
    expect(isInsideAbyss('Some System', 31_999_999)).toBe(false)
  })

  it('returns false for normal space', () => {
    expect(isInsideAbyss('Jita', 30000142)).toBe(false)
  })
})
