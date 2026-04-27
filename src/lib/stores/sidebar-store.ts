import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const MENU_IDS = {
  FIT_MANAGEMENT: 'fit-management',
  FINANCE: 'finance',
} as const

interface SidebarState {
  isCollapsed: boolean
  openMenus: string[]
  toggleCollapsed: () => void
  setCollapsed: (collapsed: boolean) => void
  toggleMenu: (menu: string) => void
  setOpenMenus: (menus: string[]) => void
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set, get) => ({
      isCollapsed: false,
      openMenus: [MENU_IDS.FIT_MANAGEMENT],
      toggleCollapsed: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
      setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
      toggleMenu: (menu) => set((state) => ({
        openMenus: state.openMenus.includes(menu)
          ? state.openMenus.filter(m => m !== menu)
          : [...state.openMenus, menu]
      })),
      setOpenMenus: (menus) => set({ openMenus: menus }),
      expandIfDesktop: () => {
        if (typeof window !== 'undefined' && window.innerWidth >= 768) {
          const state = get()
          if (state.isCollapsed) {
            set({ isCollapsed: false })
          }
        }
      },
    }),
    {
      name: 'sidebar-storage',
    }
  )
)