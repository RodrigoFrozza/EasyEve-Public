'use client'

import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { CharacterCard } from './character-card'
import { FormattedNumber } from './shared/FormattedNumber'
import { CharactersFilters } from './characters-filters'
import { Button } from '@/components/ui/button'
import { List, Grid3X3 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { CharacterListItem } from '@/types/character'
import { useTranslations } from '@/i18n/hooks'
import { formatISK } from '@/lib/utils'

const PAGE_SIZE = 12

interface CharactersListProps {
  characters: CharacterListItem[]
  accountCode: string
}

export function CharactersList({ characters, accountCode }: CharactersListProps) {
  const { t } = useTranslations()
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setViewMode('list')
    }
  }, [])

  const resetVisible = () => setVisibleCount(PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="flex gap-1 bg-eve-dark/50 p-1 rounded-lg border border-eve-border" role="group" aria-label={t('characters.title')}>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setViewMode('grid')
              resetVisible()
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
              resetVisible()
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
      <CharactersFilters characters={characters}>
        {(filteredCharacters) => (
          <PaginatedCharacterView
            filteredCharacters={filteredCharacters}
            viewMode={viewMode}
            accountCode={accountCode}
            visibleCount={visibleCount}
            setVisibleCount={setVisibleCount}
            pageSize={PAGE_SIZE}
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
  visibleCount,
  setVisibleCount,
  pageSize,
}: {
  filteredCharacters: CharacterListItem[]
  viewMode: 'grid' | 'list'
  accountCode: string
  visibleCount: number
  setVisibleCount: Dispatch<SetStateAction<number>>
  pageSize: number
}) {
  const { t } = useTranslations()
  const filterSignature = filteredCharacters.map((c) => c.id).join(',')

  useEffect(() => {
    setVisibleCount(pageSize)
  }, [filterSignature, pageSize, setVisibleCount])

  const slice = useMemo(
    () => filteredCharacters.slice(0, Math.min(visibleCount, filteredCharacters.length)),
    [filteredCharacters, visibleCount]
  )
  const canLoadMore = visibleCount < filteredCharacters.length

  return (
    <>
      {viewMode === 'grid' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {slice.map((char) => (
            <CharacterCard key={char.id} character={char} accountCode={accountCode} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {slice.map((char) => (
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
          <Button variant="outline" size="sm" onClick={() => setVisibleCount((c) => c + pageSize)}>
            {t('characters.loadMore')}
          </Button>
        </div>
      )}
    </>
  )
}
