'use client'

import { cn } from '@/lib/utils'
import { getActivityTheme } from '@/lib/activity/activity-theme'

const theme = getActivityTheme('mining')

export function MinersRestSection({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-4', className)}>
      <h2 className={cn('font-mono text-xs font-bold uppercase tracking-widest', theme.text)}>
        {title}
      </h2>
      <div className={cn('overflow-hidden rounded-xl border p-4', theme.panel)}>{children}</div>
    </section>
  )
}

export function MinersRestEmpty({ message }: { message: string }) {
  return (
    <p className={cn('py-8 text-center text-sm', theme.textMuted)}>{message}</p>
  )
}

export { theme as minersRestTheme }
