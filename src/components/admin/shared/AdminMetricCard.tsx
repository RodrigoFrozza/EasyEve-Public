import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

const colorMap = {
  blue: 'text-ta-info bg-[rgba(110,168,254,.1)]',
  green: 'text-ta-success bg-[rgba(16,185,129,.1)]',
  yellow: 'text-ta-warning bg-[rgba(224,169,74,.1)]',
  purple: 'text-ta-violet bg-[rgba(169,139,250,.1)]',
  red: 'text-ta-danger bg-[rgba(244,114,114,.1)]',
} as const

export function AdminMetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'blue',
  href,
}: {
  title: string
  value: string
  subtitle?: string
  icon?: LucideIcon
  color?: keyof typeof colorMap
  href?: string
}) {
  const content = (
    <div className="ta-panel p-[18px] transition-transform duration-200 hover:-translate-y-0.5">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px]', colorMap[color])}>
            <Icon className="h-[18px] w-[18px]" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-accent text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ta-muted">{title}</p>
          <p className="mt-1 font-sans text-[22px] font-bold leading-tight tabular-nums text-ta-heading">{value}</p>
          {subtitle && (
            <p className="mt-0.5 text-[11px] text-ta-muted">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  )

  if (href) {
    return (
      <a href={href} className="block rounded-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-eve-accent/40">
        {content}
      </a>
    )
  }

  return content
}
