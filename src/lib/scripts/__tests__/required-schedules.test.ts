const mockPrisma = {
  scriptSchedule: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
}

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

jest.mock('@/lib/server-logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

describe('ensureRequiredSchedulesExist', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates schedules only for scriptIds with no existing row', async () => {
    const { ensureRequiredSchedulesExist } = await import('../required-schedules')
    mockPrisma.scriptSchedule.findMany.mockResolvedValue([
      { scriptId: 'auto-activity-detection' },
    ])
    mockPrisma.scriptSchedule.create.mockResolvedValue({})

    const result = await ensureRequiredSchedulesExist()

    const expectedCreated = [
      'unified-activity-sync',
      'audit-activity-safety',
      'pi-planet-alerts',
      'snapshot-monitored-markets',
    ].sort()
    expect(result.created.sort()).toEqual(expectedCreated)
    expect(mockPrisma.scriptSchedule.create).toHaveBeenCalledTimes(expectedCreated.length)
    const createdScriptIds = mockPrisma.scriptSchedule.create.mock.calls.map(
      (call) => call[0].data.scriptId
    )
    expect(createdScriptIds.sort()).toEqual(expectedCreated)
  })

  it('does nothing when all required schedules already exist', async () => {
    const { ensureRequiredSchedulesExist, REQUIRED_SCHEDULE_SCRIPT_IDS } = await import(
      '../required-schedules'
    )
    mockPrisma.scriptSchedule.findMany.mockResolvedValue(
      REQUIRED_SCHEDULE_SCRIPT_IDS.map((scriptId) => ({ scriptId }))
    )

    const result = await ensureRequiredSchedulesExist()

    expect(result.created).toEqual([])
    expect(mockPrisma.scriptSchedule.create).not.toHaveBeenCalled()
  })

  it('does not recreate a schedule the user already deactivated', async () => {
    const { ensureRequiredSchedulesExist, REQUIRED_SCHEDULE_SCRIPT_IDS } = await import(
      '../required-schedules'
    )
    mockPrisma.scriptSchedule.findMany.mockResolvedValue(
      REQUIRED_SCHEDULE_SCRIPT_IDS.map((scriptId) => ({ scriptId, active: false }))
    )

    const result = await ensureRequiredSchedulesExist()

    expect(result.created).toEqual([])
    expect(mockPrisma.scriptSchedule.create).not.toHaveBeenCalled()
  })
})
