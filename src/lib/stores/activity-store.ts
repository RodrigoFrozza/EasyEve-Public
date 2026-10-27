'use client'

import { create } from 'zustand'
import { apiClient } from '@/lib/api-error'
import type { LaunchActivityType } from '@/lib/activities/activity-launch'
import { MINING_POST_COMPLETE_SYNC_MINUTES } from '@/lib/constants/mining'
import { RATTING_POST_COMPLETE_SYNC_MINUTES } from '@/lib/constants/ratting'

const NEW_ACTIVITY_GRACE_MS = 30_000 // 30s grace period before auto-sync picks up a brand-new activity

// External refs to avoid triggering re-renders on every update
let pollingIntervalRef: NodeJS.Timeout | null = null
let rattingSyncIntervalRef: NodeJS.Timeout | null = null
let miningSyncIntervalRef: NodeJS.Timeout | null = null
let abyssalSyncIntervalRef: NodeJS.Timeout | null = null
let explorationSyncIntervalRef: NodeJS.Timeout | null = null
let salvagingSyncIntervalRef: NodeJS.Timeout | null = null
let escalationsSyncIntervalRef: NodeJS.Timeout | null = null
const fetchGenerationByKey: Record<string, number> = {}
let lastFetchRequestStartedAt = 0
let latestFetchRequestId = 0

export interface ActivityParticipant {
  characterId: number
  characterName?: string
  fit?: string
  fitName?: string
  shipTypeId?: number
}

export interface Activity {
  id: string
  type: LaunchActivityType | string
  status: 'active' | 'completed'
  startTime: string | Date
  endTime?: string | Date
  isPaused?: boolean
  pausedAt?: string | Date | null
  accumulatedPausedTime?: number // in ms
  typeId?: number
  region?: string
  space?: string
  data?: Record<string, any>
  participants: ActivityParticipant[]
  updatedAt?: string | Date
}

interface ActivityStore {
  activities: Activity[]
  serverClockOffset: number
  isLoading: boolean
  lastError: string | null
  lastFetchAt: string | null
  lastSyncAt: string | null
  pagination: { total: number; activeCount: number; page: number; limit: number; totalPages: number }
  /** characterIds busy in ANY active activity, regardless of type — `activities` is
   *  filtered by the currently-viewed type, so it can't answer that on its own. */
  busyCharacterIdsGlobal: number[]
  fetchBusyCharacterIdsGlobal: () => Promise<void>

  // Getters for external refs (for backward compatibility)
  getPollingInterval: () => NodeJS.Timeout | null
  getRattingSyncInterval: () => NodeJS.Timeout | null
  getMiningSyncInterval: () => NodeJS.Timeout | null
  getAbyssalSyncInterval: () => NodeJS.Timeout | null
  getExplorationSyncInterval: () => NodeJS.Timeout | null
  getSalvagingSyncInterval: () => NodeJS.Timeout | null
  getEscalationsSyncInterval: () => NodeJS.Timeout | null
  
  setActivities: (activities: Activity[]) => void
  addActivity: (activity: Activity) => void
  updateActivity: (id: string, updates: Partial<Activity>) => void
  removeActivity: (id: string) => void
  
  getActiveCharacterIds: () => number[]
  isCharacterBusy: (characterId: number) => boolean
  
  fetchFromAPI: (type?: string, page?: number, limit?: number, isBackground?: boolean) => Promise<void>
  syncActivity: (id: string, type?: string) => Promise<Activity | null>
  
  startPolling: (type?: string, interval?: number, limit?: number) => void
  startRattingAutoSync: (interval?: number) => void
  startMiningAutoSync: (interval?: number) => void
  startAbyssalAutoSync: (interval?: number) => void
  startExplorationAutoSync: (interval?: number) => void
  startSalvagingAutoSync: (interval?: number) => void
  startEscalationsAutoSync: (interval?: number) => void
  stopPolling: () => void
  stopRattingAutoSync: () => void
  stopMiningAutoSync: () => void
  stopAbyssalAutoSync: () => void
  stopExplorationAutoSync: () => void
  stopSalvagingAutoSync: () => void
  stopEscalationsAutoSync: () => void
}

