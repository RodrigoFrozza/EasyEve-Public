'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
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
  Target,
  Check,
  Globe,
  RefreshCw,
  X,
  Loader2,
  Tag as TagIcon,
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
  CharacterTagEditor,
} from '@/components/character-actions'
import {
  CHARACTER_ACTIVITY_TAGS,
  CHARACTER_TAG_TRANSLATION_KEYS,
  CHARACTER_TAG_STYLE,
} from '@/constants/character-tags'

import { TimeAgo } from '@/components/time-ago'
import { CharacterCardSkeleton } from '@/components/character-card-skeleton'
import { useCharacterData } from '@/lib/hooks/use-esi'
import { useTokenStatus } from '@/lib/hooks/use-token-status'
import { useCorporationInfo } from '@/lib/hooks/use-corporation-info'
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
  const queryClient = useQueryClient()
  const [tagSaving, setTagSaving] = useState(false)

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

  const { tokenExpired, tokenInvalid } = useTokenStatus(char.tokenExpiresAt)

  async function updateTags(newTags: string[]) {
    if (tagSaving) return
    setTagSaving(true)
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
      queryClient.setQueryData(['character', char.id], (old: any) =>
        old ? { ...old, tags: newTags } : old
      )
      await queryClient.invalidateQueries({ queryKey: ['characters'] })
    } catch (error) {
      console.error('Update tags error:', error)
      toast.error(t('characters.tagsUpdateFailed'))
      throw error
    } finally {
      setTagSaving(false)
    }
  }

  async function toggleTag(tag: string) {
    const newTags = char.tags.includes(tag)
      ? char.tags.filter((x: string) => x !== tag)
      : [...char.tags, tag]
    await updateTags(newTags)
  }

  if (isFetching && !character) {
    return <CharacterCardSkeleton />
  }

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
        {isRefreshing && (
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
          <div className="col-span-2 flex flex-wrap gap-1.5 mt-1 items-center">
            {char.tags && char.tags.length > 0 && char.tags.map((tag: string) => {
              const translationKey = CHARACTER_TAG_TRANSLATION_KEYS[tag]
              const style = CHARACTER_TAG_STYLE[tag] || { 
                border: 'border-cyan-500/30', 
                text: 'text-cyan-400', 
                bg: 'bg-cyan-500/5' 
              }

              return (
                <Badge
                  key={tag}
                  variant="outline"
                  className={cn(
                    "group text-[10px] pr-1 flex items-center gap-1 transition-all hover:scale-105",
                    style?.border || "border-zinc-700/50",
                    style?.text || "text-zinc-400",
                    style?.bg || "bg-zinc-800/30"
                  )}
                >
                  {style?.icon && <style.icon className="h-2.5 w-2.5" />}
                  {translationKey ? t(translationKey) : tag}
                  <button
                    onClick={() => toggleTag(tag)}
                    className="hover:text-red-400 p-0.5 rounded-full hover:bg-red-400/10 opacity-40 group-hover:opacity-100 transition-opacity"
                    title={t('global.remove') || 'Remove'}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              )
            })}
            <CharacterTagEditor 
              characterId={char.id} 
              currentTags={char.tags} 
              onTagsChange={updateTags} 
            />
          </div>
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
                    {CHARACTER_ACTIVITY_TAGS.map((tag) => {
                      const isSelected = char.tags.includes(tag)
                      const translationKey = CHARACTER_TAG_TRANSLATION_KEYS[tag]
                      const style = CHARACTER_TAG_STYLE[tag]
                      const Icon = style?.icon || TagIcon
                      
                      return (
                        <DropdownMenuItem
                          key={tag}
                          className={cn(
                            "flex items-center gap-2 cursor-pointer",
                            isSelected ? "text-eve-accent font-medium bg-eve-accent/5" : ""
                          )}
                          disabled={tagSaving}
                          onClick={() => void toggleTag(tag)}
                        >
                          <div className={cn(
                            "flex h-4 w-4 items-center justify-center rounded-sm",
                            isSelected ? "bg-eve-accent/10" : "bg-zinc-800/30"
                          )}>
                            <Icon className={cn("h-2.5 w-2.5", 
                              isSelected ? "text-eve-accent" : (style?.iconClass || "text-zinc-500")
                            )} />
                          </div>
                          <span className="text-xs truncate flex-1">
                            {translationKey ? t(translationKey) : tag}
                          </span>
                          {isSelected && <Check className="h-3 w-3 shrink-0" />}
                        </DropdownMenuItem>
                      )
                    })}
                    <DropdownMenuSeparator />
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
