'use client'

import { useEffect, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'

export interface StructureHit {
  structureId: string
  name: string
}

/**
 * Search + pick a private structure the account can dock at, backed by
 * /api/market/structures (per-character docking access). Shared by any market
 * tool that prices against a structure.
 */
export function StructurePicker({
  selected,
  onSelect,
  onClear,
  endpoint = '/api/market/structures',
}: {
  selected: StructureHit | null
  onSelect: (s: StructureHit) => void
  onClear: () => void
  /** Search endpoint (`?q=`). Override to e.g. only structures with an active market. */
  endpoint?: string
}) {
  const { t } = useTranslations()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StructureHit[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) {
      setResults([])
      return
    }
    let cancelled = false
    setSearching(true)
    const timer = setTimeout(() => {
      fetch(`${endpoint}?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { structures: [] }))
        .then((d) => {
          if (!cancelled) {
            setResults(d.structures ?? [])
            setOpen(true)
          }
        })
        .catch(() => undefined)
        .finally(() => !cancelled && setSearching(false))
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, endpoint])

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-100">
        <span className="truncate">{selected.name}</span>
        <button type="button" onClick={onClear} className="ml-auto text-violet-300 hover:text-violet-100">
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-2">
        <Search className="h-4 w-4 shrink-0 text-zinc-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('appraisal.structureSearchPlaceholder')}
          className="h-9 w-full bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
        />
        {searching ? <Loader2 className="h-4 w-4 animate-spin text-zinc-500" /> : null}
      </div>
      {open && results.length > 0 ? (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-zinc-800 bg-zinc-950 py-1 shadow-xl">
          {results.map((s) => (
            <li key={s.structureId}>
              <button
                type="button"
                onClick={() => {
                  onSelect(s)
                  setOpen(false)
                  setQuery('')
                }}
                className="block w-full truncate px-3 py-1.5 text-left text-sm text-zinc-300 hover:bg-violet-500/10 hover:text-violet-100"
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && !searching && query.trim().length >= 3 && results.length === 0 ? (
        <p className="mt-1 px-1 text-xs text-zinc-600">{t('appraisal.structureNoResults')}</p>
      ) : null}
    </div>
  )
}
