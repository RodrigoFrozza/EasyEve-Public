import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { assertPlatformModuleActive, isPlatformModuleActive } from '@/lib/admin/platform-module-gate'

const mockFindUnique = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    modulePrice: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}))

describe('platform-module-gate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('assertPlatformModuleActive passes when row is missing', async () => {
    mockFindUnique.mockResolvedValue(null)
    await expect(assertPlatformModuleActive('pi')).resolves.toBeUndefined()
  })

  it('assertPlatformModuleActive passes when row is active', async () => {
    mockFindUnique.mockResolvedValue({ module: 'pi', isActive: true })
    await expect(assertPlatformModuleActive('pi')).resolves.toBeUndefined()
  })

  it('assertPlatformModuleActive throws 403 when row is inactive', async () => {
    mockFindUnique.mockResolvedValue({ module: 'pi', isActive: false })
    await expect(assertPlatformModuleActive('pi')).rejects.toMatchObject({
      statusCode: 403,
      code: ErrorCodes.API_FORBIDDEN,
    })
  })

  it('isPlatformModuleActive returns true when inactive row absent', async () => {
    mockFindUnique.mockResolvedValue(null)
    await expect(isPlatformModuleActive('pi')).resolves.toBe(true)
  })

  it('isPlatformModuleActive returns false when row inactive', async () => {
    mockFindUnique.mockResolvedValue({ module: 'pi', isActive: false })
    await expect(isPlatformModuleActive('pi')).resolves.toBe(false)
  })
})
