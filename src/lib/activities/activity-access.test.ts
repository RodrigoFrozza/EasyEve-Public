import { canSelectActivityType } from '@/lib/activities/activity-access'

describe('canSelectActivityType', () => {
  it('allows activity when module is globally active', () => {
    expect(canSelectActivityType(true)).toBe(true)
  })

  it('blocks activity when module is globally inactive', () => {
    expect(canSelectActivityType(false)).toBe(false)
  })
})
