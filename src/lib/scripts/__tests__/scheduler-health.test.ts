const mockPrisma = {
  schedulerHeartbeat: {
    findFirst: jest.fn(),
    count: jest.fn(),
  },
  scriptSchedule: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
}

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

jest.mock('@/lib/server-logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

jest.mock('../runner', () => ({ runScript: jest.fn() }))

describe('getSchedulerHealth missingRequiredSchedules', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma.schedulerHeartbeat.findFirst.mockResolvedValue({
      tickAt: new Date(),
      source: 'external',
      dueCount: 0,
    })
    mockPrisma.schedulerHeartbeat.count.mockResolvedValue(1)
    mockPrisma.scriptSchedule.count.mockResolvedValue(0)
  })

  it('lists every required scriptId with no active schedule', async () => {
    const { getSchedulerHealth } = await import('../scheduler')
    const { REQUIRED_SCHEDULE_SCRIPT_IDS } = await import('../required-schedules')
    mockPrisma.scriptSchedule.findMany.mockResolvedValue([])

    const health = await getSchedulerHealth()

    expect(health.missingRequiredSchedules.sort()).toEqual(
      [...REQUIRED_SCHEDULE_SCRIPT_IDS].sort()
    )
  })

  it('is empty once all required scripts have an active schedule', async () => {
    const { getSchedulerHealth } = await import('../scheduler')
    const { REQUIRED_SCHEDULE_SCRIPT_IDS } = await import('../required-schedules')
    mockPrisma.scriptSchedule.findMany.mockResolvedValue(
      REQUIRED_SCHEDULE_SCRIPT_IDS.map((scriptId) => ({ scriptId }))
    )

    const health = await getSchedulerHealth()

    expect(health.missingRequiredSchedules).toEqual([])
  })
})
