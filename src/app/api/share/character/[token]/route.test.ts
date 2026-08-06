import { ErrorCodes } from '@/lib/error-codes'

jest.mock('@/lib/api-handler', () => ({
  withErrorHandling:
    (handler: any) =>
    async (req: Request, ...args: any[]) => {
      try {
        return await handler(req, ...args)
      } catch (error: any) {
        return {
          status: error?.statusCode || 500,
          json: async () => ({
            error: error?.message || 'Internal server error',
            code: error?.code,
          }),
        }
      }
    },
}))

const mockGetSharedProfileByToken = jest.fn()
jest.mock('@/lib/characters/share-profile', () => ({
  getSharedProfileByToken: (...args: unknown[]) => mockGetSharedProfileByToken(...args),
}))

describe('GET /api/share/character/[token]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 (API_NOT_FOUND) when the token does not resolve to a shared profile', async () => {
    mockGetSharedProfileByToken.mockResolvedValue(null)
    const { GET } = await import('./route')

    const req = { url: 'http://localhost/api/share/character/bad-token' } as unknown as Request
    const res: any = await GET(req, { params: Promise.resolve({ token: 'bad-token' }) })
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.code).toBe(ErrorCodes.API_NOT_FOUND)
    expect(mockGetSharedProfileByToken).toHaveBeenCalledWith('bad-token')
  })

  it('returns 200 with the DTO when the token resolves to a shared profile', async () => {
    const dto = {
      name: 'Pilot Alpha',
      characterId: 900001,
      corporationId: null,
      birthday: null,
      raceId: null,
      bloodlineId: null,
      gender: null,
      securityStatus: null,
      isOmega: null,
      totalSp: null,
      unallocatedSp: null,
      skills: null,
      skillqueue: null,
      attributes: null,
      implants: null,
      capturedAt: null,
    }
    mockGetSharedProfileByToken.mockResolvedValue(dto)
    const { GET } = await import('./route')

    const req = { url: 'http://localhost/api/share/character/good-token' } as unknown as Request
    const res: any = await GET(req, { params: Promise.resolve({ token: 'good-token' }) })

    expect(res).toEqual(dto)
    expect(mockGetSharedProfileByToken).toHaveBeenCalledWith('good-token')
  })
})