export const useActivityStore = create<ActivityStore>((set, get) => ({
  activities: [],
  serverClockOffset: 0,
  isLoading: false,
  lastError: null,
  lastFetchAt: null,
  lastSyncAt: null,
  pagination: {
    total: 0,
    activeCount: 0,
    page: 1,
    limit: 10,
    totalPages: 0
  },
  busyCharacterIdsGlobal: [],

  fetchBusyCharacterIdsGlobal: async () => {
    const { data, error } = await apiClient.get<{ characterIds: number[] }>(
      '/api/activities/busy-characters',
      { showToast: false }
    )
    if (error || !data) return
    set({ busyCharacterIdsGlobal: data.characterIds })
  },

  setActivities: (activities) => {
    set({ activities })
  },

  addActivity: (activity) => set((state) => ({
    activities: [...state.activities, activity]
  })),

  updateActivity: (id, updates) => set((state) => ({
    activities: state.activities.map((a) => a.id === id ? { ...a, ...updates } : a)
  })),

  removeActivity: (id) => set((state) => ({
    activities: state.activities.filter((a) => a.id !== id)
  })),

  getActiveCharacterIds: () => {
    const state = get()
    const ids = state.activities
      .filter((a) => a.status === 'active')
      .flatMap((a) => a.participants.map((p) => p.characterId))
    
    return Array.from(new Set(ids))
  },

  isCharacterBusy: (characterId) => {
    const state = get()
    return (
      state.getActiveCharacterIds().includes(characterId) ||
      state.busyCharacterIdsGlobal.includes(characterId)
    )
  },

  fetchFromAPI: async (type?: string, page: number = 1, limit?: number, isBackground = false) => {
    const resolvedLimit = limit ?? get().pagination.limit ?? 10
    const fetchKey = `${type ?? 'all'}:${page}:${resolvedLimit}`

    // Guard against rapid repeated fetches from multiple UI triggers.
    if (Date.now() - lastFetchRequestStartedAt < 250) {
      return
    }
    lastFetchRequestStartedAt = Date.now()

    const generation = (fetchGenerationByKey[fetchKey] ?? 0) + 1
    fetchGenerationByKey[fetchKey] = generation
    const requestId = ++latestFetchRequestId

    if (!isBackground) {
      set({ isLoading: true, lastError: null })
    }
    const url = type
      ? `/api/activities?type=${type}&page=${page}&limit=${resolvedLimit}&light=1`
      : `/api/activities?page=${page}&limit=${resolvedLimit}&light=1`

    try {
      const { data, error } = await apiClient.get<any>(url)

      if (fetchGenerationByKey[fetchKey] !== generation) {
        return
      }

      if (error) {
        console.error('Failed to fetch from API:', error)
        set({ lastError: 'Failed to load activity data' })
        return
      }

      if (data && data.active && data.history) {
        set({
          activities: [...data.active, ...data.history],
          pagination: data.pagination,
          lastFetchAt: new Date().toISOString(),
          lastError: null,
        })
      }
    } finally {
      if (requestId === latestFetchRequestId) {
        set({ isLoading: false })
      }
    }
  },

  syncActivity: async (id: string, type?: string) => {
    let syncType = type
    if (!syncType) {
      const { activities } = get()
      syncType = activities.find(a => a.id === id)?.type
    }

    const endpoint =
      syncType === 'mining'
        ? 'sync-mining'
        : syncType === 'exploration'
          ? 'exploration/sync'
          : syncType === 'abyssal'
            ? 'abyssal/sync'
            : 'sync'
    
    const { data, error } = await apiClient.post<Activity>(`/api/activities/${endpoint}?id=${id}`, undefined, {
      showToast: false
    })
    if (error) {
      set({ lastError: `Failed to sync ${syncType || 'activity'}` })
      return null
    }
    
    if (data) {
      set((state) => ({
        activities: state.activities.map((a) => 
          a.id === id ? { ...a, ...data } : a
        ),
        lastSyncAt: new Date().toISOString(),
        lastError: null,
      }))
      return data
    }
    
    return null
  },

  startPolling: (type?: string, interval = 30000, limit?: number) => {
    const { stopPolling } = get()
    stopPolling()
    
    pollingIntervalRef = setInterval(() => {
      get().fetchFromAPI(type, get().pagination.page, limit ?? get().pagination.limit, true)
    }, interval)
  },

  stopPolling: () => {
    if (pollingIntervalRef) {
      clearInterval(pollingIntervalRef)
      pollingIntervalRef = null
    }
  },

  startRattingAutoSync: (interval = 240000) => {
    const { stopRattingAutoSync } = get()
    stopRattingAutoSync()
    
    rattingSyncIntervalRef = setInterval(
      () => runAutoSync(get, 'ratting', RATTING_POST_COMPLETE_SYNC_MINUTES),
      interval
    )
  },

  stopRattingAutoSync: () => {
    if (rattingSyncIntervalRef) {
      clearInterval(rattingSyncIntervalRef)
      rattingSyncIntervalRef = null
    }
  },

  startMiningAutoSync: (interval = 300000) => {
    const { stopMiningAutoSync } = get()
    stopMiningAutoSync()
    
    miningSyncIntervalRef = setInterval(
      () => runAutoSync(get, 'mining', MINING_POST_COMPLETE_SYNC_MINUTES),
      interval
    )
  },

  startAbyssalAutoSync: (interval = 360000) => {
    const { stopAbyssalAutoSync } = get()
    stopAbyssalAutoSync()
    abyssalSyncIntervalRef = setInterval(() => runAutoSync(get, 'abyssal', 45), interval)
  },

  stopAbyssalAutoSync: () => {
    if (abyssalSyncIntervalRef) {
      clearInterval(abyssalSyncIntervalRef)
      abyssalSyncIntervalRef = null
    }
  },

  startExplorationAutoSync: (interval = 420000) => {
    const { stopExplorationAutoSync } = get()
    stopExplorationAutoSync()
    explorationSyncIntervalRef = setInterval(() => runAutoSync(get, 'exploration', 45), interval)
  },

  stopExplorationAutoSync: () => {
    if (explorationSyncIntervalRef) {
      clearInterval(explorationSyncIntervalRef)
      explorationSyncIntervalRef = null
    }
  },

  startSalvagingAutoSync: (interval = 900000) => {
    const { stopSalvagingAutoSync } = get()
    stopSalvagingAutoSync()
    salvagingSyncIntervalRef = setInterval(() => runLootOnlyAutoSync(get, 'salvaging'), interval)
  },

  stopSalvagingAutoSync: () => {
    if (salvagingSyncIntervalRef) {
      clearInterval(salvagingSyncIntervalRef)
      salvagingSyncIntervalRef = null
    }
  },

  startEscalationsAutoSync: (interval = 240000) => {
    const { stopEscalationsAutoSync } = get()
    stopEscalationsAutoSync()

    escalationsSyncIntervalRef = setInterval(
      () => runAutoSync(get, 'escalations', RATTING_POST_COMPLETE_SYNC_MINUTES),
      interval
    )
  },

  stopEscalationsAutoSync: () => {
    if (escalationsSyncIntervalRef) {
      clearInterval(escalationsSyncIntervalRef)
      escalationsSyncIntervalRef = null
    }
  },

  stopMiningAutoSync: () => {
    if (miningSyncIntervalRef) {
      clearInterval(miningSyncIntervalRef)
      miningSyncIntervalRef = null
    }
  },

  // Getters for backward compatibility
  getPollingInterval: () => pollingIntervalRef,
  getRattingSyncInterval: () => rattingSyncIntervalRef,
  getMiningSyncInterval: () => miningSyncIntervalRef,
  getAbyssalSyncInterval: () => abyssalSyncIntervalRef,
  getExplorationSyncInterval: () => explorationSyncIntervalRef,
  getSalvagingSyncInterval: () => salvagingSyncIntervalRef,
  getEscalationsSyncInterval: () => escalationsSyncIntervalRef,
}))

