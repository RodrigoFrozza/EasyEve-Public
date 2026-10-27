import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export type SubscriptionSummaryStatVariant = 'amber' | 'cyan' | 'zinc' | 'accent'

/** Variant → Teal Aurora color for the icon tile + value. */
const variantColor: Record<SubscriptionSummaryStatVariant, string> = {
  amber: 'var(--ta-warning)',
  cyan: 'var(--acc)',
  zinc: 'var(--ta-secondary)',
  accent: 'var(--acc)',
}

interface SubscriptionSummaryStatProps {
  title: string
  value: string
  hint?: ReactNode
  icon: LucideIcon
  variant: SubscriptionSummaryStatVariant
  isLoading?: boolean
}

export function SubscriptionSummaryStat({
  title,
  value,
  hint,
  icon: Icon,
  variant,
  isLoading,
}: SubscriptionSummaryStatProps) {
  const color = variantColor[variant]
  const valueTinted = variant !== 'zinc'

  return (
    <div className="ta-panel group p-[18px] transition-transform duration-200 motion-safe:hover:-translate-y-0.5">
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px]"
          style={{
            color,
            background: `color-mix(in srgb, ${color} 10%, transparent)`,
            border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
          }}
        >
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-accent text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ta-muted">
            {title}
          </p>
          {isLoading ? (
            <div className="mt-1 h-7 w-32 animate-pulse rounded bg-ta-inset" />
          ) : (
            <p
              className="mt-1 font-sans text-[22px] font-bold leading-tight tabular-nums"
              style={{ color: valueTinted ? color : 'var(--ta-heading)' }}
            >
              {value}
            </p>
          )}
          {hint && !isLoading && (
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-ta-faint">{hint}</p>
          )}
        </div>
      </div>
    </div>
  )
}
