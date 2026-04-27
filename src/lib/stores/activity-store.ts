'use client'

import { create } from 'zustand'
import { apiClient } from '@/lib/api-error'

// External refs to avoid triggering re-renders on every update
let pollingIntervalRef: NodeJS.Timeout | null = null
let rattingSyncIntervalRef: NodeJS.Timeout | null = null
let miningSyncIntervalRef: NodeJS.Timeout | null = null
const lastFetchTimeByKey: Record<string, number> = {}
const fetchGenerationByKey: Record<string, number> = {}

export interface ActivityParticipant {
  characterId: number
  characterName?: string
  fit?: string
  fitName?: string
  shipTypeId?: number
}

export interface Activity {
  id: string
  type: string
  status: 'active' | 'completed'
  startTime: string | Date
  endTime?: string | Date
  isPaused?: boolean
  pausedAt?: string | Date
  accumulatedPausedTime?: number // in ms
  typeId?: number
  region?: string
  space?: string
  data?: any 
  participants: ActivityParticipant[]
}

interface ActivityStore {
  activities: Activity[]
  serverClockOffset: number
  isLoading: boolean
  pagination: { total: number; activeCount: number; page: number; limit: number; totalPages: number }
  
  // Getters for external refs (for backward compatibility)
  getPollingInterval: () => NodeJS.Timeout | null
  getRattingSyncInterval: () => NodeJS.Timeout | null
  getMiningSyncInterval: () => NodeJS.Timeout | null
  
  setActivities: (activities: Activity[]) => void
  addActivity: (activity: Activity) => void
  updateActivity: (id: string, updates: Partial<Activity>) => void
  removeActivity: (id: string) => void
  
  getActiveCharacterIds: () => number[]
  isCharacterBusy: (characterId: number) => boolean
  
  fetchFromAPI: (type?: string, page?: number, limit?: number) => Promise<void>
  syncActivity: (id: string, type?: string) => Promise<Activity | null>
  
  startPolling: (type?: string, interval?: number, limit?: number) => void
  startRattingAutoSync: (interval?: number) => void
  startMiningAutoSync: (interval?: number) => void
  stopPolling: () => void
  stopRattingAutoSync: () => void
  stopMiningAutoSync: () => void
}

export const useActivityStore = create<ActivityStore>((set, get) => ({
  activities: [],
  serverClockOffset: 0,
  isLoading: false,
  pagination: {
    total: 0,
    activeCount: 0,
    page: 1,
    limit: 10,
    totalPages: 0
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
    return get().getActiveCharacterIds().includes(characterId)
  },

  fetchFromAPI: async (type?: string, page: number = 1, limit?: number) => {
    const resolvedLimit = limit ?? get().pagination.limit ?? 10
    const fetchKey = `${type ?? 'all'}:${page}:${resolvedLimit}`
    const now = Date.now()
    const last = lastFetchTimeByKey[fetchKey] ?? 0
    if (now - last < 300) {
      return
    }
    lastFetchTimeByKey[fetchKey] = now

    const generation = (fetchGenerationByKey[fetchKey] ?? 0) + 1
    fetchGenerationByKey[fetchKey] = generation

    set({ isLoading: true })
    const url = type
      ? `/api/activities?type=${type}&page=${page}&limit=${resolvedLimit}&light=1`
      : `/api/activities?page=${page}&limit=${resolvedLimit}&light=1`

    const { data, error } = await apiClient.get<any>(url)

    if (fetchGenerationByKey[fetchKey] !== generation) {
      set({ isLoading: false })
      return
    }

    if (error) {
      console.error('Failed to fetch from API:', error)
      set({ isLoading: false })
      return
    }

    if (data && data.active && data.history) {
      set({
        activities: [...data.active, ...data.history],
        pagination: data.pagination
      })
    }

    set({ isLoading: false })
  },

  syncActivity: async (id: string, type?: string) => {
    let syncType = type
    if (!syncType) {
      const { activities } = get()
      syncType = activities.find(a => a.id === id)?.type
    }

    const endpoint = syncType === 'mining' ? 'sync-mining' : 'sync'
    
    const { data } = await apiClient.post<Activity>(`/api/activities/${endpoint}?id=${id}`, undefined, {
      showToast: false
    })
    
    if (data) {
      set((state) => ({
        activities: state.activities.map((a) => 
          a.id === id ? { ...a, ...data } : a
        )
      }))
      return data
    }
    
    return null
  },

  startPolling: (type?: string, interval = 30000, limit?: number) => {
    const { stopPolling } = get()
    stopPolling()
    
    pollingIntervalRef = setInterval(() => {
      get().fetchFromAPI(type, get().pagination.page, limit ?? get().pagination.limit)
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
    
    rattingSyncIntervalRef = setInterval(() => runAutoSync(get, 'ratting', 168), interval)
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
    
    miningSyncIntervalRef = setInterval(() => runAutoSync(get, 'mining', 60), interval)
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
}))

const MIN_SYNC_GAP_MS_RATTING = 120_000
const MIN_SYNC_GAP_MS_MINING = 90_000

async function runAutoSync(get: any, type: string, completedSyncWindowMinutes: number) {
  const { activities, syncActivity } = get()

  const minGap = type === 'ratting' ? MIN_SYNC_GAP_MS_RATTING : MIN_SYNC_GAP_MS_MINING

  const toSync = (activities || []).filter((a: Activity) => {
    if (a.type !== type) return false
    if (a.isPaused) return false

    if (a.status === 'active') {
      const lastAt = (a.data as any)?.lastSyncAt
      if (lastAt) {
        const elapsed = Date.now() - new Date(lastAt).getTime()
        if (elapsed < minGap) return false
      }
      return true
    }

    if (a.status === 'completed' && a.endTime) {
      const end = new Date(a.endTime).getTime()
      const now = Date.now()
      const diffMinutes = (now - end) / (1000 * 60)
      return diffMinutes <= completedSyncWindowMinutes
    }

    return false
  })

  if (toSync.length === 0) return

  for (const activity of toSync) {
    try {
      await syncActivity(activity.id, type)
    } catch (err) {
      console.error(`[AUTO-SYNC] Error syncing ${type} activity ${activity.id}:`, err)
    }
  }
}
