import { validateLaunchActivityInput } from '@/lib/activities/activity-launch'

describe('validateLaunchActivityInput', () => {
  it('accepts valid mining payload', () => {
    const result = validateLaunchActivityInput({
      type: 'mining',
      participants: [{ characterId: 1 }],
      space: 'Nullsec',
      data: { miningType: 'ORE' },
    })
    expect(result.isValid).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('rejects ratting without faction in normal space', () => {
    const result = validateLaunchActivityInput({
      type: 'ratting',
      participants: [{ characterId: 7 }],
      space: 'Nullsec',
      data: { siteName: 'Horde Rally Point' },
    })
    expect(result.isValid).toBe(false)
    expect(result.issues[0]).toMatch(/Hostile faction/i)
  })

  it('requires region for exploration', () => {
    const result = validateLaunchActivityInput({
      type: 'exploration',
      participants: [{ characterId: 9 }],
      data: {},
    })
    expect(result.isValid).toBe(false)
    expect(result.issues.join(' | ')).toMatch(/Region is required/i)
    // Removed requirement for Initial cargo state as per user request
  })

  it('requires cargo state for abyssal', () => {
    const result = validateLaunchActivityInput({
      type: 'abyssal',
      participants: [{ characterId: 11 }],
      data: {},
    })
    expect(result.isValid).toBe(false)
    expect(result.issues[0]).toMatch(/Initial cargo state/i)
  })

  it('requires NPC faction for salvaging', () => {
    const result = validateLaunchActivityInput({
      type: 'salvaging',
      participants: [{ characterId: 12 }],
      data: {},
    })
    expect(result.isValid).toBe(false)
    expect(result.issues.join(' | ')).toMatch(/NPC wreck faction/i)
  })

  it('accepts salvaging with npcFaction and optional cargo', () => {
    const result = validateLaunchActivityInput({
      type: 'salvaging',
      participants: [{ characterId: 12 }],
      data: { npcFaction: 'Angel Cartel', lastCargoState: 'Item\t1' },
    })
    expect(result.isValid).toBe(true)
  })
})
