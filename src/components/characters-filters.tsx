'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, ArrowUpDown, Filter, X } from 'lucide-react'
import type { CharacterListItem } from '@/types/character'
import { useTranslations } from '@/i18n/hooks'

type SortField = 'name' | 'totalSp' | 'walletBalance' | 'lastFetchedAt'
type SortOrder = 'asc' | 'desc'
type StatusFilter = 'all' | 'stale' | 'main' | 'tag'

interface CharactersFiltersProps {
  characters: CharacterListItem[]
  children: (filtered: CharacterListItem[]) => React.ReactNode
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

function isStale(lastFetchedAt: Date | string | null | undefined): boolean {
  if (!lastFetchedAt) return true
  const staleThreshold = 5 * 60 * 1000
  return Date.now() - new Date(lastFetchedAt).getTime() > staleThreshold
}

export function CharactersFilters({ characters, children }: CharactersFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslations()

  const initialSearch = searchParams.get('search') || ''
  const initialSort = (searchParams.get('sort') || 'name') as SortField
  const initialOrder = (searchParams.get('order') || 'desc') as SortOrder
  const initialStatus = (searchParams.get('status') || 'all') as StatusFilter

  const [searchInput, setSearchInput] = useState(initialSearch)
  const [sortField, setSortField] = useState<SortField>(initialSort)
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialOrder)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus)
  const [selectedTag, setSelectedTag] = useState<string>('')

  const debouncedSearch = useDebounce(searchInput, 300)

  useEffect(() => {
    if (statusFilter !== 'tag') {
      setSelectedTag('')
    }
  }, [statusFilter])

  const updateURL = useCallback(
    (search: string, sort: SortField, order: SortOrder, status: StatusFilter) => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (sort !== 'name' || order !== 'desc') {
        params.set('sort', sort)
        params.set('order', order)
      }
      if (status !== 'all') params.set('status', status)
      router.push(`?${params.toString()}`, { scroll: false })
    },
    [router]
  )

  useEffect(() => {
    updateURL(debouncedSearch, sortField, sortOrder, statusFilter)
  }, [debouncedSearch, sortField, sortOrder, statusFilter, updateURL])

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
    setSortOrder('desc')
    setStatusFilter('all')
    setSelectedTag('')
    router.push('', { scroll: false })
  }

  const filteredCharacters = useMemo(() => {
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
  }, [characters, debouncedSearch, sortField, sortOrder, statusFilter, selectedTag])

  const staleCount = useMemo(
    () => characters.filter((c) => isStale(c.lastFetchedAt)).length,
    [characters]
  )
  const mainCount = useMemo(() => characters.filter((c) => c.isMain).length, [characters])

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    characters.forEach((c) => {
      if (c.tags) {
        c.tags.forEach((tag: string) => tags.add(tag))
      }
    })
    return Array.from(tags)
  }, [characters])

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    characters.forEach((c) => {
      if (c.tags) {
        c.tags.forEach((tag: string) => {
          counts[tag] = (counts[tag] || 0) + 1
        })
      }
    })
    return counts
  }, [characters])

  const hasActiveFilters =
    Boolean(searchInput) ||
    sortField !== 'name' ||
    sortOrder !== 'desc' ||
    statusFilter !== 'all'

  const sortAscendingLabel = t('characters.filters.sortAscending')
  const sortDescendingLabel = t('characters.filters.sortDescending')

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={t('characters.filters.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10 bg-eve-panel border-eve-border text-white placeholder:text-gray-500"
            aria-label={t('characters.filters.searchAria')}
          />
        </div>

        <div className="flex gap-2">
          <Select value={sortField} onValueChange={(v) => handleSortChange(v as SortField)}>
            <SelectTrigger
              className="w-[140px] bg-eve-panel border-eve-border"
              aria-label={t('characters.filters.sortFieldAria')}
            >
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-eve-panel border-eve-border">
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
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="bg-eve-panel border-eve-border hover:bg-eve-border"
            title={sortOrder === 'asc' ? sortAscendingLabel : sortDescendingLabel}
            aria-label={sortOrder === 'asc' ? sortAscendingLabel : sortDescendingLabel}
          >
            <ArrowUpDown className={`h-4 w-4 transition-transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
          </Button>

          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v as StatusFilter)
              if (v !== 'tag') setSelectedTag('')
            }}
          >
            <SelectTrigger
              className="w-[140px] bg-eve-panel border-eve-border"
              aria-label={t('characters.filters.statusAria')}
            >
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-eve-panel border-eve-border">
              <SelectItem value="all" className="text-white">
                {t('characters.filters.allCount', { count: characters.length })}
              </SelectItem>
              <SelectItem value="stale" className="text-white">
                {t('characters.filters.staleCount', { count: staleCount })}
              </SelectItem>
              <SelectItem value="main" className="text-white">
                {t('characters.filters.mainCount', { count: mainCount })}
              </SelectItem>
              {allTags.length > 0 && (
                <SelectItem value="tag" className="text-white">
                  {t('characters.filters.tags')}
                </SelectItem>
              )}
            </SelectContent>
          </Select>

          {statusFilter === 'tag' && (
            <Select value={selectedTag} onValueChange={setSelectedTag}>
              <SelectTrigger
                className="w-[140px] bg-eve-panel border-eve-border"
                aria-label={t('characters.filters.selectTagAria')}
              >
                <SelectValue placeholder={t('characters.filters.selectTagPlaceholder')} />
              </SelectTrigger>
              <SelectContent className="bg-eve-panel border-eve-border">
                {allTags.map((tag) => (
                  <SelectItem key={tag} value={tag} className="text-white">
                    {tag} ({tagCounts[tag]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {hasActiveFilters && (
            <Button
              variant="outline"
              size="icon"
              onClick={handleClearFilters}
              className="bg-eve-panel border-eve-border hover:bg-eve-border"
              title={t('characters.filters.clearTitle')}
              aria-label={t('characters.filters.clearAria')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {children(filteredCharacters)}
    </div>
  )
}
