'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Pickaxe, Loader2, Download, Lock } from 'lucide-react'
import { getActivityTheme, getActivityThemeIcon } from '@/lib/activity/activity-theme'
import { MINING_TYPES, SPACE_TYPES } from '@/lib/constants/activity-data'
import { useMiningOverview } from '@/lib/hooks/use-mining-overview'
import { useTranslations } from '@/i18n/hooks'
import { useSession } from '@/lib/session-client'
import { cn, isPremium } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MinersRestPricesProvider } from './MinersRestPricesContext'
import { PersonalOverviewPanel } from './panels/PersonalOverviewPanel'
import { GeoBreakdownPanel } from './panels/GeoBreakdownPanel'
import { CommunityComparePanel } from './panels/CommunityComparePanel'
import { WhatToMinePanel } from './panels/WhatToMinePanel'
import { ReprocessingCalculatorPanel } from './panels/ReprocessingCalculatorPanel'
import { CompressionComparatorPanel } from './panels/CompressionComparatorPanel'
import { MarketReferencePanel } from './panels/MarketReferencePanel'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const ALL = '__all__'
const PERIOD_OPTIONS = [
  { value: '30', days: 30 },
  { value: '90', days: 90 },
  { value: '365', days: 365 },
  { value: 'all', days: undefined },
] as const

