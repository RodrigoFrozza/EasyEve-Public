'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { CharacterProfileView } from '@/components/characters/profile/CharacterProfileView'
import { apiClient } from '@/lib/api-error'
import { useTranslations } from '@/i18n/hooks'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  RefreshCw,
  Shield,
  AlertTriangle,
  Link2,
  Copy,
  Check,
  RotateCw,
  Ban,
} from 'lucide-react'
import type { OwnerProfileDto } from '@/lib/characters/share-profile'

async function fetchOwnerProfile(characterId: number): Promise<OwnerProfileDto> {
  const response = await fetch(`/api/characters/${characterId}/profile`)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: failed to fetch character profile`)
  }
  return response.json()
}

export function CharacterProfileOwnerClient({
  characterId,
  accountCode,
}: {
  characterId: number
  accountCode: string
}) {
  const { t } = useTranslations()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [omegaSaving, setOmegaSaving] = useState(false)
  const [shareSaving, setShareSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const queryKey = ['character-profile', characterId]

  const {
    data: profile,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => fetchOwnerProfile(characterId),
    staleTime: 0,
    refetchOnWindowFocus: false,
  })

  async function handleToggleOmega(next: boolean) {
    if (omegaSaving) return
    setOmegaSaving(true)
    try {
      const { error } = await apiClient.patch(
        `/api/characters/${characterId}/profile`,
        { isOmega: next },
        { showToast: true }
      )
      if (!error) {
        await queryClient.invalidateQueries({ queryKey })
      }
    } finally {
      setOmegaSaving(false)
    }
  }

  async function handleShareAction(action: 'enable' | 'rotate' | 'disable') {
    if (shareSaving) return
    if (action === 'rotate' && !confirm(t('characterProfile.owner.rotateConfirmDescription'))) return
    if (action === 'disable' && !confirm(t('characterProfile.owner.disableConfirmDescription'))) return

    setShareSaving(true)
    try {
      const { error } = await apiClient.patch(
        `/api/characters/${characterId}/profile`,
        { shareAction: action },
        { showToast: true }
      )
      if (!error) {
        await queryClient.invalidateQueries({ queryKey })
      }
    } finally {
      setShareSaving(false)
    }
  }

  async function handleCopy() {
    if (!profile?.shareToken) return
    const url = `${window.location.origin}/c/${profile.shareToken}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const missingScopes = profile?.missingScopes ?? []

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-eve-border bg-eve-panel px-3 py-2.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/dashboard/characters')}
          className="text-zinc-400"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('characterProfile.owner.backToCharacters')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-eve-border"
          disabled={isFetching}
          onClick={() => refetch()}
        >
          <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
          {isFetching ? t('characterProfile.owner.refreshing') : t('characterProfile.owner.refreshButton')}
        </Button>
      </div>

      {missingScopes.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {t('characterProfile.owner.reauthBannerTitle')}
          </div>
          <p className="text-red-300/90">{t('characterProfile.owner.reauthBannerDescription')}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-1 w-fit border-red-500/30 text-red-400 hover:bg-red-500/20"
            onClick={() => router.push(`/link-character?accountCode=${encodeURIComponent(accountCode)}`)}
          >
            <Shield className="mr-2 h-4 w-4" />
            {t('characterProfile.owner.reauthCta')}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="rounded-xl border-eve-border bg-eve-panel">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-eve-accent" />
              {t('characterProfile.owner.omegaToggleLabel')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <p className="text-xs text-zinc-500">{t('characterProfile.owner.omegaToggleHint')}</p>
            {isLoading ? (
              <Skeleton className="h-5 w-9" />
            ) : (
              <Switch
                checked={profile?.isOmega === true}
                disabled={omegaSaving}
                onCheckedChange={handleToggleOmega}
              />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-eve-border bg-eve-panel">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2 className="h-4 w-4 text-eve-accent" />
              {t('characterProfile.owner.shareTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-zinc-500">{t('characterProfile.owner.shareDescription')}</p>

            {isLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : profile?.shareToken ? (
              <>
                <div className="flex gap-2">
                  <Input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/c/${profile.shareToken}`} />
                  <Button variant="outline" size="sm" className="border-eve-border shrink-0" onClick={handleCopy}>
                    {copied ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    <span className="ml-2">
                      {copied ? t('characterProfile.owner.copied') : t('characterProfile.owner.copyLink')}
                    </span>
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-eve-border"
                    disabled={shareSaving}
                    onClick={() => handleShareAction('rotate')}
                  >
                    <RotateCw className="mr-2 h-4 w-4" />
                    {t('characterProfile.owner.rotateLink')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-500/30 text-red-400 hover:bg-red-500/20"
                    disabled={shareSaving}
                    onClick={() => handleShareAction('disable')}
                  >
                    <Ban className="mr-2 h-4 w-4" />
                    {t('characterProfile.owner.disableLink')}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-zinc-500">{t('characterProfile.owner.linkDisabled')}</p>
                <Button
                  variant="eve"
                  size="sm"
                  disabled={shareSaving}
                  onClick={() => handleShareAction('enable')}
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  {t('characterProfile.owner.generateLink')}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <CharacterProfileView profile={profile ?? null} loading={isLoading} />
    </div>
  )
}
