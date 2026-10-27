'use client'

import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ReactNode } from 'react'

interface DashboardRailHeaderProps {
  isCollapsed: boolean
  onToggle: () => void
  expandLabel: string
  collapseLabel: string
  title?: ReactNode
  collapsedHint?: ReactNode
  toggleChevronWhenCollapsed?: 'left' | 'right'
  className?: string
}

export function DashboardRailHeader({
  isCollapsed,
  onToggle,
  expandLabel,
  collapseLabel,
  title,
  collapsedHint,
  toggleChevronWhenCollapsed = 'right',
  className,
}: DashboardRailHeaderProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center border-b border-eve-border bg-eve-dark overflow-hidden',
        isCollapsed ? 'h-auto min-h-[52px] flex-col justify-center gap-1.5 py-2 px-1' : 'h-10 justify-between px-3',
        className
      )}
    >
      {!isCollapsed && title ? (
        <div className="flex min-w-0 flex-1 items-center gap-2">{title}</div>
      ) : null}
      {isCollapsed && collapsedHint ? (
        <div className="max-w-[52px] truncate text-center text-[9px] leading-tight text-eve-muted">
          {collapsedHint}
        </div>
      ) : null}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-sm border border-eve-border bg-eve-panel text-eve-muted transition-colors hover:border-eve-accent/40 hover:text-eve-accent',
          isCollapsed ? 'h-9 w-9' : 'h-7 w-7'
        )}
        title={isCollapsed ? expandLabel : collapseLabel}
        aria-expanded={!isCollapsed}
        aria-label={isCollapsed ? expandLabel : collapseLabel}
      >
        {isCollapsed ? (
          toggleChevronWhenCollapsed === 'left' ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  )
}
