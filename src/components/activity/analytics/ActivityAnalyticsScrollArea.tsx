'use client'

import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area'
import type { ActivityThemeClasses } from '@/lib/activity/activity-theme'
import { cn } from '@/lib/utils'

type Props = {
  theme: ActivityThemeClasses
  children: React.ReactNode
  className?: string
}

export function ActivityAnalyticsScrollArea({ theme, children, className }: Props) {
  return (
    <ScrollAreaPrimitive.Root
      className={cn('relative z-[2] min-h-0 flex-1 overflow-hidden', className)}
    >
      <ScrollAreaPrimitive.Viewport className="h-full w-full [&>div]:!block">
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar
        orientation="vertical"
        className={cn(
          'flex w-3 touch-none select-none border-l border-white/10 bg-zinc-800/50 p-0.5',
          'transition-opacity hover:bg-zinc-700/50'
        )}
      >
        <ScrollAreaPrimitive.Thumb
          className={cn(
            'relative min-h-[3rem] flex-1 rounded-full',
            theme.accentBar,
            'opacity-70 hover:opacity-90'
          )}
        />
      </ScrollAreaPrimitive.Scrollbar>
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}
