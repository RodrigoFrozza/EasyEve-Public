'use client'

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type AdminFilterOption = {
  value: string
  label: string
}

export function AdminToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  filters,
  activeFilter,
  onFilterChange,
  actions,
  className,
}: {
  search?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  filters?: AdminFilterOption[]
  activeFilter?: string
  onFilterChange?: (value: string) => void
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      {onSearchChange !== undefined && (
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ta-faint" />
          <Input
            value={search ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-[42px] rounded-[10px] border-white/[0.08] bg-ta-inset pl-9 text-ta-body placeholder:text-ta-faint"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {filters && filters.length > 0 && onFilterChange && (
          <div className="flex flex-wrap gap-1 rounded-[9px] border border-white/[0.08] bg-ta-inset p-1">
            {filters.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => onFilterChange(f.value)}
                className={cn(
                  'rounded-[6px] px-3 py-1.5 font-accent text-xs font-semibold transition-colors',
                  activeFilter === f.value
                    ? 'bg-eve-accent/[0.12] text-eve-accent ring-1 ring-inset ring-eve-accent/[0.24]'
                    : 'text-ta-secondary hover:bg-white/[0.04] hover:text-white'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
        {actions}
      </div>
    </div>
  )
}
