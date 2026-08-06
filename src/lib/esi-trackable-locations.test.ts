jest.mock('@/lib/esi-client', () => ({
  USER_AGENT: 'test-agent',
  esiClient: {
    post: jest.fn(),
    get: jest.fn(),
  },
}))

jest.mock('@/lib/server-logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() },
}))

jest.mock('@/lib/token-manager', () => ({
  getValidAccessToken: jest.fn().mockResolvedValue({ accessToken: 'test-token' }),
}))

jest.mock('@/lib/sde', () => ({
  getSolarSystemName: jest.fn().mockResolvedValue('Test System'),
}))

import { esiClient } from '@/lib/esi-client'
import { resolveTrackableLocationCategories } from '@/lib/esi'

describe('resolveTrackableLocationCategories', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns only station and structure categories from ESI names', async () => {
    ;(esiClient.post as jest.Mock).mockResolvedValue({
      data: [
        { id: 60003760, name: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant', category: 'station' },
        { id: 1400000000000, name: 'My Citadel', category: 'structure' },
        { id: 1000000000012, name: 'Large Secure Container', category: 'inventory_type' },
        { id: 30000142, name: 'Jita', category: 'solar_system' },
      ],
    })

    const result = await resolveTrackableLocationCategories([
      60003760,
      1400000000000,
      1000000000012,
      30000142,
    ])

    expect([...result.entries()]).toEqual([
      [60003760, { name: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant', category: 'station' }],
      [1400000000000, { name: 'My Citadel', category: 'structure' }],
    ])
  })

  it('falls back to NPC station lookup for ids in 60M-64M range', async () => {
    ;(esiClient.post as jest.Mock).mockResolvedValue({ data: [] })
    ;(esiClient.get as jest.Mock).mockResolvedValue({
      data: { name: 'Amarr VIII (Oris) - Emperor Family Academy' },
    })

    const result = await resolveTrackableLocationCategories([60002140])

    expect(esiClient.get).toHaveBeenCalledWith('/universe/stations/60002140/')
    expect(result.get(60002140)).toEqual({
      name: 'Amarr VIII (Oris) - Emperor Family Academy',
      category: 'station',
    })
  })

  it('excludes container item_ids that are not valid trackable locations', async () => {
    ;(esiClient.post as jest.Mock).mockResolvedValue({
      data: [{ id: 1000000000012, name: 'Large Secure Container', category: 'inventory_type' }],
    })

    const result = await resolveTrackableLocationCategories([1000000000012])

    expect(result.size).toBe(0)
  })

  it('never sends implausible ids (e.g. a fitted module item_id) in the batch request', async () => {
    ;(esiClient.post as jest.Mock).mockResolvedValue({ data: [] })

    await resolveTrackableLocationCategories([123456, 1400000000099])

    expect(esiClient.post).toHaveBeenCalledWith('/universe/names/', [1400000000099])
  })

  it('falls back to an individual structure lookup when the ESI batch call fails entirely', async () => {
    ;(esiClient.post as jest.Mock).mockRejectedValue(new Error('ESI rejected batch: invalid ids'))
    ;(esiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.startsWith('/universe/structures/')) {
        return Promise.resolve({
          data: {
            name: 'My Citadel',
            solar_system_id: 30000142,
            corporation_id: 98000001,
            type: 'structure',
          },
        })
      }
      return Promise.reject(new Error(`unexpected url: ${url}`))
    })

    const result = await resolveTrackableLocationCategories([1400000000001], 2001)

    expect(result.get(1400000000001)).toEqual({ name: 'My Citadel', category: 'structure' })
  })

  it('caps individual structure lookups so a large asset list cannot explode ESI calls', async () => {
    ;(esiClient.post as jest.Mock).mockResolvedValue({ data: [] })
    ;(esiClient.get as jest.Mock).mockResolvedValue({
      data: {
        name: 'Structure',
        solar_system_id: 30000142,
        corporation_id: 98000001,
        type: 'structure',
      },
    })

    const manyStructureIds = Array.from({ length: 30 }, (_, i) => 1_500_000_000_000 + i)
    await resolveTrackableLocationCategories(manyStructureIds, 2002)

    expect((esiClient.get as jest.Mock).mock.calls.length).toBeLessThanOrEqual(20)
  })
})
