const mockCharacterFindMany = jest.fn()
const mockBlueprintFindMany = jest.fn()
const mockBlueprintDeleteMany = jest.fn()
const mockBlueprintCreateMany = jest.fn()
const mockCacheFindMany = jest.fn()
const mockCacheUpsert = jest.fn()
const mockTransaction = jest.fn()
const mockEsiClientGet = jest.fn()
const mockGetValidAccessToken = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    character: {
      findMany: (...args: unknown[]) => mockCharacterFindMany(...args),
    },
    characterBlueprint: {
      findMany: (...args: unknown[]) => mockBlueprintFindMany(...args),
      deleteMany: (...args: unknown[]) => mockBlueprintDeleteMany(...args),
      createMany: (...args: unknown[]) => mockBlueprintCreateMany(...args),
    },
    sdeCache: {
      findMany: (...args: unknown[]) => mockCacheFindMany(...args),
      upsert: (...args: unknown[]) => mockCacheUpsert(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

jest.mock('@/lib/esi-client', () => ({
  esiClient: { get: (...args: unknown[]) => mockEsiClientGet(...args) },
}))

jest.mock('@/lib/token-manager', () => ({
  getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args),
}))

jest.mock('@/lib/server-logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

describe('syncCharacterBlueprints', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'tok' })
    mockBlueprintDeleteMany.mockReturnValue('delete-op')
    mockBlueprintCreateMany.mockReturnValue('create-op')
    mockCacheUpsert.mockResolvedValue({})
    // Array-form $transaction: just await the ops, mirroring Prisma's real behavior.
    mockTransaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops))
  })

  it('paginates across x-pages until every page is fetched', async () => {
    const { syncCharacterBlueprints } = await import('./blueprint-sync')

    mockEsiClientGet
      .mockResolvedValueOnce({
        data: [
          { item_id: 1, type_id: 100, location_id: 60003760, location_flag: 'Hangar', quantity: -1, runs: -1, material_efficiency: 10, time_efficiency: 20 },
        ],
        headers: { 'x-pages': '2' },
      })
      .mockResolvedValueOnce({
        data: [
          { item_id: 2, type_id: 200, location_id: 60003760, location_flag: 'Hangar', quantity: -2, runs: 5, material_efficiency: 9, time_efficiency: 18 },
        ],
        headers: { 'x-pages': '2' },
      })

    const result = await syncCharacterBlueprints(42)

    expect(mockEsiClientGet).toHaveBeenCalledTimes(2)
    expect(mockEsiClientGet).toHaveBeenNthCalledWith(1, '/characters/42/blueprints/', expect.objectContaining({ params: { page: 1 } }))
    expect(mockEsiClientGet).toHaveBeenNthCalledWith(2, '/characters/42/blueprints/', expect.objectContaining({ params: { page: 2 } }))
    expect(result).toEqual({ synced: 2 })
  })

  it('derives isCopy=false for an original (quantity -1) and isCopy=true for a copy (quantity -2)', async () => {
    const { syncCharacterBlueprints } = await import('./blueprint-sync')

    mockEsiClientGet.mockResolvedValueOnce({
      data: [
        { item_id: 1, type_id: 100, location_id: 60003760, location_flag: 'Hangar', quantity: -1, runs: -1, material_efficiency: 10, time_efficiency: 20 },
        { item_id: 2, type_id: 200, location_id: 60003760, location_flag: 'Hangar', quantity: -2, runs: 5, material_efficiency: 9, time_efficiency: 18 },
      ],
      headers: { 'x-pages': '1' },
    })

    await syncCharacterBlueprints(42)

    const createCall = mockBlueprintCreateMany.mock.calls[0][0]
    const rows = createCall.data as { itemId: bigint; isCopy: boolean; runs: number }[]
    const bpo = rows.find((r) => r.itemId === BigInt(1))
    const bpc = rows.find((r) => r.itemId === BigInt(2))
    expect(bpo?.isCopy).toBe(false)
    expect(bpc?.isCopy).toBe(true)
  })

  it('treats an undocumented quantity sentinel conservatively as a copy (never silently an original)', async () => {
    const { syncCharacterBlueprints } = await import('./blueprint-sync')
    const { logger } = await import('@/lib/server-logger')

    mockEsiClientGet.mockResolvedValueOnce({
      data: [
        { item_id: 9, type_id: 900, location_id: 60003760, location_flag: 'Hangar', quantity: 3, runs: -1, material_efficiency: 5, time_efficiency: 10 },
      ],
      headers: { 'x-pages': '1' },
    })

    await syncCharacterBlueprints(42)

    const createCall = mockBlueprintCreateMany.mock.calls[0][0]
    const rows = createCall.data as { itemId: bigint; isCopy: boolean }[]
    expect(rows[0]?.isCopy).toBe(true)
    expect(logger.warn).toHaveBeenCalledWith(
      'INDUSTRY_BP_SYNC',
      expect.stringContaining('Unexpected blueprint quantity sentinel')
    )
  })

  it('deletes and recreates in the same transaction (atomic replace)', async () => {
    const { syncCharacterBlueprints } = await import('./blueprint-sync')

    mockEsiClientGet.mockResolvedValueOnce({
      data: [
        { item_id: 1, type_id: 100, location_id: 60003760, location_flag: 'Hangar', quantity: -1, runs: -1, material_efficiency: 10, time_efficiency: 20 },
      ],
      headers: { 'x-pages': '1' },
    })

    await syncCharacterBlueprints(42)

    expect(mockBlueprintDeleteMany).toHaveBeenCalledWith({ where: { characterId: 42 } })
    expect(mockBlueprintCreateMany).toHaveBeenCalled()
    expect(mockTransaction).toHaveBeenCalledWith(['delete-op', 'create-op'])
  })

  it('never deletes existing rows when the ESI fetch fails', async () => {
    const { syncCharacterBlueprints } = await import('./blueprint-sync')

    mockEsiClientGet.mockRejectedValue({ response: { status: 403 } })

    const result = await syncCharacterBlueprints(42)

    expect(result).toEqual({ error: expect.any(String) })
    expect(mockBlueprintDeleteMany).not.toHaveBeenCalled()
    expect(mockBlueprintCreateMany).not.toHaveBeenCalled()
    expect(mockTransaction).not.toHaveBeenCalled()
    // A failed sync must not look fresh — no marker written.
    expect(mockCacheUpsert).not.toHaveBeenCalled()
  })

  it('records a freshness marker after a successful sync, even with zero blueprints', async () => {
    const { syncCharacterBlueprints } = await import('./blueprint-sync')

    mockEsiClientGet.mockResolvedValueOnce({ data: [], headers: { 'x-pages': '1' } })

    const result = await syncCharacterBlueprints(42)

    expect(result).toEqual({ synced: 0 })
    expect(mockCacheUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'industry_bp_sync_42' },
        create: expect.objectContaining({ value: expect.objectContaining({ syncedAt: expect.any(Number) }) }),
      })
    )
  })

  it('returns an error without touching prisma when there is no access token', async () => {
    const { syncCharacterBlueprints } = await import('./blueprint-sync')
    mockGetValidAccessToken.mockResolvedValue({ accessToken: null })

    const result = await syncCharacterBlueprints(42)

    expect(result).toEqual({ error: expect.stringContaining('No access token') })
    expect(mockEsiClientGet).not.toHaveBeenCalled()
    expect(mockBlueprintDeleteMany).not.toHaveBeenCalled()
  })
})

