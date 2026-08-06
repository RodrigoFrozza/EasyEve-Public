'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/i18n/hooks'
import { cn } from '@/lib/utils'

interface Character {
  id: number
  name: string
  totalSp: number
  walletBalance: number
  location: string | null
  ship: string | null
}

interface CharactersCompactProps {
  characters: Character[]
  mainCharacterId?: number
}

export function CharactersCompact({ characters: rawCharacters, mainCharacterId }: CharactersCompactProps) {
  const { t } = useTranslations()
  const characters = (rawCharacters || []).filter(Boolean)

  return (
    <div className="overflow-hidden rounded-sm border border-eve-border bg-eve-dark/60 font-accent">
      <div className="flex items-center justify-between border-b border-eve-border/40 px-3 py-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-eve-muted">
          {t('characters.title')}
        </h3>
        <Link href="/dashboard/characters">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] text-eve-accent hover:bg-eve-accent/10 hover:text-eve-accent"
          >
            {t('common.viewAll')}
          </Button>
        </Link>
      </div>
      <div className="p-3">
        {characters.length === 0 ? (
          <div className="rounded-sm border border-dashed border-eve-border/40 py-4 text-center">
            <p className="text-[10px] text-eve-muted">{t('characters.noCharacters')}</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {characters.map((char) => {
              if (!char) return null
              const isMain = char.id === mainCharacterId
              return (
                <Link
                  key={char.id}
                  href="/dashboard/characters"
                  className="relative"
                  title={char.name}
                >
                  <Avatar
                    className={cn(
                      'h-9 w-9 rounded-sm border bg-eve-panel transition-opacity hover:opacity-100',
                      isMain
                        ? 'border-eve-accent/50 opacity-100'
                        : 'border-eve-border/40 opacity-70 hover:border-eve-border'
                    )}
                  >
                    <AvatarImage
                      src={`https://images.evetech.net/characters/${char.id}/portrait?size=64`}
                      className="rounded-sm object-cover"
                    />
                    <AvatarFallback className="rounded-sm bg-eve-dark text-[10px] text-eve-muted">
                      {char.name?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>
                  {isMain && (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-eve-dark bg-eve-accent"
                      aria-hidden
                    />
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
