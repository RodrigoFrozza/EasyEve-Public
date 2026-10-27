'use client'

import { useState, ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SESSION_MODAL_SURFACE } from '@/lib/activity/session-modal-surface'

/** Readable copy tokens for history modal sections */
export const SESSION_SECTION_LABEL = 'text-zinc-400'
export const SESSION_SECTION_VALUE = 'text-zinc-100'
export const SESSION_SECTION_SUMMARY = 'text-zinc-400'

interface ExpandableSectionProps {
  title: string
  icon?: ReactNode
  children: ReactNode
  summary?: ReactNode
  badge?: ReactNode
  defaultExpanded?: boolean
  className?: string
  headerClassName?: string
  variant?: 'default' | 'accent' | 'danger' | 'warning' | 'success'
  accentClassName?: string
  borderClassName?: string
  summaryClassName?: string
}

export function ExpandableSection({
  title,
  icon,
  children,
  summary,
  badge,
  defaultExpanded = false,
  className,
  headerClassName,
  variant = 'default',
  accentClassName,
  borderClassName,
  summaryClassName = SESSION_SECTION_SUMMARY,
}: ExpandableSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const iconColor =
    variant === 'accent' && accentClassName
      ? accentClassName
      : variant === 'danger'
        ? 'text-red-400'
        : variant === 'warning'
          ? 'text-amber-400'
          : variant === 'success'
            ? 'text-emerald-400'
            : 'text-zinc-400'

  return (
    <div
      className={cn(
        'overflow-hidden rounded-md',
        borderClassName ?? SESSION_MODAL_SURFACE.section,
        className
      )}
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex w-full items-center justify-between border-b border-transparent px-4 py-3 text-left transition-colors hover:bg-white/[0.06]',
          isExpanded && 'border-white/12 bg-white/[0.04]',
          headerClassName
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          {icon && <div className={cn('shrink-0', iconColor)}>{icon}</div>}
          <div className="min-w-0">
            <h3 className="font-mono text-[11px] font-black uppercase tracking-[0.2em] text-zinc-100">
              {title}
            </h3>
            {summary && !isExpanded && (
              <div className={cn('mt-1 truncate', summaryClassName)}>{summary}</div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {badge && <div>{badge}</div>}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-zinc-400 transition-transform',
              isExpanded && 'rotate-180'
            )}
            aria-hidden
          />
        </div>
      </button>

      {isExpanded && (
        <div className={cn('px-4 py-4', SESSION_MODAL_SURFACE.sectionExpanded)}>{children}</div>
      )}
    </div>
  )
}
