'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { formatSP, formatISK, parseScopesFromJwt } from '@/lib/utils'
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
  Target,
  Check,
  Globe,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu'
import {
  RefreshCharacterButton,
  SetMainButton,
  CharacterScopesDialog,
  RemoveCharacterMenuItem,
} from '@/components/character-actions'
import { TimeAgo } from '@/components/time-ago'
import { useCharacterData } from '@/lib/hooks/use-esi'
import { getCorporationInfo } from '@/lib/esi'
import type { CharacterListItem } from '@/types/character'
import {
  CHARACTER_ACTIVITY_TAGS,
  CHARACTER_PI_TAG,
  CHARACTER_ACTIVITY_TAG_SET,
  type CharacterActivityTag,
} from '@/constants/character-tags'

type CharacterQueryRow = CharacterListItem & { accessToken?: string | null }

const TAG_MENU_META: Record<
  CharacterActivityTag,
  { Icon: LucideIcon; menuLabelKey: string; iconClass: string }
> = {
  Ratter: { Icon: Target, menuLabelKey: 'characters.tags.menuRatter', iconClass: 'text-red-400' },
  Miner: { Icon: Zap, menuLabelKey: 'characters.tags.menuMiner', iconClass: 'text-emerald-400' },
  Explorer: { Icon: MapPin, menuLabelKey: 'characters.tags.menuExplorer', iconClass: 'text-amber-400' },
  Industrialist: {
    Icon: Building2,
    menuLabelKey: 'characters.tags.menuIndustrialist',
    iconClass: 'text-blue-400',
  },
  'Skill Point Farmer': {
    Icon: Wallet,
    menuLabelKey: 'characters.tags.menuSpFarmer',
    iconClass: 'text-purple-400',
  },
  'Abyssal Runner': {
    Icon: AlertTriangle,
    menuLabelKey: 'characters.tags.menuAbyssalRunner',
    iconClass: 'text-pink-400',
  },
  [CHARACTER_PI_TAG]: {
    Icon: Globe,
    menuLabelKey: 'characters.tags.menuPiManager',
    iconClass: 'text-cyan-400',
  },
}

