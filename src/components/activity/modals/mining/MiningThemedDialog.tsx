'use client'

import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getActivityTheme, getActivityThemeIcon } from '@/lib/activity/activity-theme'
import { cn } from '@/lib/utils'

const theme = getActivityTheme('mining')

type MiningThemedDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  badge: string
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  maxWidth?: 'md' | 'lg' | 'xl' | '2xl' | '4xl'
  scrollable?: boolean
}

const maxWidthClass = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
} as const

export function MiningThemedDialog({
  open,
  onOpenChange,
  badge,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
  scrollable = false,
}: MiningThemedDialogProps) {
  const Icon = getActivityThemeIcon('mining')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[90vh] flex-col overflow-hidden border-0 bg-transparent p-0 shadow-none',
          maxWidthClass[maxWidth],
          theme.card,
          theme.cardGlow
        )}
      >
        <div className={theme.cardTint} aria-hidden />
        <div className={theme.cardOrb} aria-hidden />

        <DialogHeader
          className={cn('relative z-[2] shrink-0 border-b px-5 py-4 sm:px-6 sm:py-5', theme.header)}
        >
          <div
            aria-hidden
            className={cn('pointer-events-none absolute inset-0 opacity-75', theme.headerWash)}
          />
          <div className="relative z-[2] flex items-start gap-3 sm:gap-4">
            <div
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center sm:h-12 sm:w-12',
                theme.headerIconBox
              )}
            >
              <Icon className={cn('h-5 w-5 sm:h-6 sm:w-6', theme.headerIcon)} />
            </div>
            <div className="min-w-0 flex-1 pr-6">
              <p className={cn('font-mono text-[10px] font-bold uppercase tracking-[0.14em]', theme.textMuted)}>
                {badge}
              </p>
              <DialogTitle className={cn('mt-1 text-base font-bold sm:text-lg', theme.text)}>
                {title}
              </DialogTitle>
              {description ? (
                <DialogDescription className={cn('mt-1 text-xs leading-relaxed sm:text-sm', theme.textMuted)}>
                  {description}
                </DialogDescription>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        <div
          className={cn(
            'relative z-[2] min-h-0 flex-1',
            scrollable ? 'overflow-y-auto custom-scrollbar' : 'overflow-visible'
          )}
        >
          <div className="p-5 sm:p-6">{children}</div>
        </div>

        {footer ? (
          <div className={cn('relative z-[2] shrink-0 border-t px-5 py-4 sm:px-6', theme.footer)}>
            {footer}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

export { theme as miningModalTheme }
