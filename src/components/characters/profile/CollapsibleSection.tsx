'use client'

import { useId, useState, type ReactNode } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface CollapsibleSectionProps {
  icon: LucideIcon
  title: ReactNode
  /** Shown next to the title at all times (open or closed) so the user can
   * decide whether to expand without having to open every section first. */
  summary?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
  className?: string
  /** Applied to the inner content wrapper — use for `max-h-*`/`overflow-y-auto`
   * so a long section scrolls inside its card instead of stretching the page. */
  contentClassName?: string
}

/**
 * Reusable collapsible <Card> section: clickable header (title + summary +
 * rotating chevron) that expands/collapses its content with a smooth
 * height animation. Respects prefers-reduced-motion (falls back to an
 * instant show/hide, no height/opacity tweening).
 */
export function CollapsibleSection({
  icon: Icon,
  title,
  summary,
  defaultOpen = false,
  children,
  className,
  contentClassName,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const reduceMotion = useReducedMotion()
  const contentId = useId()

  return (
    <Card className={cn('overflow-hidden rounded-xl border-eve-border bg-eve-panel', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-3 p-5 text-left transition-colors hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-eve-accent"
      >
        <Icon className="h-4 w-4 shrink-0 text-eve-accent" />
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold leading-none tracking-tight text-eve-text">{title}</span>
          {summary && (
            <span className="mt-1.5 block truncate text-xs font-normal text-zinc-500">{summary}</span>
          )}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          className="shrink-0 text-zinc-500"
          aria-hidden
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </button>

      {reduceMotion ? (
        open && (
          <div id={contentId} className={cn('px-5 pb-5', contentClassName)}>
            {children}
          </div>
        )
      ) : (
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="content"
              id={contentId}
              initial="collapsed"
              animate="open"
              exit="collapsed"
              variants={{
                open: { height: 'auto', opacity: 1 },
                collapsed: { height: 0, opacity: 0 },
              }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className={cn('px-5 pb-5', contentClassName)}>{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </Card>
  )
}
