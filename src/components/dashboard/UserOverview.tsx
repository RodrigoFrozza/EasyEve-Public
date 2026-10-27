'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Plus, RefreshCw, User, Award, TrendingUp } from 'lucide-react'
import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from '@/i18n/hooks'
import { TesterApplicationCard } from './TesterApplicationCard'
import { UserSearch } from './UserSearch'
import { TooltipProvider } from '@/components/ui/tooltip'

interface MedalInfo {
  id: string
  name: string
  icon: string | null
  tier: string
  count: number
}

interface CharacterInfo {
  id: number
  name: string
  isMain: boolean
}

interface UserOverviewProps {
  userId: string
  mainCharacter: {
    id: number
    name: string
    system?: string | null
    ship?: string | null
    corporation?: {
      name: string
      ticker: string
    } | null
    alliance?: {
      name: string
    } | null
  } | null
  characters: CharacterInfo[]
  totalReputation: number
  medals: MedalInfo[]
  activeActivities: Array<{
    type: string
    startTime: Date
  }>
}

const TIER_COLORS: Record<string, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
}

export function UserOverview({
  userId,
  mainCharacter,
  characters,
  totalReputation,
  medals,
  activeActivities,
}: UserOverviewProps) {
  const router = useRouter()
  const { t } = useTranslations()

  const safeCharacters = useMemo(() => (characters || []).filter(Boolean), [characters])
  const safeMedals = useMemo(() => (medals || []).filter(Boolean), [medals])
  const safeActivities = useMemo(() => (activeActivities || []).filter(Boolean), [activeActivities])
  const mainChar = safeCharacters.find((c) => c.isMain) ?? safeCharacters[0]
  const altCharacters = safeCharacters.filter((c) => !c.isMain)

  const shownAlts = altCharacters.slice(0, 6)
  const altsOverflow = altCharacters.length - shownAlts.length

  return (
    <TooltipProvider delayDuration={0}>
      <div className="space-y-5">
        {/* PILOT CARD */}
        <section className="ta-panel overflow-hidden">
          <div className="p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-[22px]">
              {/* main avatar */}
              {mainChar && (
                <div className="relative shrink-0">
                  <Avatar className="h-[84px] w-[84px] rounded-[12px] border border-white/10">
                    <AvatarImage
                      src={`https://images.evetech.net/characters/${mainChar.id}/portrait?size=256`}
                      className="rounded-[12px] object-cover"
                    />
                    <AvatarFallback className="rounded-[12px] bg-gradient-to-br from-[#1c2a3a] to-[#0e1822] font-accent text-[34px] font-bold text-[#7c8ea0]">
                      {mainChar.name?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>
                  {safeActivities.length > 0 && (
                    <span className="absolute -bottom-1 -right-1 flex h-5 items-center justify-center rounded-[6px] border-2 border-[#101a26] bg-eve-accent px-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#04141a] animate-ta-pulse" />
                    </span>
                  )}
                </div>
              )}

              {/* identity */}
              <div className="flex min-w-0 flex-1 flex-col gap-[10px]">
                <div className="flex flex-wrap items-center gap-[11px]">
                  <h2 className="font-accent text-[26px] font-bold leading-none text-white">
                    {mainCharacter?.name || t('dashboard.unknownPilot')}
                  </h2>
                  {safeActivities.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-[6px] border border-[rgba(16,185,129,.2)] bg-[rgba(16,185,129,.08)] px-[9px] py-[3px] font-accent text-[10px] font-semibold uppercase tracking-[0.06em] text-ta-success">
                      <span className="h-1.5 w-1.5 rounded-full bg-ta-success animate-ta-pulse" />
                      {safeActivities[0].type}
                    </span>
                  )}
                </div>

                {mainCharacter?.corporation ? (
                  <p className="text-[13.5px] text-ta-secondary">
                    <span className="font-semibold text-eve-accent">
                      [{mainCharacter.corporation.ticker}]
                    </span>{' '}
                    {mainCharacter.corporation.name}
                    {mainCharacter.alliance && (
                      <>
                        <span className="mx-2 text-[#33475a]">·</span>
                        <span>{mainCharacter.alliance.name}</span>
                      </>
                    )}
                  </p>
                ) : (
                  <p className="text-xs italic text-ta-muted">{t('dashboard.noAffiliation')}</p>
                )}

                {(mainCharacter?.system || mainCharacter?.ship) && (
                  <div className="mt-0.5 flex flex-wrap gap-[10px]">
                    {mainCharacter?.system && (
                      <div className="flex items-center gap-2 rounded-[6px] border border-white/[0.06] bg-ta-inset px-[11px] py-1.5">
                        <span className="h-[5px] w-[5px] rounded-full bg-eve-accent" />
                        <span className="font-accent text-[11px] tracking-[0.05em] text-ta-muted">{t('dashboard.systemLabel')}</span>
                        <span className="font-sans text-[12px] text-ta-body">{mainCharacter.system}</span>
                      </div>
                    )}
                    {mainCharacter?.ship && (
                      <div className="flex items-center gap-2 rounded-[6px] border border-white/[0.06] bg-ta-inset px-[11px] py-1.5">
                        <span className="font-accent text-[11px] tracking-[0.05em] text-ta-muted">{t('dashboard.shipLabel')}</span>
                        <span className="font-sans text-[12px] text-ta-body">{mainCharacter.ship}</span>
                      </div>
                    )}
                  </div>
                )}

                <UserSearch className="mt-1 w-full sm:max-w-xs" />
              </div>

              {/* alternate characters */}
              <div className="flex shrink-0 flex-col items-end gap-[9px] lg:border-l lg:border-white/[0.06] lg:pl-5">
                <span className="font-accent text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ta-faint">
                  {t('sidebar.characters')}
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {shownAlts.map((char) => (
                    <Link key={char.id} href="/dashboard/characters" title={char.name}>
                      <Avatar className="h-[34px] w-[34px] rounded-[8px] border border-white/[0.08]">
                        <AvatarImage
                          src={`https://images.evetech.net/characters/${char.id}/portrait?size=128`}
                          className="rounded-[8px] object-cover"
                        />
                        <AvatarFallback className="rounded-[8px] bg-gradient-to-br from-[#1a2735] to-[#0d1620] font-accent text-[13px] font-semibold text-[#7c8ea0]">
                          {char.name?.[0] || '?'}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                  ))}
                  {altsOverflow > 0 && (
                    <Link
                      href="/dashboard/characters"
                      title={t('characters.title')}
                      className="flex h-[34px] w-[34px] items-center justify-center rounded-[8px] border border-white/[0.08] bg-ta-inset font-accent text-[11px] font-semibold text-eve-accent"
                    >
                      +{altsOverflow}
                    </Link>
                  )}
                  <Link
                    href="/dashboard/characters"
                    title={t('characters.emptyTitle')}
                    className="flex h-[34px] w-[34px] items-center justify-center rounded-[8px] border border-dashed border-white/[0.12] text-ta-faint transition-colors hover:border-eve-accent/40 hover:text-eve-accent"
                  >
                    <Plus className="h-[15px] w-[15px]" />
                  </Link>
                </div>
              </div>
            </div>

            {/* footer: reputation + commands */}
            <div className="mt-[22px] flex flex-col gap-4 border-t border-white/[0.07] pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex items-center gap-[14px]">
                <div className="flex h-[46px] w-[46px] items-center justify-center rounded-[10px] border border-eve-accent/[0.18] bg-eve-accent/[0.08]">
                  <TrendingUp className="h-[22px] w-[22px] text-eve-accent" />
                </div>
                <div>
                  <p className="font-sans text-[30px] font-bold leading-none tabular-nums text-eve-accent">
                    {(totalReputation || 0).toLocaleString()}
                  </p>
                  <p className="mt-[5px] font-accent text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ta-muted">
                    {t('dashboard.totalReputation')}
                  </p>
                </div>
              </div>

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                <Button
                  variant="eve"
                  className="h-11 w-full text-xs sm:w-auto sm:px-[22px]"
                  onClick={() => router.push('/dashboard/activity')}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t('dashboard.commands.startActivity')}
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 shrink-0 rounded-[10px] border-white/[0.08] bg-ta-inset text-ta-secondary hover:border-eve-accent/40 hover:text-eve-accent"
                    onClick={() => router.push('/dashboard/activity')}
                    aria-label={t('dashboard.commands.syncEsi')}
                  >
                    <RefreshCw className="h-[18px] w-[18px]" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 shrink-0 rounded-[10px] border-white/[0.08] bg-ta-inset text-ta-secondary hover:border-eve-accent/40 hover:text-eve-accent"
                    onClick={() => router.push(`/players/${userId}`)}
                    aria-label={t('dashboard.commands.profile')}
                  >
                    <User className="h-[18px] w-[18px]" />
                  </Button>
                </div>
                <TesterApplicationCard />
              </div>
            </div>
          </div>
        </section>

        {/* MEDALS / ACHIEVEMENTS */}
        {safeMedals.length > 0 && (
          <section className="ta-panel p-[22px]">
            <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-[14px]">
              <h3 className="flex items-center gap-[9px] font-accent text-[13px] font-semibold uppercase tracking-[0.1em] text-ta-body">
                <Award className="h-4 w-4 text-eve-accent" />
                {t('dashboard.accomplishments')}
              </h3>
              <Link
                href={`/players/${userId}?tab=medals`}
                className="font-accent text-xs font-semibold text-eve-accent transition-colors hover:text-eve-accent/80"
              >
                {t('dashboard.viewAllMedals')}
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {safeMedals.slice(0, 3).map((medal) => (
                <div
                  key={medal.id}
                  className="group/medal flex items-center gap-3 rounded-[10px] border border-white/[0.06] bg-ta-inset p-[13px] transition-colors hover:border-eve-accent/30"
                >
                  <div
                    className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[8px] border border-white/[0.08] bg-[#0e1822] text-xl"
                    style={{ color: TIER_COLORS[medal.tier] || '#CD7F32' }}
                  >
                    {medal.icon || <Award className="h-6 w-6" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-accent text-[13px] font-semibold text-ta-bright transition-colors group-hover/medal:text-eve-accent">
                      {medal.name}
                    </div>
                    <div className="mt-0.5 text-[10px] capitalize text-ta-muted">{medal.tier}</div>
                  </div>
                  {medal.count > 1 && (
                    <span className="shrink-0 rounded-[5px] border border-eve-accent/20 bg-eve-accent/[0.1] px-2 py-0.5 font-accent text-[10px] font-semibold text-eve-accent">
                      ×{medal.count}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </TooltipProvider>
  )
}
