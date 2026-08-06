import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CharacterMetricTileProps {
  icon: LucideIcon
  label: string
  value: React.ReactNode
  iconClassName?: string
  valueClassName?: string
  className?: string
}

export function CharacterMetricTile({
  icon: Icon,
  label,
  value,
  iconClassName,
  valueClassName,
  className,
}: CharacterMetricTileProps) {
  return (
    <div
      className={cn(
        'rounded-md border border-white/5 bg-black/20 p-2.5',
        className
      )}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5 shrink-0', iconClassName)} />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</span>
      </div>
      <div className={cn('truncate text-sm font-bold text-zinc-100', valueClassName)}>{value}</div>
    </div>
  )
}
