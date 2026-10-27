const mockPrisma = {
  scriptExecution: { findMany: jest.fn() },
  scriptSchedule: { findUnique: jest.fn() },
  user: { findMany: jest.fn() },
  notification: { findMany: jest.fn(), createMany: jest.fn() },
}

jest.mock('@/lib/prisma', () => ({
  get prisma() {
    return mockPrisma
  },
}))

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
jest.mock('@/lib/server-logger', () => ({
  get logger() {
    return mockLogger
  },
}))

import {
  FAILURE_ALERT_THRESHOLD,
  SCHEDULES_ADMIN_PATH,
  alertOnRepeatedFailure,
  getFailingSchedules,
  getFailureStreak,
} from '../failure-alerts'

const failed = (error = 'boom') => ({ status: 'failed', error, completedAt: new Date('2026-10-26T15:00:00Z') })
const completed = () => ({ status: 'completed', error: null, completedAt: new Date('2026-10-26T14:00:00Z') })

describe('failure-alerts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma.scriptSchedule.findUnique.mockResolvedValue({
      id: 's1',
      name: 'Sync Corp Wallet Journal',
      scriptId: 'sync-wallet-journal',
    })
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'master-1' }])
    mockPrisma.notification.findMany.mockResolvedValue([])
  })

  describe('getFailureStreak', () => {
    it('counts failures from the newest run until the first success', async () => {
      mockPrisma.scriptExecution.findMany.mockResolvedValue([failed('latest'), failed(), completed(), failed()])
      await expect(getFailureStreak('s1')).resolves.toMatchObject({ consecutiveFailures: 2, lastError: 'latest' })
    })

    it('is zero when the newest run succeeded', async () => {
      mockPrisma.scriptExecution.findMany.mockResolvedValue([completed(), failed()])
      await expect(getFailureStreak('s1')).resolves.toEqual({
        consecutiveFailures: 0,
        streakCapped: false,
        lastError: null,
        lastFailedAt: null,
      })
    })

    it('ignores runs that have not finished', async () => {
      mockPrisma.scriptExecution.findMany.mockResolvedValue([])
      await getFailureStreak('s1')
      expect(mockPrisma.scriptExecution.findMany.mock.calls[0][0].where.status).toEqual({
        in: ['completed', 'failed'],
      })
    })
  })

  describe('getFailingSchedules', () => {
    it('lists only schedules at or above the threshold', async () => {
      mockPrisma.scriptExecution.findMany.mockImplementation(({ where }: { where: { scheduleId: string } }) =>
        Promise.resolve(
          where.scheduleId === 'bad'
            ? Array.from({ length: FAILURE_ALERT_THRESHOLD }, () => failed('INT4 overflow'))
            : [failed(), completed()]
        )
      )
      const result = await getFailingSchedules([
        { id: 'bad', scriptId: 'pi-planet-alerts', name: 'PI alerts' },
        { id: 'flaky', scriptId: 'health-check', name: 'Health' },
      ])
      expect(result).toEqual([
        expect.objectContaining({
          scheduleId: 'bad',
          scriptId: 'pi-planet-alerts',
          consecutiveFailures: FAILURE_ALERT_THRESHOLD,
          lastError: 'INT4 overflow',
        }),
      ])
    })
  })

  describe('alertOnRepeatedFailure', () => {
    it('does nothing below the threshold', async () => {
      mockPrisma.scriptExecution.findMany.mockResolvedValue([failed(), completed()])
      await alertOnRepeatedFailure('s1')
      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled()
    })

    it('notifies every master with the error and a link to the schedules screen', async () => {
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'master-1' }, { id: 'master-2' }])
      mockPrisma.scriptExecution.findMany.mockResolvedValue(
        Array.from({ length: 24 }, () => failed('No Corporation Manager character found'))
      )

      await alertOnRepeatedFailure('s1')

      const { data } = mockPrisma.notification.createMany.mock.calls[0][0]
      expect(data).toHaveLength(2)
      expect(data[0]).toMatchObject({
        userId: 'master-1',
        type: 'system',
        title: 'Script agendado falhando: Sync Corp Wallet Journal',
        link: SCHEDULES_ADMIN_PATH,
      })
      expect(data[0].content).toContain('últimas 24 execuções')
      expect(data[0].content).toContain('No Corporation Manager character found')
    })

    it('fires for a schedule that was already failing before deploy (streak above threshold)', async () => {
      mockPrisma.scriptExecution.findMany.mockResolvedValue(Array.from({ length: 50 }, () => failed()))
      await alertOnRepeatedFailure('s1')
      expect(mockPrisma.notification.createMany).toHaveBeenCalledTimes(1)
      // The lookback was exhausted, so the count must not read as exact.
      expect(mockPrisma.notification.createMany.mock.calls[0][0].data[0].content).toContain('últimas 50+ execuções')
    })

    it('reminds at most once per 24h per master', async () => {
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'master-1' }, { id: 'master-2' }])
      mockPrisma.scriptExecution.findMany.mockResolvedValue(Array.from({ length: 5 }, () => failed()))
      mockPrisma.notification.findMany.mockResolvedValue([{ userId: 'master-1' }])

      await alertOnRepeatedFailure('s1')

      const { data } = mockPrisma.notification.createMany.mock.calls[0][0]
      expect(data.map((n: { userId: string }) => n.userId)).toEqual(['master-2'])
      const since: Date = mockPrisma.notification.findMany.mock.calls[0][0].where.createdAt.gte
      expect(Date.now() - since.getTime()).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 1000)
    })

    it('skips the write when every master was already reminded', async () => {
      mockPrisma.scriptExecution.findMany.mockResolvedValue(Array.from({ length: 5 }, () => failed()))
      mockPrisma.notification.findMany.mockResolvedValue([{ userId: 'master-1' }])
      await alertOnRepeatedFailure('s1')
      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled()
    })

    it('logs loudly when there is no master to notify', async () => {
      mockPrisma.user.findMany.mockResolvedValue([])
      mockPrisma.scriptExecution.findMany.mockResolvedValue(Array.from({ length: 5 }, () => failed()))
      await alertOnRepeatedFailure('s1')
      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled()
    })

    it('never throws, so the original failure is still recorded', async () => {
      mockPrisma.scriptSchedule.findUnique.mockRejectedValue(new Error('db down'))
      await expect(alertOnRepeatedFailure('s1')).resolves.toBeUndefined()
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })
})
