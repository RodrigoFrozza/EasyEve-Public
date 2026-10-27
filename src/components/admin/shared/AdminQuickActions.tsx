'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AdminQuickAction = {
  label: string
  description?: string
  href?: string
  onClick?: () => void
  icon: LucideIcon
}

export function AdminQuickActions({
  title,
  actions,
}: {
  title: string
  actions: AdminQuickAction[]
}) {
  return (
    <div className="space-y-3">
      <h2 className="font-accent text-[13px] font-semibold uppercase tracking-[0.1em] text-ta-body">{title}</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => {
          const inner = (
            <>
              <action.icon className="h-4 w-4 shrink-0 text-eve-accent" />
              <div className="min-w-0">
                <p className="font-accent text-[13px] font-semibold text-ta-bright">{action.label}</p>
                {action.description && (
                  <p className="text-[11px] text-ta-muted truncate">{action.description}</p>
                )}
              </div>
            </>
          )
          const className = cn(
            'flex items-center gap-3 rounded-[10px] border border-white/[0.06] bg-ta-inset p-3 text-left transition-colors',
            'hover:border-eve-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-eve-accent/40'
          )

          if (action.href) {
            return (
              <Link key={action.label} href={action.href} className={className}>
                {inner}
              </Link>
            )
          }

          return (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className={className}
            >
              {inner}
            </button>
          )
        })}
      </div>
    </div>
  )
}
