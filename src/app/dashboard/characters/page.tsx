import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getTranslations } from '@/i18n/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatSP, formatISK } from '@/lib/utils'
import { Zap, Wallet, Plus, Users, TrendingUp } from 'lucide-react'
import {
  LinkCharacterButton,
  RefreshAllButton,
  AutoRefreshManager,
  RemoveAllCharactersButton,
} from '@/components/character-actions'
import { CharacterCard } from '@/components/character-card'
import { CharactersList } from '@/components/characters-list'
import type { CharacterListItem } from '@/types/character'
import { getCachedWeeklyEfficiencyPercent } from '@/lib/characters/weekly-efficiency'
import { toPublicCharacter } from '@/lib/characters/public-character'

export const metadata: Metadata = {
  robots: 'noindex, nofollow',
}
const CHARACTERS_PAGE_SIZE = 25

interface PrismaCharacter {
  id: number
  name: string
  totalSp: number
  walletBalance: number
  location: string | null
  ship: string | null
  shipTypeId: number | null
  lastFetchedAt: Date | null
  isMain: boolean
  accessToken: string | null
  esiApp: string
  corporationId: number | null
  tokenExpiresAt: Date | null
  tags: string[]
}

export default async function CharactersPage() {
  const { t } = await getTranslations()
  const session = await getSession()

  if (!session?.user?.id) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      accountCode: true,
    },
  })

  const [initialRows, totals, mainRow, autoRefreshRows] = await Promise.all([
    prisma.character.findMany({
      where: { userId: session.user.id },
      orderBy: [{ isMain: 'desc' }, { totalSp: 'desc' }],
      take: CHARACTERS_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        totalSp: true,
        walletBalance: true,
        location: true,
        ship: true,
        shipTypeId: true,
        lastFetchedAt: true,
        isMain: true,
        accessToken: true,
        esiApp: true,
        corporationId: true,
        tokenExpiresAt: true,
        tags: true,
      },
    }),
    prisma.character.aggregate({
      where: { userId: session.user.id },
      _count: { id: true },
      _sum: {
        totalSp: true,
        walletBalance: true,
      },
    }),
    prisma.character.findFirst({
      where: { userId: session.user.id, isMain: true },
      select: {
        id: true,
        name: true,
        totalSp: true,
        walletBalance: true,
        location: true,
        ship: true,
        shipTypeId: true,
        lastFetchedAt: true,
        isMain: true,
        accessToken: true,
        esiApp: true,
        corporationId: true,
        tokenExpiresAt: true,
        tags: true,
      },
    }),
    prisma.character.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        name: true,
        lastFetchedAt: true,
        tokenExpiresAt: true,
      },
    }),
  ])

  const characters: CharacterListItem[] = initialRows.map((c: PrismaCharacter) => toPublicCharacter(c))
  const mainCharacter = mainRow ? toPublicCharacter(mainRow as PrismaCharacter) : null
  const totalCharacters = totals._count.id || 0
  const totalSP = totals._sum.totalSp || 0
  const totalIsk = totals._sum.walletBalance || 0

  const efficiency = await getCachedWeeklyEfficiencyPercent(session.user.id)

  const autoRefreshPayload = autoRefreshRows.map((c) => ({
    id: c.id,
    name: c.name,
    lastFetchedAt: c.lastFetchedAt != null ? new Date(c.lastFetchedAt) : null,
    tokenExpiresAt: c.tokenExpiresAt != null ? new Date(c.tokenExpiresAt) : undefined,
  }))

  return (
    <div className="space-y-6">
      <AutoRefreshManager characters={autoRefreshPayload} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">{t('characters.title')}</h1>
          <p className="text-gray-400">{t('characters.manageLinkedDesc')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{t('characters.actionsLabel')}</span>
          {totalCharacters > 0 && <RemoveAllCharactersButton />}
          {totalCharacters > 0 && <RefreshAllButton />}
          <LinkCharacterButton accountCode={user?.accountCode} />
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="bg-eve-panel border-eve-border group hover:bg-white/[0.02] transition-colors">
          <CardHeader className="flex flex-row items-center justify-between py-2 px-3 space-y-0">
            <CardTitle className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.15em]">
              {t('characters.summaryTotalSp')}
            </CardTitle>
            <Zap className="h-3 w-3 text-eve-accent opacity-70 group-hover:opacity-100 transition-opacity" />
          </CardHeader>
          <CardContent className="py-2 px-3 pt-0">
            <div className="text-lg font-black text-white tracking-tight">{formatSP(totalSP)}</div>
            <p className="text-[9px] text-zinc-600 uppercase font-black tracking-tighter mt-0.5">
              {t('characters.summaryTotalSpHint', { count: totalCharacters })}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-eve-panel border-eve-border group hover:bg-white/[0.02] transition-colors">
          <CardHeader className="flex flex-row items-center justify-between py-2 px-3 space-y-0">
            <CardTitle className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.15em]">
              {t('characters.summaryTotalIsk')}
            </CardTitle>
            <Wallet className="h-3 w-3 text-green-400 opacity-70 group-hover:opacity-100 transition-opacity" />
          </CardHeader>
          <CardContent className="py-2 px-3 pt-0">
            <div className="text-lg font-black text-white tracking-tight">
              {formatISK(totalIsk)}
            </div>
            <p className="text-[9px] text-zinc-600 uppercase font-black tracking-tighter mt-0.5">
              {t('characters.summaryTotalIskHint')}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-eve-panel border-eve-border group hover:bg-white/[0.02] transition-colors">
          <CardHeader className="flex flex-row items-center justify-between py-2 px-3 space-y-0">
            <CardTitle className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.15em]">
              {t('characters.summaryCount')}
            </CardTitle>
            <Users className="h-3 w-3 text-blue-400 opacity-70 group-hover:opacity-100 transition-opacity" />
          </CardHeader>
          <CardContent className="py-2 px-3 pt-0">
            <div className="text-lg font-black text-white tracking-tight">{totalCharacters.toString()}</div>
            <p className="text-[9px] text-zinc-600 uppercase font-black tracking-tighter mt-0.5">
              {t('characters.summaryCountHint')}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-eve-panel border-eve-border group hover:bg-white/[0.02] transition-colors">
          <CardHeader className="flex flex-row items-center justify-between py-2 px-3 space-y-0">
            <CardTitle className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.15em]">
              {t('characters.summaryEfficiency')}
            </CardTitle>
            <TrendingUp className="h-3 w-3 text-eve-accent2 opacity-70 group-hover:opacity-100 transition-opacity" />
          </CardHeader>
          <CardContent className="py-2 px-3 pt-0">
            <div className="text-lg font-black text-white tracking-tight">{efficiency}%</div>
            <p className="text-[9px] text-zinc-600 uppercase font-black tracking-tighter mt-0.5">
              {t('characters.summaryEfficiencyHint')}
            </p>
          </CardContent>
        </Card>
      </div>

      {totalCharacters > 0 ? (
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="bg-eve-panel border border-eve-border">
            <TabsTrigger value="all">{t('characters.tabAll', { count: totalCharacters })}</TabsTrigger>
            <TabsTrigger value="main">{t('characters.tabMain')}</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <CharactersList
              characters={characters}
              totalCount={totalCharacters}
              accountCode={user?.accountCode || ''}
            />
          </TabsContent>

          <TabsContent value="main" className="mt-6">
            {mainCharacter ? (
              <div className="max-w-md">
                <CharacterCard character={mainCharacter} accountCode={user?.accountCode || ''} detailed />
              </div>
            ) : (
              <Card className="bg-eve-panel border-eve-border">
                <CardContent className="py-8 text-sm text-zinc-400">
                  {t('characters.noMainCharacter')}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <Card className="bg-eve-panel border-eve-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-eve-accent/20 mb-4">
              <Plus className="h-8 w-8 text-eve-accent" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">{t('characters.emptyTitle')}</h3>
            <p className="text-gray-400 text-center mb-6">{t('characters.emptyDescription')}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <LinkCharacterButton accountCode={user?.accountCode} />
              <RefreshAllButton />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
