const mockPrisma = {
  schedulerHeartbeat: {
    findFirst: jest.fn(),
    count: jest.fn(),
  },
  scriptSchedule: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  scriptExecution: {
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
    mockPrisma.scriptExecution.findMany.mockResolvedValue([])
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

describe('getSchedulerHealth failingSchedules', () => {
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

  it('stays healthy (ticking) but lists a schedule whose every recent run failed', async () => {
    const { getSchedulerHealth } = await import('../scheduler')
    mockPrisma.scriptSchedule.findMany.mockResolvedValue([
      { id: 'wallet', scriptId: 'sync-wallet-journal', name: 'Sync Corp Wallet Journal' },
      { id: 'ok', scriptId: 'health-check', name: 'Health Check' },
    ])
    mockPrisma.scriptExecution.findMany.mockImplementation(({ where }: { where: { scheduleId: string } }) =>
      Promise.resolve(
        where.scheduleId === 'wallet'
          ? Array.from({ length: 5 }, () => ({ status: 'failed', error: 'No Corporation Manager', completedAt: new Date() }))
          : [{ status: 'completed', error: null, completedAt: new Date() }]
      )
    )

    const health = await getSchedulerHealth()

    expect(health.status).toBe('healthy')
    expect(health.failingSchedules).toEqual([
      expect.objectContaining({ scheduleId: 'wallet', consecutiveFailures: 5, lastError: 'No Corporation Manager' }),
    ])
  })
})
