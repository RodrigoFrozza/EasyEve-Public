import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getTranslations } from '@/i18n/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatSP, formatISK, parseScopesFromJwt } from '@/lib/utils'
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

export const metadata: Metadata = {
  robots: 'noindex, nofollow',
}

interface PrismaCharacter {
  id: number
  name: string
  totalSp: number
  walletBalance: number
  location: string | null
  ship: string | null
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

  if (!session?.user?.id) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      characters: {
        orderBy: [{ isMain: 'desc' }, { totalSp: 'desc' }],
      },
    },
  })

  const characters: CharacterListItem[] = (user?.characters || []).map((c: PrismaCharacter) => ({
    id: c.id,
    name: c.name,
    totalSp: c.totalSp,
    walletBalance: c.walletBalance,
    location: c.location,
    ship: c.ship,
    lastFetchedAt: c.lastFetchedAt,
    isMain: c.isMain,
    scopes: parseScopesFromJwt(c.accessToken),
    esiApp: c.esiApp || 'main',
    corporationId: c.corporationId,
    tokenExpiresAt: c.tokenExpiresAt,
    tags: c.tags || [],
  }))

  const mainCharacter = characters.find((c) => c.isMain) || characters[0]

  const totalSP = characters.reduce((sum, c) => sum + (c.totalSp || 0), 0)

  const efficiency = await getCachedWeeklyEfficiencyPercent(session.user.id)

  const autoRefreshPayload = characters.map((c) => ({
    id: c.id,
    name: c.name,
    lastFetchedAt: c.lastFetchedAt != null ? new Date(c.lastFetchedAt) : null,
    tokenExpiresAt: c.tokenExpiresAt != null ? new Date(c.tokenExpiresAt) : undefined,
  }))

  return (
    <div className="space-y-6">
      <AutoRefreshManager characters={autoRefreshPayload} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">{t('characters.title')}</h1>
          <p className="text-gray-400">{t('characters.manageLinkedDesc')}</p>
        </div>
        <div className="flex items-center gap-2">
          {characters.length > 0 && <RemoveAllCharactersButton />}
          <RefreshAllButton />
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
              {t('characters.summaryTotalSpHint', { count: characters.length })}
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
              {formatISK(characters.reduce((sum, c) => sum + c.walletBalance, 0))}
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
            <div className="text-lg font-black text-white tracking-tight">{characters.length.toString()}</div>
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

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-eve-panel border border-eve-border">
          <TabsTrigger value="all">{t('characters.tabAll', { count: characters.length })}</TabsTrigger>
          <TabsTrigger value="main">{t('characters.tabMain')}</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <CharactersList characters={characters} accountCode={user?.accountCode || ''} />
        </TabsContent>

        <TabsContent value="main" className="mt-6">
          {mainCharacter && (
            <div className="max-w-md">
              <CharacterCard character={mainCharacter} accountCode={user?.accountCode || ''} detailed />
            </div>
          )}
        </TabsContent>
      </Tabs>

      {characters.length === 0 && (
        <Card className="bg-eve-panel border-eve-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-eve-accent/20 mb-4">
              <Plus className="h-8 w-8 text-eve-accent" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">{t('characters.emptyTitle')}</h3>
            <p className="text-gray-400 text-center mb-4">{t('characters.emptyDescription')}</p>
            <LinkCharacterButton accountCode={user?.accountCode} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
