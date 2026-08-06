import {
  discardZeroValueActivity,
  getActivityGrossIncome,
  isRattingTooYoungToDiscard,
  isZeroGrossActivity,
  RATTING_COMPLETION_MIN_AGE_MS,
} from './activity-completion-policy'

describe('activity-completion-policy', () => {
  describe('getActivityGrossIncome', () => {
    it('returns 0 for empty exploration session', () => {
      expect(
        getActivityGrossIncome({ type: 'exploration', data: { totalLootValue: 0, logs: [] } })
      ).toBe(0)
    })

    it('returns totalLootValue for exploration with loot', () => {
      expect(
        getActivityGrossIncome({ type: 'exploration', data: { totalLootValue: 1_200_000 } })
      ).toBe(1_200_000)
    })

    it('returns mining value for mining sessions', () => {
      expect(
        getActivityGrossIncome({ type: 'mining', data: { miningValue: 4_500_000 } })
      ).toBe(4_500_000)
    })

    it('returns bounty + loot for ratting sessions', () => {
      expect(
        getActivityGrossIncome({
          type: 'ratting',
          data: { automatedBounties: 800_000, estimatedLootValue: 200_000 },
        })
      ).toBe(1_000_000)
    })

    it('derives exploration gross from site log value when totalLootValue missing', () => {
      expect(
        getActivityGrossIncome({
          type: 'exploration',
          data: {
            logs: [{ type: 'site', value: 750_000, date: '2024-01-01T12:00:00Z' }],
          },
        })
      ).toBe(750_000)
    })
  })

  describe('isZeroGrossActivity', () => {
    it('returns true when gross is 0', () => {
      expect(isZeroGrossActivity({ type: 'salvaging', data: { totalLootValue: 0 } })).toBe(true)
    })

    it('returns false when gross is positive', () => {
      expect(isZeroGrossActivity({ type: 'abyssal', data: { totalLootValue: 50_000 } })).toBe(false)
    })

    it('returns false for abyssal sessions with pending runs even when gross is zero', () => {
      expect(
        isZeroGrossActivity({
          type: 'abyssal',
          data: {
            totalLootValue: 0,
            runs: [
              {
                id: 'run-1',
                status: 'completed',
                registrationStatus: 'pending',
                lootValue: 0,
              },
            ],
          },
        })
      ).toBe(false)
    })

    it('skips zero-gross discard for ratting sessions younger than 15 minutes', () => {
      const startTime = new Date('2026-06-12T12:00:00Z')
      const nowMs = startTime.getTime() + RATTING_COMPLETION_MIN_AGE_MS - 60_000
      expect(
        isRattingTooYoungToDiscard({ type: 'ratting', startTime }, nowMs)
      ).toBe(true)
      expect(
        isRattingTooYoungToDiscard(
          { type: 'ratting', startTime },
          startTime.getTime() + RATTING_COMPLETION_MIN_AGE_MS + 1
        )
      ).toBe(false)
    })

    it('returns true for abyssal sessions with only an active run and zero gross', () => {
      expect(
        isZeroGrossActivity({
          type: 'abyssal',
          data: {
            totalLootValue: 0,
            runs: [{ id: 'run-1', status: 'active', lootValue: 0 }],
          },
        })
      ).toBe(true)
    })
  })

  describe('discardZeroValueActivity', () => {
    it('soft-deletes the activity and marks the discard reason instead of hard-deleting it', async () => {
      const findUnique = jest.fn().mockResolvedValue({ id: 'act-1', endTime: null, data: { foo: 'bar' } })
      const update = jest.fn().mockResolvedValue({})
      const db = { activity: { findUnique, update } } as any

      const result = await discardZeroValueActivity(db, 'act-1')

      expect(result).toBe(true)
      expect(update).toHaveBeenCalledWith({
        where: { id: 'act-1' },
        data: expect.objectContaining({
          isDeleted: true,
          status: 'completed',
          data: expect.objectContaining({ foo: 'bar', discardReason: 'zero_gross_auto' }),
        }),
      })
    })

    it('returns false without updating when the activity no longer exists', async () => {
      const findUnique = jest.fn().mockResolvedValue(null)
      const update = jest.fn()
      const db = { activity: { findUnique, update } } as any

      const result = await discardZeroValueActivity(db, 'missing')

      expect(result).toBe(false)
      expect(update).not.toHaveBeenCalled()
    })
  })
})