export function MinersRest() {
  const { t } = useTranslations()
  const { data: session } = useSession()
  const theme = useMemo(() => getActivityTheme('mining'), [])
  const Icon = getActivityThemeIcon('mining')
  const hasPremium = isPremium(session?.user?.subscriptionEnd)

  const [period, setPeriod] = useState<string>('90')
  const [space, setSpace] = useState(ALL)
  const [category, setCategory] = useState(ALL)
  const [characterId, setCharacterId] = useState(ALL)

  const days = PERIOD_OPTIONS.find((p) => p.value === period)?.days
  const characters = session?.user?.characters ?? []

  const overviewParams = useMemo(
    () => ({
      days,
      space: space === ALL ? undefined : space,
      category: category === ALL ? undefined : category,
      characterId:
        characterId === ALL ? undefined : Number.parseInt(characterId, 10),
    }),
    [days, space, category, characterId]
  )

  const { data, loading, error, refetch } = useMiningOverview(overviewParams)

  const handleExport = () => {
    if (!hasPremium || !data) return

    const headers = [
      'Section',
      'Key',
      'Label',
      'ISK',
      'M3',
      'Sessions',
      'DurationMs',
      'IskPerHour',
    ]
    const rows: string[][] = [headers]

    const iskPerHour = (isk: number, durationMs?: number) => {
      if (!durationMs || durationMs <= 0) return ''
      return String(Math.round(isk / (durationMs / 3_600_000)))
    }

    for (const row of data.bySpace) {
      rows.push([
        'Space',
        row.key,
        row.label,
        String(row.isk),
        String(row.m3),
        String(row.sessions),
        String(row.durationMs ?? ''),
        iskPerHour(row.isk, row.durationMs),
      ])
    }
    for (const row of data.byCategory) {
      rows.push([
        'Category',
        row.key,
        row.label,
        String(row.isk),
        String(row.m3),
        String(row.sessions),
        String(row.durationMs ?? ''),
        iskPerHour(row.isk, row.durationMs),
      ])
    }
    for (const row of data.byOre) {
      rows.push(['Ore', String(row.typeId), row.name, String(row.isk), String(row.m3), '', '', ''])
    }
    for (const row of data.byConstellation) {
      rows.push([
        'Constellation',
        String(row.constellationId),
        row.name,
        String(row.isk),
        String(row.m3),
        String(row.sessions),
        String(row.durationMs ?? ''),
        iskPerHour(row.isk, row.durationMs),
      ])
    }
    for (const row of data.bySolarSystem) {
      rows.push([
        'System',
        String(row.solarSystemId),
        row.name,
        String(row.isk),
        String(row.m3),
        String(row.sessions),
        String(row.durationMs ?? ''),
        iskPerHour(row.isk, row.durationMs),
      ])
    }
    for (const row of data.byRegion) {
      rows.push([
        'Region',
        String(row.regionId),
        row.name,
        String(row.isk),
        String(row.m3),
        String(row.sessions),
        String(row.durationMs ?? ''),
        iskPerHour(row.isk, row.durationMs),
      ])
    }
    for (const row of data.byCharacter) {
      rows.push([
        'Character',
        row.key,
        row.label,
        String(row.isk),
        String(row.m3),
        String(row.sessions),
        String(row.durationMs ?? ''),
        iskPerHour(row.isk, row.durationMs),
      ])
    }

    const csv = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `miners_rest_export_${Date.now()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <TooltipProvider delayDuration={200}>
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-xl border',
              theme.headerIconBox
            )}
          >
            <Icon className={cn('h-6 w-6', theme.headerIcon)} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-eve-text">{t('minersRest.pageTitle')}</h1>
            <p className="text-sm text-zinc-500">{t('minersRest.pageSubtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn('border-opacity-30', theme.chip)}
                onClick={handleExport}
                disabled={!hasPremium || !data}
              >
                {hasPremium ? (
                  <Download className="mr-2 h-3.5 w-3.5" />
                ) : (
                  <Lock className="mr-2 h-3.5 w-3.5" />
                )}
                {hasPremium ? t('minersRest.export') : t('activity.footer.premiumOnly')}
              </Button>
            </TooltipTrigger>
            {!hasPremium && (
              <TooltipContent>{t('activity.footer.premiumOnly')}</TooltipContent>
            )}
          </Tooltip>

          <Button asChild variant="ghost" size="sm" className="text-zinc-400">
            <Link href="/dashboard/activity?type=mining">{t('minersRest.backToTracker')}</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[160px] border-zinc-800 bg-zinc-900">
            <SelectValue placeholder={t('minersRest.filters.period')} />
          </SelectTrigger>
          <SelectContent className="border-zinc-800 bg-zinc-900">
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {t(`minersRest.period.${opt.value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[160px] border-zinc-800 bg-zinc-900">
            <SelectValue placeholder={t('activity.mining.miningType')} />
          </SelectTrigger>
          <SelectContent className="border-zinc-800 bg-zinc-900">
            <SelectItem value={ALL}>{t('activity.mining.intel.allCategories')}</SelectItem>
            {MINING_TYPES.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={space} onValueChange={setSpace}>
          <SelectTrigger className="w-[160px] border-zinc-800 bg-zinc-900">
            <SelectValue placeholder={t('activity.intel.spaceFilter')} />
          </SelectTrigger>
          <SelectContent className="border-zinc-800 bg-zinc-900">
            <SelectItem value={ALL}>{t('activity.intel.allSpaces')}</SelectItem>
            {SPACE_TYPES.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {characters.length > 0 ? (
          <Select value={characterId} onValueChange={setCharacterId}>
            <SelectTrigger className="w-[180px] border-zinc-800 bg-zinc-900">
              <SelectValue placeholder={t('minersRest.filters.character')} />
            </SelectTrigger>
            <SelectContent className="border-zinc-800 bg-zinc-900">
              <SelectItem value={ALL}>{t('minersRest.filters.allCharacters')}</SelectItem>
              {characters.map((char) => (
                <SelectItem key={char.id} value={String(char.id)}>
                  {char.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('activity.intel.refresh')}
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList className={cn('border-b', theme.panel)}>
          <TabsTrigger value="personal">{t('minersRest.tabs.personal')}</TabsTrigger>
          <TabsTrigger value="geo">{t('minersRest.tabs.geo')}</TabsTrigger>
          <TabsTrigger value="community">{t('minersRest.tabs.community')}</TabsTrigger>
          <TabsTrigger value="tools">{t('minersRest.tabs.tools')}</TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <PersonalOverviewPanel data={data} loading={loading} />
        </TabsContent>

        <TabsContent value="geo">
          <GeoBreakdownPanel data={data} loading={loading} />
        </TabsContent>

        <TabsContent value="community">
          <CommunityComparePanel
            overview={data}
            category={category === ALL ? undefined : category}
            space={space === ALL ? undefined : space}
            days={days}
          />
        </TabsContent>

        <TabsContent value="tools" className="space-y-8">
          <MinersRestPricesProvider>
            <WhatToMinePanel
              space={space === ALL ? undefined : space}
              category={category === ALL ? undefined : category}
            />
            <ReprocessingCalculatorPanel />
            <CompressionComparatorPanel space={space === ALL ? undefined : space} />
            <MarketReferencePanel />
          </MinersRestPricesProvider>
        </TabsContent>
      </Tabs>
    </div>
    </TooltipProvider>
  )
}
