'use client'

import { useEffect, useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { CharacterCard } from './character-card'
import { FormattedNumber } from './shared/FormattedNumber'
import { CharactersFilters } from './characters-filters'
import { Button } from '@/components/ui/button'
import { List, Grid3X3 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { CharacterListItem } from '@/types/character'
import { useTranslations } from '@/i18n/hooks'
import { formatISK } from '@/lib/utils'

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

export function CharactersList({ characters, totalCount, accountCode }: CharactersListProps) {
  const { t } = useTranslations()
  const searchParams = useSearchParams()
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const resolvedTotalCount = totalCount ?? characters.length
  const filtersKey = searchParams.toString()
  const hasActiveServerFilters = Boolean(filtersKey)

  const queryParams = useMemo(() => {
    const params = new URLSearchParams(filtersKey)
    params.set('limit', `${PAGE_SIZE}`)
    return params
  }, [filtersKey])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setViewMode('list')
    }
  }, [])

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
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="flex gap-1 bg-eve-dark/50 p-1 rounded-lg border border-eve-border" role="group" aria-label={t('characters.title')}>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setViewMode('grid')
            }}
            className={viewMode === 'grid' ? 'bg-eve-accent text-black' : 'text-gray-400'}
            aria-pressed={viewMode === 'grid'}
            aria-label={t('characters.viewGridAria')}
            title={t('characters.viewGridAria')}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setViewMode('list')
            }}
            className={viewMode === 'list' ? 'bg-eve-accent text-black' : 'text-gray-400'}
            aria-pressed={viewMode === 'list'}
            aria-label={t('characters.viewListAria')}
            title={t('characters.viewListAria')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <CharactersFilters characters={loadedCharacters} serverDriven>
        {(filteredCharacters) => (
          <PaginatedCharacterView
            filteredCharacters={filteredCharacters}
            viewMode={viewMode}
            accountCode={accountCode}
            onLoadMore={() => paginatedCharactersQuery.fetchNextPage()}
            canLoadMore={Boolean(paginatedCharactersQuery.hasNextPage)}
            loadingMore={paginatedCharactersQuery.isFetchingNextPage}
            hasServerFilters={hasActiveServerFilters}
            totalFromServer={paginationState?.total ?? resolvedTotalCount}
          />
        )}
      </CharactersFilters>
    </div>
  )
}

function PaginatedCharacterView({
  filteredCharacters,
  viewMode,
  accountCode,
  onLoadMore,
  canLoadMore,
  loadingMore,
  hasServerFilters,
  totalFromServer,
}: {
  filteredCharacters: CharacterListItem[]
  viewMode: 'grid' | 'list'
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
      <div className="rounded-lg border border-eve-border bg-eve-panel p-6 text-center">
        <p className="text-sm text-zinc-300">{t('characters.filters.emptyResultTitle')}</p>
        <p className="mt-1 text-xs text-zinc-500">{t('characters.filters.emptyResultDescription')}</p>
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
        <div className="space-y-2">
          {filteredCharacters.map((char) => (
            <div
              key={char.id}
              className="bg-eve-panel border border-eve-border rounded-lg p-3 flex items-center gap-4"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={`https://images.evetech.net/characters/${char.id}/portrait?size=128`} />
                <AvatarFallback>{char.name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-white font-bold">{char.name}</p>
                <p className="text-xs text-gray-500">
                  {char.isMain ? t('characters.listMainLabel') : t('characters.listAltLabel')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">
                  {t('characters.listSpPrefix')} <FormattedNumber value={char.totalSp} />
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-green-400">{formatISK(char.walletBalance)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {canLoadMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? t('characters.loadMoreLoading') : t('characters.loadMore')}
          </Button>
        </div>
      )}
    </>
  )
}
