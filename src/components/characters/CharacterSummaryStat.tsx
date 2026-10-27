import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type CharacterSummaryStatVariant = 'amber' | 'emerald' | 'blue' | 'cyan'

/** Variant → Teal Aurora accent color (icon tile + progress bar). */
const variantColor: Record<CharacterSummaryStatVariant, string> = {
  amber: 'var(--ta-warning)',
  emerald: 'var(--ta-success)',
  blue: 'var(--ta-info)',
  cyan: 'var(--acc)',
}

interface CharacterSummaryStatProps {
  title: string
  value: string
  hint?: string
  icon: LucideIcon
  variant: CharacterSummaryStatVariant
  progress?: number
}

export function CharacterSummaryStat({
  title,
  value,
  hint,
  icon: Icon,
  variant,
  progress,
}: CharacterSummaryStatProps) {
  const color = variantColor[variant]
  const clampedProgress =
    progress !== undefined ? Math.min(100, Math.max(0, progress)) : undefined

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
        <div className="min-w-0">
          <p className="font-accent text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ta-muted">
            {title}
          </p>
          <p
            className="mt-1 font-sans text-[22px] font-bold leading-none tabular-nums text-ta-bright"
            style={variant === 'cyan' ? { color } : undefined}
          >
            {value}
          </p>
          {hint && (
            <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-wide text-ta-faint">
              {hint}
            </p>
          )}
        </div>
      </div>
      {clampedProgress !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ta-inset">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${clampedProgress}%`, background: color }}
          />
        </div>
      )}
    </div>
  )
}