const MIN_SYNC_GAP_MS_RATTING = 120_000
const MIN_SYNC_GAP_MS_MINING = 90_000
const MIN_SYNC_GAP_MS_ABYSSAL = 180_000
const MIN_SYNC_GAP_MS_EXPLORATION = 210_000
const MIN_LOOT_SYNC_GAP_MS = 900_000

async function maybeSyncContainerLoot(
  activity: Activity,
  get: () => Pick<ActivityStore, 'updateActivity'>
) {
  const data = activity.data || {}
  if (!data.autoLootTrackingEnabled || !data.autoLootCharacterId || !data.autoLootContainerId) {
    return
  }

  const lastLootSync = data.lastLootSyncAt ? new Date(data.lastLootSyncAt).getTime() : 0
  if (Date.now() - lastLootSync < MIN_LOOT_SYNC_GAP_MS) {
    return
  }

  const { data: lootResult, error } = await apiClient.post<Activity>(
    `/api/activities/sync?id=${activity.id}&type=loot`,
    undefined,
    { showToast: false }
  )

  if (error || !lootResult) {
    return
  }

  get().updateActivity(activity.id, lootResult)
}

async function runLootOnlyAutoSync(get: () => ActivityStore, type: string) {
  const { activities } = get()
  const eligible = (activities || []).filter((activity: Activity) => {
    if (activity.type !== type || activity.status !== 'active' || activity.isPaused) return false
    const data = activity.data || {}
    return !!(data.autoLootTrackingEnabled && data.autoLootCharacterId && data.autoLootContainerId)
  })

  for (const activity of eligible) {
    await maybeSyncContainerLoot(activity, get)
  }
}

