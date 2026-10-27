'use client'

import { useLeaderboardStore } from '@/lib/stores/leaderboard-store'
import { cn } from '@/lib/utils'
import { ReactNode, CSSProperties } from 'react'
import { useTranslations } from '@/i18n/hooks'
import { DashboardRailHeader } from './DashboardRailHeader'
import { Trophy } from 'lucide-react'

interface DashboardGridProps {
  children: ReactNode
  leaderboardRail: ReactNode
}

export function DashboardGrid({ children, leaderboardRail }: DashboardGridProps) {
  const lbCollapsed = useLeaderboardStore((s) => s.isCollapsed)
  const activePeriod = useLeaderboardStore((s) => s.activePeriod)
  const toggleLbCollapsed = useLeaderboardStore((s) => s.toggleCollapsed)
  const { t } = useTranslations()

  const lbCol = lbCollapsed ? '56px' : 'minmax(280px, 400px)'

  const gridStyle = {
    '--lb-col': lbCol,
  } as CSSProperties

  const railClass =
    'ta-panel flex flex-col overflow-hidden min-w-0 xl:sticky xl:top-4 xl:self-start xl:max-h-[calc(100vh-2rem)]'

  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-5 min-w-0',
        'xl:gap-4 xl:grid-cols-[1fr_var(--lb-col)]',
        'xl:transition-[grid-template-columns] xl:duration-300 xl:ease-out'
      )}
      style={gridStyle}
    >
      <div className="min-w-0 space-y-5 order-1">{children}</div>

      <aside className={cn(railClass, 'order-2')}>
        <DashboardRailHeader
          isCollapsed={lbCollapsed}
          onToggle={toggleLbCollapsed}
          expandLabel={t('dashboard.expandLeaderboard')}
          collapseLabel={t('dashboard.collapseLeaderboard')}
          toggleChevronWhenCollapsed="left"
          collapsedHint={t(`dashboard.period.${activePeriod}`)}
          title={
            <>
              <Trophy className="h-3.5 w-3.5 shrink-0 text-eve-accent" />
              <span className="truncate text-xs font-semibold text-eve-text">
                {t('dashboard.leaderboards')}
              </span>
            </>
          }
        />
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar">
          {leaderboardRail}
        </div>
      </aside>
    </div>
  )
}
