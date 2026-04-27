'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/i18n/hooks'

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

export function CharactersCompact({ characters, mainCharacterId }: CharactersCompactProps) {
  const { t } = useTranslations()

  return (
    <Card className="bg-eve-panel border-eve-border">
      <CardHeader className="flex flex-row items-center justify-between py-2 px-3 space-y-0">
        <CardTitle className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500">{t('characters.title')}</CardTitle>
        <Link href="/dashboard/characters">
          <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[9px] text-zinc-500 hover:text-white hover:bg-white/5 border-none">
            {t('common.viewAll') || 'View All'}
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="pb-3 px-3">
        {characters.length === 0 ? (
          <p className="text-gray-500 text-xs py-2">{t('characters.noCharacters')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {characters.map((char) => (
              <div key={char.id} className="relative group cursor-pointer" title={char.name}>
                <Avatar className={`h-8 w-8 shrink-0 transition-transform group-hover:scale-110 ${char.id === mainCharacterId ? 'ring-2 ring-cyan-500 ring-offset-1 ring-offset-zinc-900 border-none' : 'border border-white/10'}`}>
                  <AvatarImage src={`https://images.evetech.net/characters/${char.id}/portrait?size=64`} />
                  <AvatarFallback className="text-[10px] bg-zinc-900">{char.name[0]}</AvatarFallback>
                </Avatar>
                {char.id === mainCharacterId && (
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-cyan-500 rounded-full border border-zinc-900" title="Main Character" />
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
