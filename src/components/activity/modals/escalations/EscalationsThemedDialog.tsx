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

const theme = getActivityTheme('escalations')

type EscalationsThemedDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  badge: string
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  maxWidth?: 'md' | 'lg' | 'xl' | '2xl'
  scrollable?: boolean
}

const maxWidthClass = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
} as const

export function EscalationsThemedDialog({
  open,
  onOpenChange,
  badge,
  title,
  description,
  children,
  footer,
  maxWidth = 'lg',
  scrollable = true,
}: EscalationsThemedDialogProps) {
  const Icon = getActivityThemeIcon('escalations')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'border border-orange-500/20 bg-[#0c0a08]/95 text-orange-50 shadow-2xl shadow-orange-950/40',
          maxWidthClass[maxWidth]
        )}
      >
        <DialogHeader className="space-y-3">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
                theme.iconBg,
                'border border-orange-500/20'
              )}
            >
              <Icon className={cn('h-5 w-5', theme.headerIcon)} />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-orange-400/70">
                {badge}
              </p>
              <DialogTitle className="text-base font-bold text-orange-50">{title}</DialogTitle>
              {description ? (
                <DialogDescription className="text-xs text-orange-200/60">{description}</DialogDescription>
              ) : null}
            </div>
          </div>
        </DialogHeader>
        <div className={cn(scrollable && 'max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar')}>
          {children}
        </div>
        {footer ? <div className="mt-4 border-t border-orange-500/10 pt-4">{footer}</div> : null}
      </DialogContent>
    </Dialog>
  )
}

export const escalationsModalTheme = theme