async function runAutoSync(get: () => ActivityStore, type: string, completedSyncWindowMinutes: number) {
  const { activities, syncActivity } = get()

  const minGap =
    type === 'ratting' || type === 'escalations'
      ? MIN_SYNC_GAP_MS_RATTING
      : type === 'mining'
        ? MIN_SYNC_GAP_MS_MINING
        : type === 'abyssal'
          ? MIN_SYNC_GAP_MS_ABYSSAL
          : MIN_SYNC_GAP_MS_EXPLORATION

  const toSync = (activities || []).filter((a: Activity) => {
    if (a.type !== type) return false
    if (a.isPaused) return false

    if (type === 'abyssal') {
      const trackingMode = (a.data as { trackingMode?: string })?.trackingMode || 'automatic'
      if (trackingMode === 'manual') return false
    }

    if (a.status === 'active') {
      const lastAt = (a.data as any)?.lastSyncAt
      if (lastAt) {
        const elapsed = Date.now() - new Date(lastAt).getTime()
        if (elapsed < minGap) return false
      } else {
        // No sync yet - check if the activity is brand new (grace period)
        const startMs = new Date(a.startTime).getTime()
        if (Date.now() - startMs < NEW_ACTIVITY_GRACE_MS) return false
      }
      return true
    }

    if (a.status === 'completed' && a.endTime) {
      if (type === 'abyssal') return false
      const end = new Date(a.endTime).getTime()
      const now = Date.now()
      const diffMinutes = (now - end) / (1000 * 60)
      return diffMinutes <= completedSyncWindowMinutes
    }

    return false
  })

  if (toSync.length === 0) return

  const maxConcurrency = 3

  for (let index = 0; index < toSync.length; index += maxConcurrency) {
    const batch = toSync.slice(index, index + maxConcurrency)
    try {
      await Promise.all(
        batch.map(async (activity: Activity) => {
          try {
            const updated = await syncActivity(activity.id, type)
            if (updated && (type === 'ratting' || type === 'exploration')) {
              await maybeSyncContainerLoot(updated, get)
            }
          } catch (err) {
            console.error(`[AUTO-SYNC] Error syncing ${type} activity ${activity.id}:`, err)
          }
        })
      )
    } catch (batchError) {
      console.error(`[AUTO-SYNC] Unexpected batch error for ${type}:`, batchError)
    }
  }
}
