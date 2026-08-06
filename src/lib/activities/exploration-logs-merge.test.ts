import { mergeExplorationLogs } from './exploration-logs-merge'

describe('mergeExplorationLogs', () => {
  it('preserves server-only logs by refId', () => {
    const serverLogs = [
      { refId: 'site-server-1', type: 'site', value: 100 },
      { refId: 'loot-auto-1', type: 'loot', amount: 50 },
    ]
    const clientLogs = [{ refId: 'site-client-1', type: 'site', value: 200 }]

    expect(mergeExplorationLogs(serverLogs, clientLogs)).toEqual([
      { refId: 'site-server-1', type: 'site', value: 100 },
      { refId: 'loot-auto-1', type: 'loot', amount: 50 },
      { refId: 'site-client-1', type: 'site', value: 200 },
    ])
  })

  it('does not resurrect a log explicitly deleted by the client', () => {
    const serverLogs = [
      { refId: 'site-server-1', type: 'site', value: 100 },
      { refId: 'loot-auto-1', type: 'loot', amount: 50 },
    ]
    const clientLogs: typeof serverLogs = []

    expect(mergeExplorationLogs(serverLogs, clientLogs, ['loot-auto-1'])).toEqual([
      { refId: 'site-server-1', type: 'site', value: 100 },
    ])
  })
})
