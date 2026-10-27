'use client'

import { useMemo } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CharacterTagsRow } from './CharacterTagsRow'
import { CharacterListRowMenu } from './CharacterListRowMenu'
import { formatSP, formatISK, cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { useCorporationInfo } from '@/lib/hooks/use-corporation-info'
import { useTokenStatus } from '@/lib/hooks/use-token-status'
import {
  getCharacterAccentClass,
  getCharacterPortraitRingClass,
} from '@/lib/characters/character-status-accent'
import { AlertTriangle, Building2, MapPin, Ship, Zap, Wallet } from 'lucide-react'
import type { CharacterListItem } from '@/types/character'

interface CharacterListRowProps {
  character: CharacterListItem
  accountCode: string
}

function MetricPill({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ElementType
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-black/25 px-2.5 py-1">
      <Icon className="h-3 w-3 text-zinc-500" />
      <span className="text-[10px] text-zinc-500">{label}</span>
      <span className={cn('text-xs font-bold tabular-nums', valueClassName ?? 'text-zinc-200')}>
        {value}
      </span>
    </div>
  )
}

export function CharacterListRow({ character, accountCode }: CharacterListRowProps) {
  const { t } = useTranslations()
  const { data: corpInfo } = useCorporationInfo(character.corporationId)
  const { tokenInvalid } = useTokenStatus(character.tokenExpiresAt)

  const tags = useMemo(() => character.tags ?? [], [character.tags])
  const accentInput = {
    isMain: character.isMain,
    tokenExpiresAt: character.tokenExpiresAt,
    lastFetchedAt: character.lastFetchedAt,
  }

  const locationShipMeta = [character.location, character.ship].filter(Boolean).join(' · ')
  const spFormatted = formatSP(character.totalSp)
  const iskFormatted = formatISK(character.walletBalance)

  return (
    <div
      className={cn(
        'group/row overflow-hidden rounded-lg border border-eve-border bg-eve-panel transition-colors',
        'hover:border-zinc-600/70 hover:bg-white/[0.03]',
        getCharacterAccentClass(accentInput)
      )}
    >
      <div className="flex items-stretch gap-2 p-3">
        <Avatar className={cn('h-11 w-11 shrink-0', getCharacterPortraitRingClass(accentInput))}>
          <AvatarImage
            src={`https://images.evetech.net/characters/${character.id}/portrait?size=128`}
          />
          <AvatarFallback>{character.name[0]}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-1">
            <p className="min-w-0 truncate font-bold text-white">{character.name}</p>
            {character.isMain && (
              <Badge variant="eve" className="shrink-0 text-[10px]">
                {t('characters.mainBadge')}
              </Badge>
            )}
            {corpInfo && (
              <span className="flex shrink-0 items-center gap-1 text-xs text-amber-400">
                <Building2 className="h-3 w-3" />
                [{corpInfo.ticker || 'CORP'}]
              </span>
            )}
            {tokenInvalid && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex shrink-0 text-red-400"
                      aria-label={t('global.tokenExpiredReLogin')}
                    >
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs border-eve-border bg-eve-panel text-xs">
                    {t('global.tokenExpiredReLogin')}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {locationShipMeta && (
            <p className="flex max-w-full items-center gap-1 truncate text-xs text-zinc-500">
              {character.location && <MapPin className="h-3 w-3 shrink-0" />}
              {character.ship && !character.location && <Ship className="h-3 w-3 shrink-0" />}
              <span className="truncate">{locationShipMeta}</span>
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <MetricPill icon={Zap} label="SP" value={spFormatted} />
            <MetricPill icon={Wallet} label="ISK" value={iskFormatted} valueClassName="text-emerald-400" />
          </div>
        </div>

        <div className="flex shrink-0 items-start pt-0.5">
          <CharacterListRowMenu character={character} accountCode={accountCode} />
        </div>
      </div>

      <div className="border-t border-eve-border/50 bg-black/20 px-3 py-2">
        <CharacterTagsRow characterId={character.id} tags={tags} compact showQuickAdd />
      </div>
    </div>
  )
}
