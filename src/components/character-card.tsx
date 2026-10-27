'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { formatSP, formatISK, cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import {
  MapPin,
  Ship,
  Zap,
  Wallet,
  AlertTriangle,
  Building2,
  MoreVertical,
  Shield,
  RefreshCw,
  UserRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  RefreshCharacterButton,
  SetMainButton,
  CharacterScopesDialog,
  RemoveCharacterMenuItem,
} from '@/components/character-actions'
import { CharacterTagsRow } from '@/components/characters/CharacterTagsRow'
import { CharacterMetricTile } from '@/components/characters/CharacterMetricTile'
import { TimeAgo } from '@/components/time-ago'
import { CharacterCardSkeleton } from '@/components/character-card-skeleton'
import { useCharacterData } from '@/lib/hooks/use-esi'
import { useTokenStatus } from '@/lib/hooks/use-token-status'
import { useCorporationInfo } from '@/lib/hooks/use-corporation-info'
import {
  getCharacterAccentClass,
  getCharacterPortraitRingClass,
  getCharacterShellHoverClass,
} from '@/lib/characters/character-status-accent'
import type { CharacterListItem } from '@/types/character'

export function CharacterCard({
  character: initialData,
  accountCode,
  detailed = false,
}: {
  character: CharacterListItem
  accountCode: string
  detailed?: boolean
}) {
  const { t } = useTranslations()
  const router = useRouter()

  const { data: corpInfo } = useCorporationInfo(initialData.corporationId)
  const { data: character, isRefreshing, isFetching } = useCharacterData(initialData.id, initialData)

  const char = useMemo((): CharacterListItem => {
    const base = (character ?? initialData) as CharacterListItem
    return {
      ...base,
      scopes: base.scopes ?? [],
      tags: base.tags ?? [],
    }
  }, [character, initialData])

  const { tokenInvalid } = useTokenStatus(char.tokenExpiresAt)
  const accentInput = {
    isMain: char.isMain,
    tokenExpiresAt: char.tokenExpiresAt,
    lastFetchedAt: char.lastFetchedAt,
  }

  if (isFetching && !character) {
    return <CharacterCardSkeleton />
  }

  return (
    <Card
      className={cn(
        'group relative overflow-hidden border-eve-border bg-eve-panel',
        getCharacterAccentClass(accentInput),
        getCharacterShellHoverClass(),
        char.isMain && 'ring-1 ring-eve-accent/30'
      )}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-eve-accent/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-60"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.04)_0%,transparent_45%)]"
        aria-hidden
      />

      <CardHeader className="relative z-10 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className={cn('h-12 w-12', getCharacterPortraitRingClass(accentInput))}>
              <AvatarImage src={`https://images.evetech.net/characters/${char.id}/portrait?size=128`} />
              <AvatarFallback>{char.name[0]}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg text-white">{char.name}</CardTitle>
                {char.isMain && <Badge variant="eve">{t('characters.mainBadge')}</Badge>}
              </div>
              <div className="flex items-center gap-2 text-sm">
                {corpInfo && (
                  <>
                    <Building2 className="h-3 w-3 text-amber-400" />
                    <span className="text-amber-400">[{corpInfo.ticker || 'CORP'}]</span>
                  </>
                )}
                <span className="text-eve-muted">{t('characters.characterId', { id: char.id })}</span>
              </div>
            </div>
          </div>
        </div>
        {tokenInvalid && (
          <div className="flex flex-col gap-2 rounded-sm border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{t('global.tokenExpiredReLogin')}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-1 w-full border-red-500/30 text-red-400 hover:bg-red-500/20"
              onClick={() => {
                router.push(`/link-character?accountCode=${encodeURIComponent(accountCode)}`)
              }}
            >
              <Shield className="mr-2 h-4 w-4" />
              {t('characters.reAuthorize')}
            </Button>
          </div>
        )}
        {isRefreshing && (
          <div className="flex items-center gap-2 rounded-sm border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-sm text-blue-400">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>{t('characters.syncingSession')}</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="relative z-10 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <CharacterMetricTile
            icon={Zap}
            label={t('characters.spLabel')}
            value={formatSP(char.totalSp)}
            iconClassName="text-eve-accent"
          />
          <CharacterMetricTile
            icon={Wallet}
            label={t('characters.iskLabel')}
            value={formatISK(char.walletBalance)}
            iconClassName="text-emerald-400"
            valueClassName="text-emerald-400"
          />
          {char.location && (
            <CharacterMetricTile
              icon={MapPin}
              label={t('characters.locationLabel')}
              value={char.location}
              iconClassName="text-blue-400"
              className="col-span-2"
            />
          )}
          {char.ship && (
            <CharacterMetricTile
              icon={Ship}
              label={t('characters.shipLabel')}
              value={char.ship}
              iconClassName="text-purple-400"
              className="col-span-2"
            />
          )}
        </div>

        <div className="rounded-md bg-black/15 p-2">
          <CharacterTagsRow characterId={char.id} tags={char.tags} showSectionLabel />
        </div>

        {detailed && (
          <div className="border-t border-eve-border pt-4">
            <p className="text-xs text-eve-muted">
              {t('characters.lastUpdatedPrefix')} <TimeAgo date={char.lastFetchedAt} />
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 rounded-md bg-black/10 px-2 py-2.5">
          <SetMainButton characterId={char.id} isMain={char.isMain} />
          <RefreshCharacterButton characterId={char.id} />
          <CharacterScopesDialog scopes={char.scopes} esiApp={char.esiApp} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-eve-border"
                aria-label={t('characters.cardActionsAria')}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 border-eve-border bg-eve-panel">
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => {
                  router.push(`/dashboard/characters/${char.id}`)
                }}
              >
                <UserRound className="mr-2 h-4 w-4" />
                {t('characters.viewProfile')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => {
                  router.push(`/link-character?accountCode=${encodeURIComponent(accountCode)}`)
                }}
              >
                <Shield className="mr-2 h-4 w-4" />
                {t('characters.reAuthorize')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {!char.isMain && <RemoveCharacterMenuItem characterId={char.id} />}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  )
}
