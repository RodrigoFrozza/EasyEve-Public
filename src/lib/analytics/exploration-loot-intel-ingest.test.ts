import { collectExplorationLootEvents } from './exploration-loot-intel-ingest'

describe('collectExplorationLootEvents', () => {
  const fallback = new Date('2026-06-01T12:00:00Z')

  it('includes manual site logs with items', () => {
    const events = collectExplorationLootEvents(
      {
        logs: [
          {
            type: 'site',
            date: '2026-06-01T10:00:00Z',
            value: 5000,
            items: [{ name: 'Intact Armor Plates', quantity: 2, total: 5000, typeId: 34 }],
          },
        ],
      },
      fallback
    )

    expect(events).toHaveLength(1)
    expect(events[0].eventValue).toBe(5000)
    expect(events[0].occurredAt.toISOString()).toBe('2026-06-01T10:00:00.000Z')
    expect(events[0].items[0].itemName).toBe('Intact Armor Plates')
  })

  it('prefers logs over legacy lootContents to avoid double-counting', () => {
    const events = collectExplorationLootEvents(
      {
        lootContents: [{ name: 'Legacy Item', quantity: 1, value: 9999, typeId: 1 }],
        logs: [
          {
            type: 'loot',
            date: '2026-06-01T11:00:00Z',
            amount: 100,
            items: [{ name: 'Auto Item', quantity: 1, total: 100, typeId: 2 }],
          },
        ],
      },
      fallback
    )

    expect(events).toHaveLength(1)
    expect(events[0].items[0].itemName).toBe('Auto Item')
  })

  it('falls back to lootContents when no income logs exist', () => {
    const events = collectExplorationLootEvents(
      {
        lootContents: [{ name: 'Legacy Item', quantity: 1, value: 250, typeId: 3 }],
      },
      fallback
    )

    expect(events).toHaveLength(1)
    expect(events[0].eventValue).toBe(250)
    expect(events[0].occurredAt).toEqual(fallback)
  })
})
