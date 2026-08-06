'use client'

import type { LucideIcon } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface SettingsToggleRowProps {
  icon?: LucideIcon
  iconClassName?: string
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  saving?: boolean
  badge?: string
  className?: string
}

export function SettingsToggleRow({
  icon: Icon,
  iconClassName,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  saving,
  badge,
  className,
}: SettingsToggleRowProps) {
  const isDisabled = disabled || saving || !!badge

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 border-b border-eve-border/40 py-4 last:border-b-0',
        isDisabled && 'opacity-60',
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {Icon && (
          <div
            className={cn(
              'shrink-0 rounded-lg bg-white/5 p-2 text-gray-400 transition-colors',
              iconClassName
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-white">{label}</p>
            {badge && (
              <Badge variant="outline" className="border-zinc-600 text-[10px] uppercase tracking-wider text-zinc-400">
                {badge}
              </Badge>
            )}
          </div>
          {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={isDisabled}
        className="shrink-0 data-[state=checked]:bg-eve-accent"
        aria-label={label}
        role="switch"
      />
    </div>
  )
}