const TAGS_BEFORE_PI = CHARACTER_ACTIVITY_TAGS.filter((t) => t !== CHARACTER_PI_TAG)

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
  const queryClient = useQueryClient()
  const [mounted, setMounted] = useState(false)
  const [corpInfo, setCorpInfo] = useState<{ name: string; ticker?: string } | null>(null)
  const [tagSaving, setTagSaving] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (initialData.corporationId) {
      getCorporationInfo(initialData.corporationId)
        .then(setCorpInfo)
        .catch(() => setCorpInfo(null))
    }
  }, [initialData.corporationId])

  const { data: character, isRefreshing, isFetching } = useCharacterData(initialData.id)

  const char = useMemo((): CharacterQueryRow => {
    const base = (character ?? initialData) as CharacterQueryRow
    if (character && !character.scopes && character.accessToken) {
      return {
        ...base,
        scopes: parseScopesFromJwt(character.accessToken),
      }
    }
    return {
      ...base,
      scopes: base.scopes ?? [],
      tags: base.tags ?? [],
    }
  }, [character, initialData])

  const [tokenExpired, setTokenExpired] = useState(false)
  const [tokenInvalid, setTokenInvalid] = useState(false)

  useEffect(() => {
    if (!char.tokenExpiresAt) {
      setTokenExpired(false)
      setTokenInvalid(false)
      return
    }
    const tokenExpiresAtMs = new Date(char.tokenExpiresAt).getTime()
    const now = Date.now()
    
    // tokenExpiresAtMs === 0 or very small indicates a specifically invalidated token in our backend
    const isInvalid = tokenExpiresAtMs > 0 && tokenExpiresAtMs < 1000000000000 // Roughly year 2001
    const isExpiringSoon = tokenExpiresAtMs > 0 && tokenExpiresAtMs < (now + 3 * 60 * 1000)

    setTokenInvalid(isInvalid)
    setTokenExpired(isExpiringSoon)
  }, [char.tokenExpiresAt])

  async function toggleTag(tag: CharacterActivityTag) {
    if (tagSaving) return
    setTagSaving(true)
    const allowedExisting = (char.tags || []).filter((x: string) => CHARACTER_ACTIVITY_TAG_SET.has(x))
    const newTags = allowedExisting.includes(tag)
      ? allowedExisting.filter((x: string) => x !== tag)
      : [...allowedExisting, tag]
    try {
      const res = await fetch(`/api/characters/${char.id}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: newTags }),
      })
      if (!res.ok) {
        toast.error(t('characters.tagsUpdateFailed'))
        return
      }
      toast.success(t('characters.tagsUpdated'))
      queryClient.setQueryData(['character', char.id], (old: CharacterQueryRow | null | undefined) =>
        old ? { ...old, tags: newTags } : old
      )
      await queryClient.invalidateQueries({ queryKey: ['character', char.id] })
    } catch (error) {
      console.error('Toggle tag error:', error)
      toast.error(t('characters.tagsUpdateFailed'))
    } finally {
      setTagSaving(false)
    }
  }

  if (!mounted)
    return (
      <Card className={`bg-eve-panel border-eve-border animate-pulse`}>
        <div className="h-48" />
      </Card>
    )

  return (
    <Card className={`bg-eve-panel border-eve-border ${char.isMain ? 'ring-2 ring-eve-accent' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
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
                <span className="text-gray-500">
                  {t('characters.characterId', { id: char.id })}
                </span>
              </div>
            </div>
          </div>
        </div>
        {tokenInvalid && (
          <div className="flex flex-col gap-2 p-3 rounded-lg text-sm bg-red-500/10 text-red-400 border border-red-500/20">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{t('global.tokenExpiredReLogin')}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-1 border-red-500/30 hover:bg-red-500/20 text-red-400"
              onClick={() => {
                router.push(`/link-character?accountCode=${encodeURIComponent(accountCode)}`)
              }}
            >
              <Shield className="mr-2 h-4 w-4" />
              {t('characters.reAuthorize')}
            </Button>
          </div>
        )}
        {!tokenInvalid && tokenExpired && !isRefreshing && !isFetching && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>{t('characters.syncingSession')}</span>
          </div>
        )}
        {!tokenInvalid && tokenExpired && (isRefreshing || isFetching) && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>{t('characters.syncingSession')}</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Zap className="h-4 w-4 text-eve-accent" />
            <span className="text-gray-400">{t('characters.spLabel')}</span>
            <span className="font-medium text-white">{formatSP(char.totalSp)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Wallet className="h-4 w-4 text-green-400" />
            <span className="text-gray-400">{t('characters.iskLabel')}</span>
            <span className="font-medium text-green-400">{formatISK(char.walletBalance)}</span>
          </div>
          {char.location && (
            <div className="flex items-center gap-2 text-sm col-span-2">
              <MapPin className="h-4 w-4 text-blue-400" />
              <span className="text-gray-400">{t('characters.locationLabel')}</span>
              <span className="font-medium text-white">{char.location}</span>
            </div>
          )}
          {char.ship && (
            <div className="flex items-center gap-2 text-sm col-span-2">
              <Ship className="h-4 w-4 text-purple-400" />
              <span className="text-gray-400">{t('characters.shipLabel')}</span>
              <span className="font-medium text-white">{char.ship}</span>
            </div>
          )}
          {char.tags && char.tags.length > 0 && (
            <div className="col-span-2 flex flex-wrap gap-1 mt-1">
              {char.tags.map((tag: string) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10 text-[10px]"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {detailed && (
          <div className="pt-4 border-t border-eve-border">
            <p className="text-xs text-gray-500">
              {t('characters.lastUpdatedPrefix')}{' '}
              <TimeAgo date={char.lastFetchedAt} />
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
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
            <DropdownMenuContent align="end" className="w-56 bg-eve-panel border-eve-border">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer" disabled={tagSaving}>
                  <Target className="mr-2 h-4 w-4 text-red-400" />
                  {t('characters.tagsMenuTitle')}
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="w-48 bg-eve-panel border-eve-border">
                    <DropdownMenuLabel className="text-xs text-zinc-500">
                      {t('characters.activityTagsLabel')}
                    </DropdownMenuLabel>
                    {TAGS_BEFORE_PI.map((tag) => {
                      const meta = TAG_MENU_META[tag]
                      const Icon = meta.Icon
                      return (
                        <DropdownMenuItem
                          key={tag}
                          className="cursor-pointer"
                          disabled={tagSaving}
                          onClick={() => void toggleTag(tag)}
                        >
                          <Icon className={`mr-2 h-4 w-4 ${meta.iconClass}`} />
                          {t(meta.menuLabelKey)}
                          {char.tags?.includes(tag) && <Check className="ml-auto h-4 w-4" />}
                        </DropdownMenuItem>
                      )
                    })}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer"
                      disabled={tagSaving}
                      onClick={() => void toggleTag(CHARACTER_PI_TAG)}
                    >
                      <Globe
                        className={`mr-2 h-4 w-4 ${TAG_MENU_META[CHARACTER_PI_TAG].iconClass}`}
                      />
                      {t(TAG_MENU_META[CHARACTER_PI_TAG].menuLabelKey)}
                      {char.tags?.includes(CHARACTER_PI_TAG) && <Check className="ml-auto h-4 w-4" />}
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
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
              <DropdownMenuSeparator />
              {!char.isMain && <RemoveCharacterMenuItem characterId={char.id} />}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  )
}
