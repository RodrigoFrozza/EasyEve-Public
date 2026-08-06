import { buildExplorationSyncDataPatch } from './exploration-sync'
import { getLastActivityInstantForAudit, isStaleForAutoPause } from './activity-automation-policy'

describe('buildExplorationSyncDataPatch', () => {
  it('updates lastDataAt when location changes', () => {
    const lastProgress = '2024-01-01T10:00:00Z'
    const syncAt = '2024-01-01T12:00:00Z'
    const activityData = {
      lastDataAt: lastProgress,
      lastSyncAt: '2024-01-01T11:00:00Z',
      currentSystem: 'Jita',
      logs: [{ type: 'site', date: lastProgress, value: 1000 }],
    }

    const patch = buildExplorationSyncDataPatch(activityData, syncAt, { location: 'Amarr' })

    expect(patch.lastSyncAt).toBe(syncAt)
    expect(patch.lastDataAt).toBe(syncAt)
    expect(patch.lastSyncLocation).toBe('Amarr')
    expect(patch.currentSystem).toBe('Amarr')
  })

  it('keeps lastDataAt when location is unchanged', () => {
    const lastProgress = '2024-01-01T10:00:00Z'
    const syncAt = '2024-01-01T12:00:00Z'
    const activityData = {
      lastDataAt: lastProgress,
      lastSyncAt: '2024-01-01T11:00:00Z',
      currentSystem: 'Jita',
      logs: [{ type: 'site', date: lastProgress, value: 1000 }],
    }

    const patch = buildExplorationSyncDataPatch(activityData, syncAt, { location: 'Jita' })

    expect(patch.lastSyncAt).toBe(syncAt)
    expect(patch.lastDataAt).toBe(lastProgress)
    expect(patch.currentSystem).toBe('Jita')
  })

  it('bumps lastDataAt from newer income logs when location is unchanged', () => {
    const lastProgress = '2024-01-01T10:00:00Z'
    const newerLog = '2024-01-01T11:30:00Z'
    const syncAt = '2024-01-01T12:00:00Z'
    const activityData = {
      lastDataAt: lastProgress,
      lastSyncAt: '2024-01-01T11:00:00Z',
      currentSystem: 'Jita',
      logs: [{ type: 'site', date: newerLog, value: 1000 }],
    }

    const patch = buildExplorationSyncDataPatch(activityData, syncAt, { location: 'Jita' })

    expect(patch.lastDataAt).toBe(new Date(newerLog).toISOString())
  })

  it('updates lastDataAt on system change so background sync counts as progress', () => {
    const startTime = new Date('2024-01-01T10:00:00Z')
    const lastProgress = '2024-01-01T10:30:00Z'
    const syncAt = '2024-01-01T12:00:00Z'
    const nowMs = Date.parse('2024-01-01T12:45:00Z')

    const data = buildExplorationSyncDataPatch(
      { lastDataAt: lastProgress, currentSystem: 'Jita', logs: [{ type: 'site', date: lastProgress, value: 500 }] },
      syncAt,
      { location: 'Amarr' }
    )

    expect(
      isStaleForAutoPause({ startTime, data, updatedAt: new Date(syncAt) }, nowMs)
    ).toBe(false)

    expect(
      getLastActivityInstantForAudit({ startTime, data, updatedAt: new Date(syncAt) }).getTime()
    ).toBe(Date.parse(syncAt))
  })
})
