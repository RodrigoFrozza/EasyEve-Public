import {
  ACTIVITY_STALE_PAUSE_THRESHOLD_MS,
  getLastActivityInstantForAudit,
  isStaleForAutoPause,
  shouldRunBackgroundSync,
} from './activity-automation-policy'
import type { Activity } from '@prisma/client'

describe('activity-automation-policy', () => {
  describe('getLastActivityInstantForAudit', () => {
    it('prefers lastSyncAt when present', () => {
      const t = new Date('2024-01-01T12:00:00Z')
      const instant = getLastActivityInstantForAudit({
        data: { lastSyncAt: t.toISOString() },
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      })
      expect(instant.toISOString()).toBe(t.toISOString())
    })

    it('falls back to updatedAt when lastSyncAt missing', () => {
      const u = new Date('2024-01-02T00:00:00Z')
      const instant = getLastActivityInstantForAudit({
        data: {},
        updatedAt: u,
      })
      expect(instant.getTime()).toBe(u.getTime())
    })
  })

  describe('isStaleForAutoPause', () => {
    it('returns false when within 90 minutes of last activity', () => {
      const now = Date.parse('2024-01-01T13:00:00Z')
      const last = new Date('2024-01-01T12:30:00Z')
      expect(
        isStaleForAutoPause({ data: { lastSyncAt: last.toISOString() }, updatedAt: new Date() }, now)
      ).toBe(false)
    })

    it('returns true when more than 90 minutes since last activity', () => {
      const now = Date.parse('2024-01-01T14:00:00Z')
      const last = new Date('2024-01-01T12:00:00Z')
      expect(
        isStaleForAutoPause({ data: { lastSyncAt: last.toISOString() }, updatedAt: new Date() }, now)
      ).toBe(true)
    })

    it('uses threshold constant of 90 minutes', () => {
      expect(ACTIVITY_STALE_PAUSE_THRESHOLD_MS).toBe(90 * 60 * 1000)
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
})