describe('syncUserBlueprints', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'tok' })
    mockBlueprintDeleteMany.mockReturnValue('delete-op')
    mockBlueprintCreateMany.mockReturnValue('create-op')
    mockCacheUpsert.mockResolvedValue({})
    mockCacheFindMany.mockResolvedValue([]) // no markers by default
    mockTransaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops))
  })

  it('skips a character whose sync marker is within maxAgeMs', async () => {
    const { syncUserBlueprints } = await import('./blueprint-sync')

    const markerMs = Date.now() - 60 * 1000 // 1 min ago
    mockCharacterFindMany.mockResolvedValue([{ id: 1 }])
    mockCacheFindMany.mockResolvedValue([{ key: 'industry_bp_sync_1', value: { syncedAt: markerMs } }])

    const result = await syncUserBlueprints('user-1', { maxAgeMs: 60 * 60 * 1000 })

    expect(mockEsiClientGet).not.toHaveBeenCalled()
    expect(result.synced).toBe(0)
    expect(result.failed).toEqual([])
    expect(result.characters).toBe(1)
    expect(result.lastSyncedAt).toEqual(new Date(markerMs))
  })

  it('does NOT re-sync a zero-blueprint character while its marker is fresh (regression: rowless alts hammered ESI)', async () => {
    const { syncUserBlueprints } = await import('./blueprint-sync')

    mockCharacterFindMany.mockResolvedValue([{ id: 7 }])
    // First call: no marker yet → syncs, ESI returns ZERO blueprints.
    mockEsiClientGet.mockResolvedValueOnce({ data: [], headers: { 'x-pages': '1' } })

    const first = await syncUserBlueprints('user-1', { maxAgeMs: 60 * 60 * 1000 })
    expect(first.synced).toBe(0)
    expect(mockEsiClientGet).toHaveBeenCalledTimes(1)

    // The empty sync still recorded a marker.
    const upsert = mockCacheUpsert.mock.calls[0][0]
    expect(upsert.where).toEqual({ key: 'industry_bp_sync_7' })

    // Second call: the marker written above makes the character fresh → NO new ESI call,
    // even though the character has zero CharacterBlueprint rows.
    mockCacheFindMany.mockResolvedValue([{ key: 'industry_bp_sync_7', value: upsert.create.value }])
    const second = await syncUserBlueprints('user-1', { maxAgeMs: 60 * 60 * 1000 })
    expect(mockEsiClientGet).toHaveBeenCalledTimes(1) // unchanged
    expect(second.synced).toBe(0)
    expect(second.failed).toEqual([])
  })

  it('always syncs a character with no marker, using ONE batched marker lookup for the roster', async () => {
    const { syncUserBlueprints } = await import('./blueprint-sync')

    mockCharacterFindMany.mockResolvedValue([{ id: 1 }, { id: 2 }])
    mockEsiClientGet.mockResolvedValue({
      data: [
        { item_id: 1, type_id: 100, location_id: 1, location_flag: 'Hangar', quantity: -1, runs: -1, material_efficiency: 10, time_efficiency: 20 },
      ],
      headers: { 'x-pages': '1' },
    })

    const result = await syncUserBlueprints('user-1', { maxAgeMs: 60 * 60 * 1000 })

    expect(mockEsiClientGet).toHaveBeenCalledTimes(2)
    expect(result.synced).toBe(2)
    // Freshness read in a single batched query, not one findFirst per character.
    expect(mockCacheFindMany).toHaveBeenCalledTimes(1)
    expect(mockCacheFindMany).toHaveBeenCalledWith({
      where: { key: { in: ['industry_bp_sync_1', 'industry_bp_sync_2'] } },
    })
  })

  it('collects a failed character and continues syncing the rest of the roster', async () => {
    const { syncUserBlueprints } = await import('./blueprint-sync')

    mockCharacterFindMany.mockResolvedValue([{ id: 1 }, { id: 2 }])
    mockGetValidAccessToken.mockImplementation(async (characterId: number) =>
      characterId === 1 ? { accessToken: null } : { accessToken: 'tok' }
    )
    mockEsiClientGet.mockResolvedValue({
      data: [
        { item_id: 2, type_id: 200, location_id: 1, location_flag: 'Hangar', quantity: -1, runs: -1, material_efficiency: 8, time_efficiency: 16 },
      ],
      headers: { 'x-pages': '1' },
    })

    const result = await syncUserBlueprints('user-1', { maxAgeMs: 0 })

    expect(result.failed).toEqual([1])
    expect(result.synced).toBe(1)
    expect(result.characters).toBe(2)
  })
})

describe('getOwnedBlueprints', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('queries ordered by materialEfficiency desc and maps character name', async () => {
    const { getOwnedBlueprints } = await import('./blueprint-sync')

    mockBlueprintFindMany.mockResolvedValue([
      { characterId: 1, materialEfficiency: 10, timeEfficiency: 20, runs: -1, isCopy: false, character: { name: 'Alt One' } },
      { characterId: 2, materialEfficiency: 8, timeEfficiency: 16, runs: 5, isCopy: true, character: { name: 'Alt Two' } },
    ])

    const rows = await getOwnedBlueprints('user-1', 100)

    expect(mockBlueprintFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { typeId: 100, character: { userId: 'user-1' } },
        orderBy: { materialEfficiency: 'desc' },
      })
    )
    expect(rows).toEqual([
      { characterId: 1, characterName: 'Alt One', materialEfficiency: 10, timeEfficiency: 20, runs: -1, isCopy: false },
      { characterId: 2, characterName: 'Alt Two', materialEfficiency: 8, timeEfficiency: 16, runs: 5, isCopy: true },
    ])
  })
})
