import { toPublicCharacter } from './public-character'

describe('toPublicCharacter', () => {
  it('returns safe API payload without tokens', () => {
    const result = toPublicCharacter({
      id: 900001,
      name: 'Pilot Alpha',
      totalSp: 123,
      walletBalance: 456,
      location: 'Jita',
      ship: 'Rifter',
      shipTypeId: 587,
      lastFetchedAt: new Date('2026-01-01T00:00:00.000Z'),
      isMain: true,
      esiApp: 'main',
      corporationId: 1001,
      tokenExpiresAt: new Date('2026-01-01T01:00:00.000Z'),
      tags: ['Miner'],
      accessToken: 'not.a.real.jwt',
    })

    expect(result).toMatchObject({
      id: 900001,
      name: 'Pilot Alpha',
      tags: ['Miner'],
    })
    expect(result).not.toHaveProperty('accessToken')
    expect(result).not.toHaveProperty('refreshToken')
    expect(Array.isArray(result.scopes)).toBe(true)
  })
})
