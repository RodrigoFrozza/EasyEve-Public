'use client'

import { useMemo, useState, useId } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EXPLORATION_SITE_TYPES } from '@/lib/constants/activity-data'
import { explorationModalTheme } from './ExplorationThemedDialog'
import { cn } from '@/lib/utils'

type ExplorationSiteSearchProps = {
  label: string
  placeholder: string
  value: string
  onValueChange: (value: string) => void
  onSelect: (site: string) => void
  emptyMessage: string
  className?: string
}

export function ExplorationSiteSearch({
  label,
  placeholder,
  value,
  onValueChange,
  onSelect,
  emptyMessage,
  className,
}: ExplorationSiteSearchProps) {
  const theme = explorationModalTheme
  const listId = useId()
  const [open, setOpen] = useState(false)

  const suggestions = useMemo(() => {
    const term = value.trim().toLowerCase()
    if (!term) return EXPLORATION_SITE_TYPES.slice(0, 18)
    return EXPLORATION_SITE_TYPES.filter((s) => s.toLowerCase().includes(term))
      .slice(0, 15)
      .sort()
  }, [value])

  const showList = open && value.trim().length > 0

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={listId} className={cn('text-[10px] font-bold uppercase tracking-wide', theme.textMuted)}>
        {label}
      </Label>
      <div className="relative">
        <Input
          id={listId}
          role="combobox"
          aria-expanded={showList}
          aria-autocomplete="list"
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onValueChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              const trimmed = value.trim()
              if (!trimmed) return
              const exact = suggestions.find((s) => s.toLowerCase() === trimmed.toLowerCase())
              onSelect(exact ?? trimmed)
              setOpen(false)
            }
            if (e.key === 'Escape') setOpen(false)
          }}
          className={cn(
            'h-10 rounded-lg border bg-black/30 pr-9 text-sm backdrop-blur-sm',
            'border-orange-400/25 text-orange-50 placeholder:text-orange-400/35',
            'focus-visible:border-orange-400/50 focus-visible:ring-1 focus-visible:ring-orange-400/30'
          )}
        />
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-400/50" />

        {showList ? (
          <ul
            role="listbox"
            className={cn(
              'absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border py-1 shadow-xl custom-scrollbar',
              'border-orange-400/25 bg-[#0c141c]/95 backdrop-blur-md'
            )}
          >
            {suggestions.length > 0 ? (
              suggestions.map((site) => (
                <li key={site}>
                  <button
                    type="button"
                    role="option"
                    className={cn(
                      'w-full px-3 py-2 text-left text-xs transition-colors sm:text-sm',
                      'text-orange-100/80 hover:bg-orange-500/15 hover:text-orange-50'
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onSelect(site)
                      setOpen(false)
                    }}
                  >
                    {site}
                  </button>
                </li>
              ))
            ) : (
              <li className="px-3 py-2 text-xs text-orange-400/50">{emptyMessage}</li>
            )}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
