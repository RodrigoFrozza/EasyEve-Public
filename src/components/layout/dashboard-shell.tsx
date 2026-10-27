'use client'

import { useSidebarStore } from '@/lib/stores/sidebar-store'
import { Sidebar } from './sidebar'
import { FloatingSocialButton } from '@/components/social/FloatingSocialButton'
import { ChunkLoadRecovery } from '@/components/shared/ChunkLoadRecovery'
import { Button } from '@/components/ui/button'
import { PanelLeft } from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'
import { cn } from '@/lib/utils'

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { isCollapsed, setCollapsed } = useSidebarStore()
  const { t } = useTranslations()

  return (
    <div className="ta-app-bg flex h-screen overflow-hidden">
      <ChunkLoadRecovery />
      {!isCollapsed && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/65 backdrop-blur-[2px] md:hidden"
          aria-label={t('sidebar.collapse')}
          onClick={() => setCollapsed(true)}
        />
      )}

      <Sidebar />

      <main
        className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto custom-scrollbar"
        aria-label="Dashboard content"
      >
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-[#05090f]/90 px-4 backdrop-blur md:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 border border-eve-border/50 text-eve-muted hover:text-eve-accent"
            onClick={() => setCollapsed(false)}
            aria-label={t('sidebar.openMenu')}
          >
            <PanelLeft className="h-5 w-5" />
          </Button>
          <span className="text-sm font-bold tracking-tight text-eve-text">
            Easy<span className="text-eve-accent">Eve</span>
          </span>
        </header>

        <div className={cn('min-h-0 flex-1')}>{children}</div>
      </main>

      <FloatingSocialButton />
    </div>
  )
}
