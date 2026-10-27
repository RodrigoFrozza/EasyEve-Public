import { mergeRattingLogs } from './ratting-logs-merge'

describe('mergeRattingLogs', () => {
  it('preserves server-only logs by refId', () => {
    const serverLogs = [
      { refId: 'esi-1', type: 'bounty', amount: 1000, date: '2025-01-01T00:00:00Z', charId: 1 },
      { refId: 'esi-2', type: 'ess', amount: 500, date: '2025-01-01T00:05:00Z', charId: 1 },
    ]
    const clientLogs = [
      { refId: 'manual-mtu-1', type: 'mtu', amount: 200, date: '2025-01-01T00:10:00Z', charId: 1 },
    ]

    const merged = mergeRattingLogs(serverLogs, clientLogs)
    expect(merged).toHaveLength(3)
    expect(merged.map((log) => log.refId)).toEqual(['esi-1', 'esi-2', 'manual-mtu-1'])
  })

  it('client log with same refId replaces server log', () => {
    const serverLogs = [
      { refId: 'esi-1', type: 'bounty', amount: 1000, date: '2025-01-01T00:00:00Z', charId: 1 },
    ]
    const clientLogs = [
      { refId: 'esi-1', type: 'bounty', amount: 1200, date: '2025-01-01T00:00:00Z', charId: 1 },
    ]

    const merged = mergeRattingLogs(serverLogs, clientLogs)
    expect(merged).toHaveLength(1)
    expect(merged[0].amount).toBe(1200)
  })

  it('does not resurrect a log explicitly deleted by the client', () => {
    const serverLogs = [
      { refId: 'esi-1', type: 'bounty', amount: 1000, date: '2025-01-01T00:00:00Z', charId: 1 },
      { refId: 'manual-loot-1', type: 'loot', amount: 300, date: '2025-01-01T00:10:00Z', charId: 1 },
    ]
    const clientLogs = [
      { refId: 'esi-1', type: 'bounty', amount: 1000, date: '2025-01-01T00:00:00Z', charId: 1 },
    ]

    const merged = mergeRattingLogs(serverLogs, clientLogs, ['manual-loot-1'])
    expect(merged).toHaveLength(1)
    expect(merged.map((log) => log.refId)).toEqual(['esi-1'])
  })

  it('still preserves unrelated server-only logs when a different refId is deleted', () => {
    const serverLogs = [
      { refId: 'esi-1', type: 'bounty', amount: 1000, date: '2025-01-01T00:00:00Z', charId: 1 },
      { refId: 'manual-loot-1', type: 'loot', amount: 300, date: '2025-01-01T00:10:00Z', charId: 1 },
    ]
    const clientLogs: typeof serverLogs = []

    const merged = mergeRattingLogs(serverLogs, clientLogs, ['manual-loot-1'])
    expect(merged).toHaveLength(1)
    expect(merged.map((log) => log.refId)).toEqual(['esi-1'])
  })
})
