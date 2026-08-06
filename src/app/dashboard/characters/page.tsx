import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getTranslations } from '@/i18n/server'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatSP, formatISK } from '@/lib/utils'
import { Zap, Wallet, Plus, Users, TrendingUp } from 'lucide-react'
import { CharacterSummaryStat } from '@/components/characters/CharacterSummaryStat'
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
    <div className="mx-auto w-full max-w-[1600px] space-y-6 p-4 md:p-8">
      <AutoRefreshManager characters={autoRefreshPayload} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-accent text-[22px] font-bold tracking-[0.01em] text-white">{t('characters.title')}</h1>
          <p className="text-[12.5px] text-ta-muted">{t('characters.manageLinkedDesc')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-accent text-[10px] uppercase tracking-[0.18em] text-ta-faint">{t('characters.actionsLabel')}</span>
          {totalCharacters > 0 && <RemoveAllCharactersButton />}
          {totalCharacters > 0 && <RefreshAllButton />}
          <LinkCharacterButton accountCode={user?.accountCode} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <CharacterSummaryStat
          title={t('characters.summaryTotalSp')}
          value={formatSP(totalSP)}
          hint={t('characters.summaryTotalSpHint', { count: totalCharacters })}
          icon={Zap}
          variant="amber"
        />
        <CharacterSummaryStat
          title={t('characters.summaryTotalIsk')}
          value={formatISK(totalIsk)}
          hint={t('characters.summaryTotalIskHint')}
          icon={Wallet}
          variant="emerald"
        />
        <CharacterSummaryStat
          title={t('characters.summaryCount')}
          value={totalCharacters.toString()}
          hint={t('characters.summaryCountHint')}
          icon={Users}
          variant="blue"
        />
        <CharacterSummaryStat
          title={t('characters.summaryEfficiency')}
          value={`${efficiency}%`}
          hint={t('characters.summaryEfficiencyHint')}
          icon={TrendingUp}
          variant="cyan"
          progress={efficiency}
        />
      </div>

      {totalCharacters > 0 ? (
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="border border-white/[0.06] bg-ta-inset">
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
              <div className="max-w-2xl">
                <CharacterCard character={mainCharacter} accountCode={user?.accountCode || ''} detailed />
              </div>
            ) : (
              <div className="ta-panel py-8 px-6 text-sm text-ta-muted">
                {t('characters.noMainCharacter')}
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-[16px] border border-dashed border-white/[0.13] py-12 px-6">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[12px] border border-eve-accent/20 bg-eve-accent/[0.1]">
            <Plus className="h-8 w-8 text-eve-accent" />
          </div>
          <h3 className="mb-2 font-accent text-[17px] font-semibold text-white">{t('characters.emptyTitle')}</h3>
          <p className="mb-6 text-center text-ta-muted">{t('characters.emptyDescription')}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <LinkCharacterButton accountCode={user?.accountCode} />
            <RefreshAllButton />
          </div>
        </div>
      )}
    </div>
  )
}
