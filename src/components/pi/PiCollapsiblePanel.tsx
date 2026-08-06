'use client'

import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Tone = 'amber' | 'emerald'

const TONE_STYLES: Record<Tone, { container: string; header: string; count: string }> = {
  amber: {
    container: 'border-amber-500/20 bg-amber-500/5 text-amber-200',
    header: 'text-amber-100',
    count: 'bg-amber-500/20 text-amber-200',
  },
  emerald: {
    container: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-200',
    header: 'text-emerald-100',
    count: 'bg-emerald-500/20 text-emerald-200',
  },
}

/**
 * Collapsible bordered panel used for the planet-detail warnings and sourcing
 * suggestions, so they take little space until expanded.
 */
export function PiCollapsiblePanel({
  title,
  icon,
  tone,
  count,
  defaultOpen = false,
  children,
}: {
  title: string
  icon?: ReactNode
  tone: Tone
  count?: number
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const styles = TONE_STYLES[tone]

  return (
    <div className={cn('rounded-lg border p-3 text-xs', styles.container)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn('flex w-full items-center gap-2 font-semibold', styles.header)}
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
        {icon}
        <span>{title}</span>
        {count != null && count > 0 ? (
          <span className={cn('ml-auto rounded px-1.5 py-0.5 text-[10px] tabular-nums', styles.count)}>
            {count}
          </span>
        ) : null}
      </button>
      {open ? <div className="mt-2">{children}</div> : null}
    </div>
  )
}
