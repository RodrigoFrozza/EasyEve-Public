const mockCharacterFindMany = jest.fn()
const mockEveTypeFindMany = jest.fn()
const mockCacheFindUnique = jest.fn()
const mockCacheUpsert = jest.fn()
const mockEsiClientGet = jest.fn()
const mockGetValidAccessToken = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    character: {
      findMany: (...args: unknown[]) => mockCharacterFindMany(...args),
    },
    eveType: {
      findMany: (...args: unknown[]) => mockEveTypeFindMany(...args),
    },
    sdeCache: {
      findUnique: (...args: unknown[]) => mockCacheFindUnique(...args),
      upsert: (...args: unknown[]) => mockCacheUpsert(...args),
    },
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

function esiJob(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    job_id: 1,
    installer_id: 100,
    facility_id: 60003760,
    station_id: 60003760,
    activity_id: 1,
    blueprint_id: 999,
    blueprint_type_id: 100,
    blueprint_location_id: 60003760,
    output_location_id: 60003760,
    runs: 1,
    status: 'active',
    duration: 3600,
    start_date: '2026-07-17T00:00:00Z',
    end_date: '2026-07-17T02:00:00Z',
    product_type_id: 200,
    ...overrides,
  }
}

describe('getUserIndustryJobs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'tok' })
    mockCacheFindUnique.mockResolvedValue(null)
    mockCacheUpsert.mockResolvedValue({})
    mockCharacterFindMany.mockResolvedValue([
      { id: 1, name: 'Alt One' },
      { id: 2, name: 'Alt Two' },
    ])
    mockEveTypeFindMany.mockResolvedValue([
      { id: 100, name: 'Rifter Blueprint' },
      { id: 200, name: 'Rifter' },
    ])
  })

  it('merges jobs across characters', async () => {
    const { getUserIndustryJobs } = await import('./industry-jobs')

    mockEsiClientGet
      .mockResolvedValueOnce({ data: [esiJob({ job_id: 1 })] })
      .mockResolvedValueOnce({ data: [esiJob({ job_id: 2, blueprint_id: 998 })] })

    const result = await getUserIndustryJobs('user-1', [1, 2])

    expect(result.jobs).toHaveLength(2)
    expect(result.failed).toEqual([])
    expect(result.jobs.map((j) => j.jobId).sort()).toEqual([1, 2])
  })

  it('isolates a per-character ESI failure — other characters still return', async () => {
    const { getUserIndustryJobs } = await import('./industry-jobs')

    mockEsiClientGet.mockImplementation((url: string) => {
      if (url.includes('/characters/1/')) return Promise.reject({ response: { status: 403 } })
      return Promise.resolve({ data: [esiJob({ job_id: 2 })] })
    })

    const result = await getUserIndustryJobs('user-1', [1, 2])

    expect(result.failed).toEqual([1])
    expect(result.jobs).toHaveLength(1)
    expect(result.jobs[0]?.characterId).toBe(2)
  })

  it('serves the cache within TTL without calling ESI', async () => {
    const { getUserIndustryJobs } = await import('./industry-jobs')

    const cachedJob = {
      jobId: 5,
      characterId: 1,
      characterName: 'Alt One',
      activityId: 1,
      activityName: 'Manufacturing',
      productTypeId: 200,
      productName: 'Rifter',
      blueprintTypeId: 100,
      blueprintName: 'Rifter Blueprint',
      runs: 1,
      startDate: '2026-07-17T00:00:00Z',
      endDate: '2026-07-17T02:00:00Z',
      status: 'active',
      ready: false,
      facilityId: '60003760',
    }
    mockCacheFindUnique.mockResolvedValue({ value: { jobs: [cachedJob], fetchedAt: Date.now() - 1000 } })

    const result = await getUserIndustryJobs('user-1', [1, 2])

    expect(mockEsiClientGet).not.toHaveBeenCalled()
    expect(result.jobs).toEqual([cachedJob])
  })

  it('forceRefresh bypasses the cache', async () => {
    const { getUserIndustryJobs } = await import('./industry-jobs')

    mockCacheFindUnique.mockResolvedValue({
      value: { jobs: [{ jobId: 999 }], fetchedAt: Date.now() - 1000 },
    })
    mockEsiClientGet.mockResolvedValue({ data: [esiJob({ job_id: 7 })] })

    const result = await getUserIndustryJobs('user-1', [1, 2], { forceRefresh: true })

    expect(mockEsiClientGet).toHaveBeenCalled()
    expect(result.jobs.some((j) => j.jobId === 7)).toBe(true)
  })

  it('resolves a null productName when product_type_id is absent (e.g. TE/ME research)', async () => {
    const { getUserIndustryJobs } = await import('./industry-jobs')

    mockEsiClientGet
      .mockResolvedValueOnce({ data: [esiJob({ job_id: 1, activity_id: 3, product_type_id: undefined })] })
      .mockResolvedValueOnce({ data: [] })

    const result = await getUserIndustryJobs('user-1', [1, 2])

    const job = result.jobs.find((j) => j.jobId === 1)
    expect(job?.productTypeId).toBeNull()
    expect(job?.productName).toBeNull()
    expect(job?.activityName).toBe('Time Efficiency Research')
  })

  it('sorts jobs by end_date ascending (soonest first)', async () => {
    const { getUserIndustryJobs } = await import('./industry-jobs')

    mockEsiClientGet
      .mockResolvedValueOnce({
        data: [esiJob({ job_id: 1, end_date: '2026-07-20T00:00:00Z' })],
      })
      .mockResolvedValueOnce({
        data: [esiJob({ job_id: 2, end_date: '2026-07-17T00:00:00Z' })],
      })

    const result = await getUserIndustryJobs('user-1', [1, 2])

    expect(result.jobs.map((j) => j.jobId)).toEqual([2, 1])
  })

  it('flags ready=true for status "ready" and for an active job past its end_date', async () => {
    const { getUserIndustryJobs } = await import('./industry-jobs')

    mockEsiClientGet
      .mockResolvedValueOnce({
        data: [
          esiJob({ job_id: 1, status: 'ready', end_date: '2099-01-01T00:00:00Z' }),
          esiJob({ job_id: 2, status: 'active', end_date: '2000-01-01T00:00:00Z' }),
          esiJob({ job_id: 3, status: 'active', end_date: '2099-01-01T00:00:00Z' }),
        ],
      })
      .mockResolvedValueOnce({ data: [] })

    const result = await getUserIndustryJobs('user-1', [1, 2])

    const byId = new Map(result.jobs.map((j) => [j.jobId, j]))
    expect(byId.get(1)?.ready).toBe(true)
    expect(byId.get(2)?.ready).toBe(true)
    expect(byId.get(3)?.ready).toBe(false)
  })

  it('excludes terminal jobs (delivered/cancelled/reverted) returned by include_completed', async () => {
    const { getUserIndustryJobs } = await import('./industry-jobs')

    mockEsiClientGet
      .mockResolvedValueOnce({
        data: [
          esiJob({ job_id: 1, status: 'active' }),
          esiJob({ job_id: 2, status: 'delivered' }),
          esiJob({ job_id: 3, status: 'cancelled' }),
          esiJob({ job_id: 4, status: 'reverted' }),
          esiJob({ job_id: 5, status: 'ready' }),
          esiJob({ job_id: 6, status: 'paused' }),
        ],
      })
      .mockResolvedValueOnce({ data: [] })

    const result = await getUserIndustryJobs('user-1', [1, 2])

    // Only active/paused/ready survive; delivered/cancelled/reverted are dropped.
    expect(result.jobs.map((j) => j.jobId).sort()).toEqual([1, 5, 6])
  })

  it('keeps a paused job past its end_date but marks it ready=false (frozen timer)', async () => {
    const { getUserIndustryJobs } = await import('./industry-jobs')

    mockEsiClientGet
      .mockResolvedValueOnce({
        data: [esiJob({ job_id: 1, status: 'paused', end_date: '2000-01-01T00:00:00Z' })],
      })
      .mockResolvedValueOnce({ data: [] })

    const result = await getUserIndustryJobs('user-1', [1, 2])

    const job = result.jobs.find((j) => j.jobId === 1)
    expect(job).toBeDefined()
    expect(job?.ready).toBe(false)
  })

  it('unknown activity_id renders as "Activity {id}" instead of being guessed', async () => {
    const { getUserIndustryJobs } = await import('./industry-jobs')

    mockEsiClientGet
      .mockResolvedValueOnce({ data: [esiJob({ job_id: 1, activity_id: 42 })] })
      .mockResolvedValueOnce({ data: [] })

    const result = await getUserIndustryJobs('user-1', [1, 2])
    expect(result.jobs[0]?.activityName).toBe('Activity 42')
  })

  it('serves a stale cache on total ESI failure when the cache is still usable (<30min)', async () => {
    const { getUserIndustryJobs } = await import('./industry-jobs')

    const cachedJob = { jobId: 5, characterId: 1 }
    // First call (no forceRefresh, TTL check) sees an expired-but-recent cache;
    // ESI then fails for every character, so we fall back to it and flag stale.
    mockCacheFindUnique.mockResolvedValue({
      value: { jobs: [cachedJob], fetchedAt: Date.now() - 10 * 60 * 1000 }, // 10 min old
    })
    mockEsiClientGet.mockRejectedValue({ response: { status: 500 } })

    const result = await getUserIndustryJobs('user-1', [1, 2], { forceRefresh: true })

    expect(result.stale).toBe(true)
    expect(result.jobs).toEqual([cachedJob])
    expect(result.failed).toEqual([1, 2])
  })
})
