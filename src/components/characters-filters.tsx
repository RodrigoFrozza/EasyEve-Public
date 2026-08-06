'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, ArrowUpDown, X, SlidersHorizontal, ChevronDown } from 'lucide-react'
import type { CharacterListItem } from '@/types/character'
import { useTranslations } from '@/i18n/hooks'
import { cn } from '@/lib/utils'
import { CHARACTER_STALE_THRESHOLD_MS } from '@/lib/characters/constants'
import { CHARACTER_TAG_TRANSLATION_KEYS } from '@/constants/character-tags'
import { getSortCombinedLabel, isDefaultSort } from '@/lib/characters/filter-labels'

type SortField = 'name' | 'totalSp' | 'walletBalance' | 'lastFetchedAt'
type SortOrder = 'asc' | 'desc'
type StatusFilter = 'all' | 'stale' | 'main' | 'tag'
type StatusPill = 'all' | 'main' | 'stale'

interface AccountTagEntry {
  name: string
  count: number
}

interface CharactersFiltersProps {
  characters: CharacterListItem[]
  totalFromServer?: number
  serverDriven?: boolean
  toolbarEnd?: React.ReactNode
  children: (filtered: CharacterListItem[]) => React.ReactNode
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}

function isStale(lastFetchedAt: Date | string | null | undefined): boolean {
  if (!lastFetchedAt) return true
  return Date.now() - new Date(lastFetchedAt).getTime() > CHARACTER_STALE_THRESHOLD_MS
}

function tagLabel(tag: string, t: (key: string) => string): string {
  const key = CHARACTER_TAG_TRANSLATION_KEYS[tag]
  return key ? t(key) : tag
}

function pillClass(active: boolean) {
  return cn(
    'shrink-0 rounded-[8px] border px-3 py-1.5 font-accent text-[12px] font-semibold transition-colors',
    active
      ? 'border-eve-accent/[0.2] bg-eve-accent/[0.09] text-eve-accent'
      : 'border-white/[0.08] bg-ta-inset text-ta-secondary hover:border-white/20 hover:text-white'
  )
}

