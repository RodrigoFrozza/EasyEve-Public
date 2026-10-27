import {
  ACTIVITY_STALE_PAUSE_THRESHOLD_MS,
  backfillProgressTimestamps,
  getLastActivityInstantForAudit,
  isSafeAutoPauseInstant,
  isStaleForAutoPause,
  resolveStalePauseInstant,
  shouldRunBackgroundSync,
} from './activity-automation-policy'
import type { Activity } from '@prisma/client'

describe('activity-automation-policy', () => {
  const startTime = new Date('2024-01-01T10:00:00Z')

  describe('getLastActivityInstantForAudit', () => {
    it('prefers lastDataAt over startTime', () => {
      const lastDataAt = new Date('2024-01-01T12:00:00Z')
      const instant = getLastActivityInstantForAudit({
        startTime,
        data: { lastDataAt: lastDataAt.toISOString() },
        updatedAt: new Date('2024-01-01T14:00:00Z'),
      })
      expect(instant.toISOString()).toBe(lastDataAt.toISOString())
    })

    it('falls back to lastSyncWithChangesAt when lastDataAt is missing', () => {
      const changesAt = new Date('2024-01-01T11:30:00Z')
      const instant = getLastActivityInstantForAudit({
        startTime,
        data: { lastSyncWithChangesAt: changesAt.toISOString() },
        updatedAt: new Date('2024-01-01T14:00:00Z'),
      })
      expect(instant.toISOString()).toBe(changesAt.toISOString())
    })

    it('uses the newer of lastDataAt and lastSyncWithChangesAt', () => {
      const lastDataAt = new Date('2024-01-01T12:00:00Z')
      const changesAt = new Date('2024-01-01T11:00:00Z')
      const instant = getLastActivityInstantForAudit({
        startTime,
        data: {
          lastDataAt: lastDataAt.toISOString(),
          lastSyncWithChangesAt: changesAt.toISOString(),
        },
        updatedAt: new Date(),
      })
      expect(instant.toISOString()).toBe(lastDataAt.toISOString())
    })

    it('ignores lastSyncAt and updatedAt without progress timestamps', () => {
      const instant = getLastActivityInstantForAudit({
        startTime,
        data: { lastSyncAt: '2024-01-01T13:00:00Z' },
        updatedAt: new Date('2024-01-01T14:00:00Z'),
      })
      expect(instant.toISOString()).toBe(startTime.toISOString())
    })

    it('falls back to startTime when no progress timestamps exist', () => {
      const instant = getLastActivityInstantForAudit({
        startTime,
        data: {},
        updatedAt: new Date('2024-01-01T14:00:00Z'),
      })
      expect(instant.toISOString()).toBe(startTime.toISOString())
    })

    it('uses latest log date when lastDataAt is missing', () => {
      const logAt = new Date('2024-01-01T11:45:00Z')
      const instant = getLastActivityInstantForAudit({
        startTime,
        data: { logs: [{ date: logAt.toISOString(), type: 'salvage' }] },
        updatedAt: new Date('2024-01-01T14:00:00Z'),
      })
      expect(instant.toISOString()).toBe(logAt.toISOString())
    })
  })

  describe('isSafeAutoPauseInstant', () => {
    it('returns false when pause instant is startTime on a long session', () => {
      const nowMs = startTime.getTime() + ACTIVITY_STALE_PAUSE_THRESHOLD_MS + 60_000
      expect(isSafeAutoPauseInstant({ startTime }, startTime, nowMs)).toBe(false)
    })

    it('returns true when pause instant reflects real progress', () => {
      const pauseAt = new Date('2024-01-01T12:00:00Z')
      const nowMs = Date.parse('2024-01-01T14:00:00Z')
      expect(isSafeAutoPauseInstant({ startTime }, pauseAt, nowMs)).toBe(true)
    })
  })

  describe('isStaleForAutoPause', () => {
    it('returns false when within 60 minutes of last progress', () => {
      const now = Date.parse('2024-01-01T13:00:00Z')
      const last = new Date('2024-01-01T12:30:00Z')
      expect(
        isStaleForAutoPause(
          { startTime, data: { lastDataAt: last.toISOString() }, updatedAt: new Date() },
          now
        )
      ).toBe(false)
    })

    it('returns true when more than 60 minutes since lastDataAt', () => {
      const now = Date.parse('2024-01-01T14:00:00Z')
      const last = new Date('2024-01-01T12:00:00Z')
      expect(
        isStaleForAutoPause(
          { startTime, data: { lastDataAt: last.toISOString() }, updatedAt: last },
          now
        )
      ).toBe(true)
    })

    it('returns true when lastSyncAt is recent but progress is stale', () => {
      const now = Date.parse('2024-01-01T14:00:00Z')
      const lastSyncAt = new Date('2024-01-01T13:45:00Z')
      expect(
        isStaleForAutoPause(
          {
            startTime,
            data: { lastDataAt: startTime.toISOString(), lastSyncAt: lastSyncAt.toISOString() },
            updatedAt: lastSyncAt,
          },
          now
        )
      ).toBe(true)
    })

    it('returns true when both progress and lastSyncAt are older than 60 minutes', () => {
      const now = Date.parse('2024-01-01T14:00:00Z')
      const last = new Date('2024-01-01T12:00:00Z')
      expect(
        isStaleForAutoPause(
          {
            startTime,
            data: { lastDataAt: last.toISOString(), lastSyncAt: last.toISOString() },
            updatedAt: last,
          },
          now
        )
      ).toBe(true)
    })

    it('uses threshold constant of 60 minutes', () => {
      expect(ACTIVITY_STALE_PAUSE_THRESHOLD_MS).toBe(60 * 60 * 1000)
    })
  })

  describe('resolveStalePauseInstant', () => {
    it('uses inactivity boundary when income exists but progress timestamps are missing', () => {
      const nowMs = startTime.getTime() + ACTIVITY_STALE_PAUSE_THRESHOLD_MS + 2 * 60 * 60 * 1000

      const instant = resolveStalePauseInstant(
        {
          startTime,
          data: { automatedBounties: 50_000_000 },
          updatedAt: new Date(nowMs),
        },
        nowMs
      )

      expect(instant).not.toBeNull()
      expect(instant!.getTime()).toBeGreaterThan(startTime.getTime() + 60_000)
      expect(isSafeAutoPauseInstant({ startTime }, instant!, nowMs)).toBe(true)
    })
  })

  describe('shouldRunBackgroundSync', () => {
    const base = {
      id: 'x',
      userId: 'u',
      type: 'ratting',
      status: 'active',
      startTime: new Date(),
      participants: [],
      isPaused: false,
      isDeleted: false,
      accumulatedPausedTime: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Activity

    it('allows first sync when lastSyncAt missing', () => {
      expect(shouldRunBackgroundSync({ ...base, data: {} } as Activity, Date.now(), 120_000)).toBe(true)
    })

    it('blocks when lastSyncAt within min interval', () => {
      const last = new Date(Date.now() - 60_000).toISOString()
      expect(shouldRunBackgroundSync({ ...base, data: { lastSyncAt: last } } as Activity, Date.now(), 120_000)).toBe(
        false
      )
    })

    it('allows when lastSyncAt older than min interval', () => {
      const last = new Date(Date.now() - 200_000).toISOString()
      expect(shouldRunBackgroundSync({ ...base, data: { lastSyncAt: last } } as Activity, Date.now(), 120_000)).toBe(
        true
      )
    })
  })

  describe('backfillProgressTimestamps', () => {
    it('backfills lastDataAt from the newest log date', () => {
      const logAt = '2024-01-01T11:45:00Z'
      const patched = backfillProgressTimestamps({
        startTime,
        updatedAt: new Date('2024-01-01T14:00:00Z'),
        data: { logs: [{ date: logAt, type: 'bounty', amount: 1_000_000 }] },
      })
      expect(patched?.lastDataAt).toBe(new Date(logAt).toISOString())
    })

    it('falls back to updatedAt when logs are missing but gross fields exist', () => {
      const updatedAt = new Date('2024-01-01T12:30:00Z')
      const patched = backfillProgressTimestamps(
        {
          startTime,
          updatedAt,
          data: { automatedBounties: 5_000_000 },
        },
        { allowUpdatedAtFallback: true }
      )
      expect(patched?.lastDataAt).toBe(updatedAt.toISOString())
    })

    it('returns null when lastDataAt already exists', () => {
      const patched = backfillProgressTimestamps({
        startTime,
        updatedAt: new Date(),
        data: { lastDataAt: '2024-01-01T12:00:00Z' },
      })
      expect(patched).toBeNull()
    })
  })
})
