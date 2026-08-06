import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface FocusSidebarState {
  isCollapsed: boolean
  toggleCollapsed: () => void
  setCollapsed: (collapsed: boolean) => void
}

export const useFocusSidebarStore = create<FocusSidebarState>()(
  persist(
    (set) => ({
      isCollapsed: false,
      toggleCollapsed: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
      setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
    }),
    {
      name: 'focus-sidebar-storage',
    }
  )
)