export function CharactersFilters({
  characters,
  totalFromServer,
  serverDriven = false,
  toolbarEnd,
  children,
}: CharactersFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslations()

  const initialSearch = searchParams.get('search') || ''
  const initialSort = (searchParams.get('sort') || 'name') as SortField
  const initialOrder = (searchParams.get('order') || (initialSort === 'name' ? 'asc' : 'desc')) as SortOrder
  const initialTag = searchParams.get('tag') || ''
  const initialStatus = (searchParams.get('status') ||
    (initialTag ? 'tag' : 'all')) as StatusFilter

  const [searchInput, setSearchInput] = useState(initialSearch)
  const [sortField, setSortField] = useState<SortField>(initialSort)
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialOrder)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus)
  const [selectedTag, setSelectedTag] = useState<string>(initialTag)
  const [filtersExpanded, setFiltersExpanded] = useState(
    () =>
      Boolean(initialSearch) ||
      initialStatus !== 'all' ||
      Boolean(initialTag) ||
      initialSort !== 'name' ||
      initialOrder !== 'asc'
  )

  const debouncedSearch = useDebounce(searchInput, 300)
  const debouncedTag = useDebounce(selectedTag, 300)

  const accountTagsQuery = useQuery({
    queryKey: ['characters', 'tags'],
    queryFn: async (): Promise<AccountTagEntry[]> => {
      const res = await fetch('/api/characters/tags')
      if (!res.ok) throw new Error('Failed to fetch character tags')
      const data = (await res.json()) as { tags: AccountTagEntry[] }
      return data.tags
    },
    staleTime: 60 * 1000,
  })

  const accountTags = accountTagsQuery.data ?? []
  const totalCount = totalFromServer ?? characters.length

  const updateURL = useCallback(
    (search: string, sort: SortField, order: SortOrder, status: StatusFilter, tag: string) => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (!isDefaultSort(sort, order)) {
        params.set('sort', sort)
        params.set('order', order)
      }
      if (status === 'stale' || status === 'main') params.set('status', status)
      if (status === 'tag' && tag) {
        params.set('status', 'tag')
        params.set('tag', tag)
      }
      router.replace(`?${params.toString()}`, { scroll: false })
    },
    [router]
  )

  useEffect(() => {
    updateURL(debouncedSearch, sortField, sortOrder, statusFilter, debouncedTag)
  }, [debouncedSearch, sortField, sortOrder, statusFilter, debouncedTag, updateURL])

  const handleSortChange = (field: SortField) => {
    if (field === sortField) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const handleClearFilters = () => {
    setSearchInput('')
    setSortField('name')
    setSortOrder('asc')
    setStatusFilter('all')
    setSelectedTag('')
    router.replace('', { scroll: false })
  }

  const handleStatusPill = (pill: StatusPill) => {
    setStatusFilter(pill)
    setSelectedTag('')
  }

  const handleTagChip = (tag: string | null) => {
    if (tag === null) {
      setStatusFilter('all')
      setSelectedTag('')
    } else {
      setStatusFilter('tag')
      setSelectedTag(tag)
    }
  }

  const filteredCharacters = useMemo(() => {
    if (serverDriven) return characters

    let result = [...characters]

    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase()
      result = result.filter((c) => c.name.toLowerCase().includes(searchLower))
    }

    switch (statusFilter) {
      case 'stale':
        result = result.filter((c) => isStale(c.lastFetchedAt))
        break
      case 'main':
        result = result.filter((c) => c.isMain)
        break
      case 'tag':
        if (selectedTag) {
          result = result.filter((c) => c.tags?.includes(selectedTag))
        }
        break
    }

    result.sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'totalSp':
          comparison = a.totalSp - b.totalSp
          break
        case 'walletBalance':
          comparison = a.walletBalance - b.walletBalance
          break
        case 'lastFetchedAt': {
          const aTime = a.lastFetchedAt ? new Date(a.lastFetchedAt).getTime() : 0
          const bTime = b.lastFetchedAt ? new Date(b.lastFetchedAt).getTime() : 0
          comparison = aTime - bTime
          break
        }
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

    return result
  }, [characters, debouncedSearch, sortField, sortOrder, statusFilter, selectedTag, serverDriven])

  const staleCount = useMemo(
    () => characters.filter((c) => isStale(c.lastFetchedAt)).length,
    [characters]
  )
  const mainCount = useMemo(() => characters.filter((c) => c.isMain).length, [characters])

  const activeStatusPill: StatusPill | null =
    statusFilter === 'main' ? 'main' : statusFilter === 'stale' ? 'stale' : statusFilter === 'all' ? 'all' : null

  const activeFilterChips = useMemo(() => {
    const chips: { id: string; label: string; onRemove: () => void }[] = []

    if (searchInput.trim()) {
      chips.push({
        id: 'search',
        label: `${t('characters.filters.chipSearch')}: "${searchInput.trim()}"`,
        onRemove: () => setSearchInput(''),
      })
    }
    if (statusFilter === 'main') {
      chips.push({
        id: 'main',
        label: t('characters.filters.statusMain'),
        onRemove: () => handleStatusPill('all'),
      })
    }
    if (statusFilter === 'stale') {
      chips.push({
        id: 'stale',
        label: t('characters.filters.statusStale'),
        onRemove: () => handleStatusPill('all'),
      })
    }
    if (statusFilter === 'tag' && selectedTag) {
      chips.push({
        id: 'tag',
        label: `${t('characters.filters.chipTag')}: ${tagLabel(selectedTag, t)}`,
        onRemove: () => handleTagChip(null),
      })
    }
    if (!isDefaultSort(sortField, sortOrder)) {
      chips.push({
        id: 'sort',
        label: `${t('characters.filters.chipSort')}: ${getSortCombinedLabel(sortField, sortOrder, t)}`,
        onRemove: () => {
          setSortField('name')
          setSortOrder('asc')
        },
      })
    }

    return chips
  }, [searchInput, statusFilter, selectedTag, sortField, sortOrder, t])

  const hasActiveFilters = activeFilterChips.length > 0
  const sortAscendingLabel = t('characters.filters.sortAscending')
  const sortDescendingLabel = t('characters.filters.sortDescending')
  const sortTriggerLabel = `${t('characters.filters.sortCombined')}: ${getSortCombinedLabel(sortField, sortOrder, t)}`

  return (
    <div className="space-y-3">
      <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="hidden font-accent text-[10px] font-semibold uppercase tracking-[0.15em] text-ta-faint sm:block sm:w-full lg:w-auto">
            {t('characters.filters.panelTitle')}
          </p>
          <div className="relative min-w-0 flex-1 basis-full sm:basis-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ta-faint" />
            <Input
              placeholder={t('characters.filters.searchPlaceholder')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-[42px] rounded-[10px] border-white/[0.08] bg-ta-inset pl-10 text-ta-body placeholder:text-ta-faint"
              aria-label={t('characters.filters.searchAria')}
            />
          </div>
          {toolbarEnd}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 gap-1 border-eve-border bg-black/25 px-2 lg:hidden"
            onClick={() => setFiltersExpanded((v) => !v)}
            aria-expanded={filtersExpanded}
            aria-label={
              filtersExpanded
                ? t('characters.filters.collapseFilters')
                : t('characters.filters.expandFilters')
            }
          >
            <SlidersHorizontal className="h-4 w-4" />
            <ChevronDown
              className={cn('h-3.5 w-3.5 transition-transform', filtersExpanded && 'rotate-180')}
            />
          </Button>
          <p className="w-full text-right text-xs text-zinc-500 lg:hidden">
            {t('characters.filters.resultsCount', {
              shown: filteredCharacters.length,
              total: totalCount,
            })}
          </p>
        </div>

        <div
          className={cn(
            'mt-3 space-y-3 border-t border-eve-border/60 pt-3',
            filtersExpanded ? 'block' : 'hidden',
            'lg:block'
          )}
        >
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:gap-4">
            <div className="shrink-0 space-y-1.5 xl:min-w-[200px]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                {t('characters.filters.statusLabel')}
              </p>
              <div
                className="flex flex-wrap gap-1.5"
                role="group"
                aria-label={t('characters.filters.statusAria')}
              >
                <button
                  type="button"
                  onClick={() => handleStatusPill('all')}
                  className={pillClass(activeStatusPill === 'all')}
                  aria-pressed={activeStatusPill === 'all'}
                >
                  {t('characters.filters.statusAll', { count: totalCount })}
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusPill('main')}
                  className={pillClass(activeStatusPill === 'main')}
                  aria-pressed={activeStatusPill === 'main'}
                >
                  {t('characters.filters.statusMain', { count: mainCount })}
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusPill('stale')}
                  className={pillClass(activeStatusPill === 'stale')}
                  aria-pressed={activeStatusPill === 'stale'}
                >
                  {t('characters.filters.statusStale', { count: staleCount })}
                </button>
              </div>
            </div>

            {accountTags.length > 0 && (
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                  {t('characters.filters.activityTagsLabel')}
                </p>
                <div
                  className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin"
                  role="group"
                  aria-label={t('characters.filters.tagChipsAria')}
                >
                  <button
                    type="button"
                    onClick={() => handleTagChip(null)}
                    aria-pressed={statusFilter !== 'tag' || !selectedTag}
                    className={pillClass(statusFilter !== 'tag' || !selectedTag)}
                  >
                    {t('characters.filters.tagChipsAll')}
                  </button>
                  {accountTags.map(({ name, count }) => {
                    const active = statusFilter === 'tag' && selectedTag === name
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => handleTagChip(name)}
                        aria-pressed={active}
                        className={pillClass(active)}
                      >
                        {tagLabel(name, t)} ({count})
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={sortField} onValueChange={(v) => handleSortChange(v as SortField)}>
                <SelectTrigger
                  className="h-8 min-w-[140px] border-eve-border bg-black/25 text-xs sm:min-w-[180px]"
                  aria-label={sortTriggerLabel}
                >
                  <ArrowUpDown className="mr-2 h-3.5 w-3.5 shrink-0" />
                  <SelectValue>{getSortCombinedLabel(sortField, sortOrder, t)}</SelectValue>
                </SelectTrigger>
                <SelectContent className="border-eve-border bg-eve-panel">
                  <SelectItem value="name" className="text-white">
                    {t('characters.filters.sortName')}
                  </SelectItem>
                  <SelectItem value="totalSp" className="text-white">
                    {t('characters.filters.sortSp')}
                  </SelectItem>
                  <SelectItem value="walletBalance" className="text-white">
                    {t('characters.filters.sortIsk')}
                  </SelectItem>
                  <SelectItem value="lastFetchedAt" className="text-white">
                    {t('characters.filters.sortLastUpdate')}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-eve-border bg-black/25"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                title={sortOrder === 'asc' ? sortAscendingLabel : sortDescendingLabel}
                aria-label={sortOrder === 'asc' ? sortAscendingLabel : sortDescendingLabel}
              >
                <ArrowUpDown
                  className={cn('h-4 w-4 transition-transform', sortOrder === 'asc' && 'rotate-180')}
                />
              </Button>
            </div>
            <p className="hidden text-xs text-zinc-500 lg:block">
              {t('characters.filters.resultsCount', {
                shown: filteredCharacters.length,
                total: totalCount,
              })}
              {serverDriven && hasActiveFilters && (
                <span className="ml-1 text-zinc-600">· {t('characters.filters.serverScopeHint')}</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-eve-accent/20 bg-eve-accent/5 px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-eve-accent/80">
            {t('characters.filters.activeFiltersLabel')}
          </span>
          {activeFilterChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={chip.onRemove}
              className="inline-flex items-center gap-1 rounded-full border border-eve-accent/30 bg-black/30 px-2.5 py-1 text-xs text-zinc-200 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
              aria-label={t('characters.filters.removeFilter')}
            >
              {chip.label}
              <X className="h-3 w-3 opacity-60" />
            </button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-zinc-400 hover:text-white"
            onClick={handleClearFilters}
          >
            {t('characters.filters.clearAll')}
          </Button>
        </div>
      )}

      {children(filteredCharacters)}
    </div>
  )
}
