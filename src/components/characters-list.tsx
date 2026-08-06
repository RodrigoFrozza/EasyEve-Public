'use client'

import { useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { CharacterCard } from './character-card'
import { CharactersTable, type CharactersGroupBy } from './characters/CharactersTable'
import { CharactersFilters } from './characters-filters'
import { Button } from '@/components/ui/button'
import { Rows3, Grid3X3, AlignJustify, LayoutList } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CharacterListItem } from '@/types/character'
import { useTranslations } from '@/i18n/hooks'
import { useState } from 'react'

const PAGE_SIZE = 25

interface CharactersApiPage {
  items: CharacterListItem[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

interface CharactersPaginationState {
  total: number
}

interface CharactersListProps {
  characters: CharacterListItem[]
  totalCount?: number
  accountCode: string
}

/** Teal Aurora segmented control (icon variant). */
function ViewModeToggle({
  viewMode,
  onChange,
}: {
  viewMode: 'grid' | 'list'
  onChange: (mode: 'grid' | 'list') => void
}) {
  const { t } = useTranslations()
  return (
    <div
      className="flex items-center overflow-hidden rounded-[9px] border border-white/10 bg-ta-inset"
      role="group"
      aria-label={t('characters.title')}
    >
      <button
        type="button"
        onClick={() => onChange('list')}
        className={cn(
          'flex h-[34px] w-[38px] items-center justify-center transition-colors',
          viewMode === 'list'
            ? 'ta-cta rounded-none'
            : 'text-ta-secondary hover:text-white'
        )}
        aria-pressed={viewMode === 'list'}
        aria-label={t('characters.viewTableAria')}
        title={t('characters.viewTableAria')}
      >
        <Rows3 className="h-4 w-4" />
      </button>
      <span className="h-[34px] w-px bg-white/10" />
      <button
        type="button"
        onClick={() => onChange('grid')}
        className={cn(
          'flex h-[34px] w-[38px] items-center justify-center transition-colors',
          viewMode === 'grid'
            ? 'ta-cta rounded-none'
            : 'text-ta-secondary hover:text-white'
        )}
        aria-pressed={viewMode === 'grid'}
        aria-label={t('characters.viewGridAria')}
        title={t('characters.viewGridAria')}
      >
        <Grid3X3 className="h-4 w-4" />
      </button>
    </div>
  )
}

/** Teal Aurora "All | By role" segmented toggle for the table view. */
function GroupToggle({
  groupBy,
  onChange,
}: {
  groupBy: CharactersGroupBy
  onChange: (g: CharactersGroupBy) => void
}) {
  const { t } = useTranslations()
  const seg = (active: boolean, label: string, icon: React.ReactNode, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-[34px] items-center gap-[7px] px-[13px] font-accent text-[12.5px] font-semibold transition-colors',
        active ? 'ta-cta rounded-none' : 'text-ta-secondary hover:text-white'
      )}
      aria-pressed={active}
    >
      {icon}
      {label}
    </button>
  )
  return (
    <div className="flex items-center overflow-hidden rounded-[9px] border border-white/10 bg-ta-inset">
      {seg(groupBy === 'flat', t('characters.groupAll'), <AlignJustify className="h-3.5 w-3.5" />, () => onChange('flat'))}
      <span className="h-[34px] w-px bg-white/10" />
      {seg(groupBy === 'byRole', t('characters.groupByRole'), <LayoutList className="h-3.5 w-3.5" />, () => onChange('byRole'))}
    </div>
  )
}

