'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import {
  MoreVertical,
  Star,
  RefreshCw,
  List,
  Shield,
  UserRound,
} from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'
import { useCharacterData } from '@/lib/hooks/use-esi'
import { apiClient } from '@/lib/api-error'
import { CharacterScopesDialog } from '@/components/character-actions/CharacterScopesDialog'
import { RemoveCharacterMenuItem } from '@/components/character-actions/RemoveCharacterMenuItem'
import { cn } from '@/lib/utils'
import type { CharacterListItem } from '@/types/character'

interface CharacterListRowMenuProps {
  character: CharacterListItem
  accountCode: string
}

export function CharacterListRowMenu({ character, accountCode }: CharacterListRowMenuProps) {
  const { t } = useTranslations()
  const router = useRouter()
  const { refresh, isRefreshing } = useCharacterData(character.id)
  const [setMainLoading, setSetMainLoading] = useState(false)
  const [scopesOpen, setScopesOpen] = useState(false)

  const scopes = character.scopes ?? []

  async function handleSetMain() {
    if (character.isMain || setMainLoading) return
    setSetMainLoading(true)
    try {
      const { error } = await apiClient.post(
        '/api/characters/set-main',
        { characterId: character.id },
        { showToast: true }
      )
      if (!error) router.refresh()
    } catch (error) {
      console.error('Set main error:', error)
    } finally {
      setSetMainLoading(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-[30px] w-[30px] shrink-0 rounded-[7px] border-white/[0.08] bg-transparent text-ta-muted hover:border-eve-accent/40 hover:text-eve-accent"
            aria-label={t('characters.listRow.actions')}
          >
            <MoreVertical className="h-[14px] w-[14px]" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 border-eve-border bg-eve-panel">
          <DropdownMenuItem
            className="cursor-pointer"
            disabled={character.isMain || setMainLoading}
            onSelect={(e) => {
              e.preventDefault()
              void handleSetMain()
            }}
          >
            <Star className="mr-2 h-4 w-4 text-eve-accent" />
            {character.isMain ? t('characters.mainBadge') : t('characters.setMain')}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            disabled={isRefreshing}
            onSelect={(e) => {
              e.preventDefault()
              void refresh()
            }}
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', isRefreshing && 'animate-spin')} />
            {t('characters.refresh')}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={(e) => {
              e.preventDefault()
              setScopesOpen(true)
            }}
          >
            <List className="mr-2 h-4 w-4" />
            {t('characters.listRow.scopes')}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => {
              router.push(`/dashboard/characters/${character.id}`)
            }}
          >
            <UserRound className="mr-2 h-4 w-4" />
            {t('characters.viewProfile')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => {
              router.push(`/link-character?accountCode=${encodeURIComponent(accountCode)}`)
            }}
          >
            <Shield className="mr-2 h-4 w-4" />
            {t('characters.reAuthorize')}
          </DropdownMenuItem>
          {!character.isMain && (
            <>
              <DropdownMenuSeparator />
              <RemoveCharacterMenuItem characterId={character.id} />
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <CharacterScopesDialog
        scopes={scopes}
        esiApp={character.esiApp}
        open={scopesOpen}
        onOpenChange={setScopesOpen}
        hideTrigger
      />
    </>
  )
}
