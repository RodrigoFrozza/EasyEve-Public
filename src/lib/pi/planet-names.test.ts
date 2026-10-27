const mockEsiClientGet = jest.fn()

jest.mock('@/lib/esi-client', () => ({
  esiClient: { get: (...args: unknown[]) => mockEsiClientGet(...args) },
}))

jest.mock('@/lib/server-logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

describe('resolvePlanetNames', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
  })

  it('uses the per-planet endpoint, not the batch /universe/names/ resolver (ESI rejects planet ids there)', async () => {
    mockEsiClientGet.mockResolvedValue({ data: { name: 'UALX-3 III', planet_id: 40000001 } })
    const { resolvePlanetNames } = await import('./planet-names')

    await resolvePlanetNames([40000001])

    expect(mockEsiClientGet).toHaveBeenCalledWith('/universe/planets/40000001/')
  })

  it('never fabricates a "Planet <id>" placeholder — omits ids ESI could not name', async () => {
    mockEsiClientGet.mockRejectedValue({ response: { status: 404 } })
    const { resolvePlanetNames } = await import('./planet-names')

    const result = await resolvePlanetNames([40000001])

    expect(result[40000001]).toBeUndefined()
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('returns the real name for ids ESI does resolve', async () => {
    mockEsiClientGet.mockResolvedValue({ data: { name: 'UALX-3 III', planet_id: 40000001 } })
    const { resolvePlanetNames } = await import('./planet-names')

    const result = await resolvePlanetNames([40000001])

    expect(result[40000001]).toBe('UALX-3 III')
  })

  it('does not negative-cache a fetch failure — retries on the next call', async () => {
    mockEsiClientGet.mockRejectedValueOnce(new Error('network blip'))
    const { resolvePlanetNames } = await import('./planet-names')

    const first = await resolvePlanetNames([40000002])
    expect(first[40000002]).toBeUndefined()

    mockEsiClientGet.mockResolvedValueOnce({
      data: { name: 'Recovered Planet', planet_id: 40000002 },
    })
    const second = await resolvePlanetNames([40000002])
    expect(second[40000002]).toBe('Recovered Planet')
  })

  it('caches a resolved name indefinitely — no second ESI call for the same id', async () => {
    mockEsiClientGet.mockResolvedValue({ data: { name: 'UALX-3 III', planet_id: 40000001 } })
    const { resolvePlanetNames } = await import('./planet-names')

    await resolvePlanetNames([40000001])
    await resolvePlanetNames([40000001])

    expect(mockEsiClientGet).toHaveBeenCalledTimes(1)
  })
})
