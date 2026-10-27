const mockQueryRaw = jest.fn()
jest.mock('@/lib/prisma', () => ({
  get prisma() {
    return { $queryRaw: (...args: unknown[]) => mockQueryRaw(...args) }
  },
}))

import { checkHealth } from './health'

describe('checkHealth', () => {
  const originalCommit = process.env.SOURCE_COMMIT
  const originalApp = process.env.APP_COMMIT

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.SOURCE_COMMIT = 'abc123'
    delete process.env.APP_COMMIT
  })

  afterAll(() => {
    process.env.SOURCE_COMMIT = originalCommit
    process.env.APP_COMMIT = originalApp
  })

  it('is 200 with the deployed commit when the database answers', async () => {
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }])
    await expect(checkHealth()).resolves.toEqual({
      status: 200,
      body: { status: 'ok', version: 'abc123', database: 'ok' },
    })
  })

  it('is 503 when the database is down, so the new container never takes traffic', async () => {
    mockQueryRaw.mockRejectedValue(new Error('ECONNREFUSED'))
    await expect(checkHealth()).resolves.toMatchObject({ status: 503, body: { status: 'error', database: 'unreachable' } })
  })

  it('reports no version when the image was built without SOURCE_COMMIT', async () => {
    process.env.SOURCE_COMMIT = ''
    mockQueryRaw.mockResolvedValue([])
    expect((await checkHealth()).body.version).toBeNull()
  })

  it("prefers the commit baked into the image over Coolify's SOURCE_COMMIT=HEAD", async () => {
    process.env.APP_COMMIT = 'aaed5f15'
    process.env.SOURCE_COMMIT = 'HEAD'
    mockQueryRaw.mockResolvedValue([])
    expect((await checkHealth()).body.version).toBe('aaed5f15')
  })

  it('never reports HEAD as a version', async () => {
    process.env.SOURCE_COMMIT = 'HEAD'
    mockQueryRaw.mockResolvedValue([])
    expect((await checkHealth()).body.version).toBeNull()
  })
})
