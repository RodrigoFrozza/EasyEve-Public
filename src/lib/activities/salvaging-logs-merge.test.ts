import { mergeSalvagingLogs } from './salvaging-logs-merge'

describe('mergeSalvagingLogs', () => {
  it('preserves server-only logs by refId', () => {
    const serverLogs = [
      { refId: 'salvage-server-1', type: 'salvage', value: 100 },
      { refId: 'loot-auto-1', type: 'loot-auto', value: 50 },
    ]
    const clientLogs = [{ refId: 'salvage-client-1', type: 'salvage', value: 200 }]

    expect(mergeSalvagingLogs(serverLogs, clientLogs)).toEqual([
      { refId: 'salvage-server-1', type: 'salvage', value: 100 },
      { refId: 'loot-auto-1', type: 'loot-auto', value: 50 },
      { refId: 'salvage-client-1', type: 'salvage', value: 200 },
    ])
  })

  it('does not resurrect a log explicitly deleted by the client', () => {
    const serverLogs = [
      { refId: 'salvage-server-1', type: 'salvage', value: 100 },
      { refId: 'loot-auto-1', type: 'loot-auto', value: 50 },
    ]
    const clientLogs: typeof serverLogs = []

    expect(mergeSalvagingLogs(serverLogs, clientLogs, ['loot-auto-1'])).toEqual([
      { refId: 'salvage-server-1', type: 'salvage', value: 100 },
    ])
  })
})
