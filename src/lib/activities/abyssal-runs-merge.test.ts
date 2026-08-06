import { mergeAbyssalRuns } from './abyssal-runs-merge'

describe('mergeAbyssalRuns', () => {
  it('preserves server-only runs missing from the client payload', () => {
    const serverRuns = [
      { id: 'server-run', status: 'completed', lootValue: 0 },
      { id: 'shared-run', status: 'completed', lootValue: 10 },
    ]
    const clientRuns = [{ id: 'shared-run', status: 'completed', lootValue: 25, registrationStatus: 'registered' }]

    expect(mergeAbyssalRuns(serverRuns, clientRuns)).toEqual([
      { id: 'server-run', status: 'completed', lootValue: 0 },
      { id: 'shared-run', status: 'completed', lootValue: 25, registrationStatus: 'registered' },
    ])
  })

  it('does not resurrect a run explicitly deleted by the client', () => {
    const serverRuns = [
      { id: 'server-run', status: 'completed', lootValue: 0 },
      { id: 'deleted-run', status: 'completed', lootValue: 10 },
    ]
    const clientRuns: typeof serverRuns = []

    expect(mergeAbyssalRuns(serverRuns, clientRuns, ['deleted-run'])).toEqual([
      { id: 'server-run', status: 'completed', lootValue: 0 },
    ])
  })
})