export function CharactersList({ characters, totalCount, accountCode }: CharactersListProps) {
  const { t } = useTranslations()
  const searchParams = useSearchParams()
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [groupBy, setGroupBy] = useState<CharactersGroupBy>('flat')
  const resolvedTotalCount = totalCount ?? characters.length
  const filtersKey = searchParams.toString()
  const hasActiveServerFilters = Boolean(filtersKey)

  const queryParams = useMemo(() => {
    const params = new URLSearchParams(filtersKey)
    params.set('limit', `${PAGE_SIZE}`)
    return params
  }, [filtersKey])

  const paginatedCharactersQuery = useInfiniteQuery<CharactersApiPage>({
    queryKey: ['characters', 'paginated', PAGE_SIZE, filtersKey],
    queryFn: async ({ pageParam, signal }) => {
      const params = new URLSearchParams(queryParams)
      params.set('page', `${pageParam}`)
      const response = await fetch(`/api/characters?${params.toString()}`, { signal })
      if (!response.ok) {
        throw new Error(`Failed to fetch characters page ${pageParam}`)
      }
      return response.json()
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const nextPage = lastPage.pagination.page + 1
      return nextPage <= lastPage.pagination.pages ? nextPage : undefined
    },
    ...(hasActiveServerFilters
      ? {}
      : {
          initialData: {
            pageParams: [1],
            pages: [
              {
                items: characters,
                pagination: {
                  page: 1,
                  limit: PAGE_SIZE,
                  total: resolvedTotalCount,
                  pages: Math.max(1, Math.ceil(resolvedTotalCount / PAGE_SIZE)),
                },
              },
            ],
          },
        }),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const loadedCharacters = useMemo(
    () => paginatedCharactersQuery.data?.pages.flatMap((page) => page.items) ?? characters,
    [paginatedCharactersQuery.data?.pages, characters]
  )
  const paginationState = useMemo<CharactersPaginationState | null>(() => {
    const lastPage = paginatedCharactersQuery.data?.pages.at(-1)
    if (!lastPage) return null
    return { total: lastPage.pagination.total }
  }, [paginatedCharactersQuery.data?.pages])

  return (
    <CharactersFilters
      characters={loadedCharacters}
      totalFromServer={paginationState?.total ?? resolvedTotalCount}
      serverDriven
      toolbarEnd={
        <div className="flex items-center gap-2">
          {viewMode === 'list' && <GroupToggle groupBy={groupBy} onChange={setGroupBy} />}
          <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
        </div>
      }
    >
      {(filteredCharacters) => (
        <PaginatedCharacterView
          filteredCharacters={filteredCharacters}
          viewMode={viewMode}
          groupBy={groupBy}
          accountCode={accountCode}
          onLoadMore={() => paginatedCharactersQuery.fetchNextPage()}
          canLoadMore={Boolean(paginatedCharactersQuery.hasNextPage)}
          loadingMore={paginatedCharactersQuery.isFetchingNextPage}
          hasServerFilters={hasActiveServerFilters}
          totalFromServer={paginationState?.total ?? resolvedTotalCount}
        />
      )}
    </CharactersFilters>
  )
}

function PaginatedCharacterView({
  filteredCharacters,
  viewMode,
  groupBy,
  accountCode,
  onLoadMore,
  canLoadMore,
  loadingMore,
  hasServerFilters,
  totalFromServer,
}: {
  filteredCharacters: CharacterListItem[]
  viewMode: 'grid' | 'list'
  groupBy: CharactersGroupBy
  accountCode: string
  onLoadMore: () => void
  canLoadMore: boolean
  loadingMore: boolean
  hasServerFilters: boolean
  totalFromServer: number
}) {
  const { t } = useTranslations()
  const showFilteredEmpty = hasServerFilters && totalFromServer === 0

  if (showFilteredEmpty) {
    return (
      <div className="ta-panel p-6 text-center">
        <p className="text-sm text-ta-body">{t('characters.filters.emptyResultTitle')}</p>
        <p className="mt-1 text-xs text-ta-muted">{t('characters.filters.emptyResultDescription')}</p>
      </div>
    )
  }

  return (
    <>
      {viewMode === 'grid' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCharacters.map((char) => (
            <CharacterCard key={char.id} character={char} accountCode={accountCode} />
          ))}
        </div>
      ) : (
        <CharactersTable
          characters={filteredCharacters}
          accountCode={accountCode}
          groupBy={groupBy}
        />
      )}
      {canLoadMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="rounded-[9px] border-white/10 bg-ta-inset text-ta-secondary hover:border-eve-accent/40 hover:text-eve-accent"
          >
            {loadingMore ? t('characters.loadMoreLoading') : t('characters.loadMore')}
          </Button>
        </div>
      )}
    </>
  )
}
