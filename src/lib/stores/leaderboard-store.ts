import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type LeaderboardType = 'ratting' | 'mining' | 'exploration'
export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'alltime'

export interface LeaderboardEntry {
  userId: string
  total: number
  label1?: number
  label2?: number
  characterName: string
  characterId: number
}

interface LeaderboardState {
  isCollapsed: boolean
  activeType: LeaderboardType
  activePeriod: LeaderboardPeriod
  toggleCollapsed: () => void
  setCollapsed: (collapsed: boolean) => void
  setActiveType: (type: LeaderboardType) => void
  setActivePeriod: (period: LeaderboardPeriod) => void
}


export const useLeaderboardStore = create<LeaderboardState>()(
  persist(
    (set) => ({
      isCollapsed: false,
      activeType: 'ratting',
      activePeriod: 'daily',
      toggleCollapsed: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
      setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
      setActiveType: (activeType) => set({ activeType }),
      setActivePeriod: (activePeriod) => set({ activePeriod }),
    }),

    {
      name: 'leaderboard-storage',
    }
  )
)
