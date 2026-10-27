'use client'

import type { ReactNode } from 'react'
import type { ActivityThemeClasses } from '@/lib/activity/activity-theme'
import { cn } from '@/lib/utils'

type ActivityThemedPanelProps = {
  theme: ActivityThemeClasses
  title: string
  /** When true, renders `TITLE.LOG` (history panels). */
  logSuffix?: boolean
  children: ReactNode
  className?: string
  headerExtra?: ReactNode
}

/** Shared glass panel shell (accent bar + header + body). */
export function ActivityThemedPanel({
  theme,
  title,
  logSuffix = false,
  children,
  className,
  headerExtra,
}: ActivityThemedPanelProps) {
  return (
    <div
      className={cn(theme.panel, 'relative flex w-full min-w-0 flex-col pl-5', className)}
    >
      <div
        aria-hidden
        className={cn('pointer-events-none absolute inset-0 opacity-80', theme.panelWash)}
      />
      <div
        className={cn('absolute left-2.5 top-4 bottom-4 z-[1] w-[3px] rounded-full', theme.accentBar)}
        aria-hidden
      />
      <div className={cn('relative z-[2]', theme.panelDivider)}>
        <p className={cn('font-mono text-[10px] font-bold uppercase tracking-[0.16em]', theme.text)}>
          {title}
          {logSuffix ? <span className={theme.textMuted}>.LOG</span> : null}
        </p>
        {headerExtra}
      </div>
      <div className="relative z-[2] flex flex-col">{children}</div>
    </div>
  )
}

interface ActivityLogPanelProps {
  theme: ActivityThemeClasses
  logName: string
  emptyMessage: string
  /** Optional second line under emptyMessage (e.g. sync / register loot hint). */
  emptyHint?: string
  /** Tighter empty placeholder (activity cards in compact mode). */
  emptyDensity?: 'default' | 'compact'
  isEmpty: boolean
  children: ReactNode
  className?: string
  headerExtra?: ReactNode
}

export function ActivityLogPanel({
  theme,
  logName,
  emptyMessage,
  emptyHint,
  emptyDensity = 'default',
  isEmpty,
  children,
  className,
  headerExtra,
}: ActivityLogPanelProps) {
  const isCompactEmpty = emptyDensity === 'compact'
  return (
    <ActivityThemedPanel
      theme={theme}
      title={logName}
      logSuffix
      className={className}
      headerExtra={headerExtra}
    >
      {isEmpty ? (
        <div
          className={cn(
            'flex items-center justify-center p-1',
            isCompactEmpty ? 'min-h-[2.75rem]' : 'min-h-[4.5rem]'
          )}
        >
          <div
            className={cn(
              'flex w-full flex-col items-center justify-center rounded-lg border border-dashed backdrop-blur-[2px]',
              isCompactEmpty ? 'gap-1 px-3 py-2' : 'gap-1.5 px-4 py-4',
              theme.logEmpty
            )}
          >
            <p
              className={cn(
                'text-center font-bold uppercase tracking-[0.14em]',
                isCompactEmpty ? 'text-[9px]' : 'text-[10px]',
                theme.textMuted
              )}
            >
              {emptyMessage}
            </p>
            {emptyHint ? (
              <p
                className={cn(
                  'max-w-[240px] text-center leading-relaxed text-white/45',
                  isCompactEmpty ? 'text-[9px]' : 'text-[10px]'
                )}
              >
                {emptyHint}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="max-h-[min(20rem,45vh)] space-y-1 overflow-y-auto pr-0.5 custom-scrollbar">
          {children}
        </div>
      )}
    </ActivityThemedPanel>
  )
}
