'use client'

import { useSidebarStore } from '@/lib/stores/sidebar-store'
import { Sidebar } from './sidebar'
import { FloatingSocialButton } from '@/components/social/FloatingSocialButton'

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebarStore()

  return (
    <div className="flex h-screen overflow-hidden bg-eve-dark">
      <Sidebar />
      <main
        className="relative flex min-h-0 flex-1 flex-col overflow-y-auto custom-scrollbar"
        aria-label="Dashboard content"
      >
        {children}
      </main>
      <FloatingSocialButton />
    </div>
  )
}