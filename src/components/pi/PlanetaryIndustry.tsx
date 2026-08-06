'use client'

import { useEffect, useMemo, useState } from 'react'
import { Factory, Loader2, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePiColonies } from '@/lib/hooks/use-pi-colonies'
import { usePiConfig } from '@/lib/hooks/use-pi-config'
import { usePiViewPrefs } from '@/lib/hooks/use-pi-view-prefs'
import { useTranslations } from '@/i18n/hooks'
import { useSession } from '@/lib/session-client'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PiSummaryBar } from './PiSummaryBar'
import { PiPortfolioAlertBanner } from './PiPortfolioAlertBanner'
import { CharacterPlanetGroup } from './CharacterPlanetGroup'
import { PlanetDetailModal } from './PlanetDetailModal'
import { ShoppingListView } from './ShoppingListView'
import { PiAdvancedSettingsModal } from './PiAdvancedSettingsModal'
import type { PiColonyAnalysis } from '@/lib/pi/types'

const ALL = '__all__'

export function PlanetaryIndustry() {
  const { t } = useTranslations()
  const { data: session } = useSession()
  const [characterId, setCharacterId] = useState(ALL)
  // Factory-only colonies have current === potential, so the old current/potential
  // toggle did nothing for most planets. The view is always "current"; potential
  // surfaces as secondary text only where it actually differs (extractor decay).
  const rateMode = 'current' as const
  const [view, setView] = useState<'planets' | 'shopping'>('planets')
  const [selectedColony, setSelectedColony] = useState<PiColonyAnalysis | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [planetSearch, setPlanetSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  // "warnings" = problems first (default); "system" = by solar system name.
  const [planetSort, setPlanetSort] = useState<'warnings' | 'system'>('warnings')
  const [regions, setRegions] = useState<Array<{ id: number; name: string }>>([])
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(planetSearch)
    }, 300)
    return () => clearTimeout(handler)
  }, [planetSearch])

  useEffect(() => {
    let cancelled = false
    fetch('/api/pi/regions')
      .then((r) => (r.ok ? r.json() : { regions: [] }))
      .then((d) => {
        if (!cancelled) setRegions(Array.isArray(d.regions) ? d.regions : [])
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const params = useMemo(
    () => ({
      characterId:
        characterId === ALL ? undefined : Number.parseInt(characterId, 10),
    }),
    [characterId]
  )

  const { data, loading, refreshing, error, refetch, backgroundRefetch } = usePiColonies(params)
  const { preferences, savePlanetConfig, savePreferences, refetch: refetchConfig } = usePiConfig()
  const { showSuggestions, showWarnings, setShowSuggestions, setShowWarnings } = usePiViewPrefs()
  const characters = session?.user?.characters ?? []

  const refreshAll = () => {
    void refetchConfig()
    void refetch()
  }

  useEffect(() => {
    // Silent background poll: re-simulates buffer countdowns on the server's
    // already-cached ESI data (no forced ESI fetch). ESI is only re-hit when its
    // own cache expires (planets list ~30 min; layouts only when last_update
    // changes), or instantly via the manual refresh button.
    // Paused while the tab is hidden so background tabs generate zero traffic.
    let timer: ReturnType<typeof setInterval> | null = null
    const start = () => {
      if (timer == null) timer = setInterval(() => void backgroundRefetch(), 60 * 1000)
    }
    const stop = () => {
      if (timer != null) {
        clearInterval(timer)
        timer = null
      }
    }
    const onVisibility = () => {
      if (document.hidden) {
        stop()
      } else {
        void backgroundRefetch()
        start()
      }
    }
    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [backgroundRefetch])

  const coloniesByCharacter = useMemo(() => {
    if (!data) return []
    const groups = new Map<number, PiColonyAnalysis[]>()
    for (const colony of data.colonies) {
      const list = groups.get(colony.characterId) ?? []
      list.push(colony)
      groups.set(colony.characterId, list)
    }

    const charList =
      characterId === ALL
        ? characters
        : characters.filter((c) => String(c.id) === characterId)

    return charList
      .map((char) => ({
        characterId: char.id,
        characterName: char.name,
        colonies: groups.get(char.id) ?? [],
      }))
      // In the "all characters" view, hide alts with no colonies (e.g. Fleet
      // Citizens with 0 planets) so they don't dilute the list. When a specific
      // character is selected we keep them, so the empty state still shows.
      .filter((group) => characterId !== ALL || group.colonies.length > 0)
      .sort((a, b) => a.characterName.localeCompare(b.characterName))
  }, [data, characters, characterId])

  const filteredColoniesByCharacter = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase()
    return coloniesByCharacter.map((group) => ({
      ...group,
      colonies: [...group.colonies]
        .filter((colony) => {
          if (!query) return true
          const haystack = [
            colony.planetTypeLabel,
            colony.planetName ?? '',
            colony.solarSystemName,
            colony.exitName ?? '',
            colony.entryName ?? '',
            colony.characterName,
          ]
            .join(' ')
            .toLowerCase()
          return haystack.includes(query)
        })
        .sort((a, b) => {
          if (planetSort === 'system') {
            return a.solarSystemName.localeCompare(b.solarSystemName)
          }
          // "warnings" (default): problems first, so a stalled or stale colony
          // floats to the top of its character group.
          const score = (c: PiColonyAnalysis) =>
            c.warnings.length + (c.isStale ? 1 : 0) + (c.extractors.some((e) => e.isExpired) ? 1 : 0)
          return score(b) - score(a)
        }),
    }))
  }, [coloniesByCharacter, debouncedSearch, planetSort])

  const openColonyModal = (colony: PiColonyAnalysis) => {
    setSelectedColony(colony)
    setModalOpen(true)
  }

  const modalColony =
    selectedColony && data
      ? data.colonies.find(
          (c) =>
            c.planetId === selectedColony.planetId &&
            c.characterId === selectedColony.characterId
        ) ?? selectedColony
      : selectedColony

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-400/10">
            <Factory className="h-6 w-6 text-violet-300" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-eve-text">{t('pi.pageTitle')}</h1>
            <p className="text-sm text-zinc-500">{t('pi.pageSubtitle')}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshAll}
          disabled={refreshing || (loading && !data)}
        >
          {refreshing || (loading && !data) ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            t('pi.refresh')
          )}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {characters.length > 0 ? (
          <Select value={characterId} onValueChange={setCharacterId}>
            <SelectTrigger className="w-[200px] border-zinc-800 bg-zinc-900">
              <SelectValue placeholder={t('pi.filters.character')} />
            </SelectTrigger>
            <SelectContent className="border-zinc-800 bg-zinc-900">
              <SelectItem value={ALL}>{t('pi.filters.allCharacters')}</SelectItem>
              {characters.map((char) => (
                <SelectItem key={char.id} value={String(char.id)}>
                  {char.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <Button
          variant="outline"
          size="sm"
          onClick={() => setSettingsOpen(true)}
          className="gap-1.5"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {t('pi.config.settingsButton')}
        </Button>

        <Tabs value={view} onValueChange={(v) => setView(v as 'planets' | 'shopping')}>
          <TabsList className="border border-zinc-800 bg-zinc-900">
            <TabsTrigger value="planets">{t('pi.views.planets')}</TabsTrigger>
            <TabsTrigger value="shopping">{t('pi.views.shopping')}</TabsTrigger>
          </TabsList>
        </Tabs>

        {view === 'planets' ? (
          <>
            <Input
              value={planetSearch}
              onChange={(e) => setPlanetSearch(e.target.value)}
              placeholder={t('pi.filters.searchPlanets')}
              className="max-w-xs border-zinc-800 bg-zinc-950"
            />
            <Select value={planetSort} onValueChange={(v) => setPlanetSort(v as typeof planetSort)}>
              <SelectTrigger className="w-[180px] border-zinc-800 bg-zinc-900">
                <SelectValue placeholder={t('pi.filters.sortBy')} />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-zinc-900">
                <SelectItem value="warnings">{t('pi.filters.sortWarnings')}</SelectItem>
                <SelectItem value="system">{t('pi.filters.sortSystem')}</SelectItem>
              </SelectContent>
            </Select>
          </>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {data && data.charactersWithoutScope.length > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          {t('pi.warnings.missingScope')} ({data.charactersWithoutScope.length})
        </div>
      ) : null}

      {data && (data.charactersFailed.length > 0 || data.planetsFailed.length > 0) ? (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 text-sm text-orange-200">
          {t('pi.warnings.partialFailure')} ({data.charactersFailed.length + data.planetsFailed.length})
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-violet-300" />
        </div>
      ) : null}

      {data ? (
        <>
          <PiPortfolioAlertBanner colonies={data.colonies} />
          <PiSummaryBar
            data={data}
            rateMode={rateMode}
            exportTaxRate={preferences.exportTaxRate}
            pricingMode={preferences.pricingMode}
            sellSource={preferences.sellSource ?? 'home_region'}
          />
          {view === 'planets' ? (
            data.colonies.length === 0 ? (
              <p className={cn('py-12 text-center text-sm text-zinc-500')}>
                {t('pi.empty.noColonies')}
              </p>
            ) : (
              <div className="space-y-4">
                {filteredColoniesByCharacter.map((group) => (
                  <CharacterPlanetGroup
                    key={group.characterId}
                    characterId={group.characterId}
                    characterName={group.characterName}
                    colonies={group.colonies}
                    rateMode={rateMode}
                    showWarnings={showWarnings}
                    onSelectColony={openColonyModal}
                    defaultOpen={false}
                  />
                ))}
              </div>
            )
          ) : (
            <ShoppingListView
              colonies={data.colonies}
              rateMode={rateMode}
              buyStructureName={preferences.buyStructureName}
              buyStructureName2={preferences.buyStructureName2}
            />
          )}
        </>
      ) : null}

      {!loading && !data && !error ? (
        <p className="py-12 text-center text-sm text-zinc-500">{t('pi.empty.noData')}</p>
      ) : null}

      <PiAdvancedSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        preferences={preferences}
        onSavePreferences={(patch) => savePreferences(patch).then(refreshAll)}
        regions={regions}
        showSuggestions={showSuggestions}
        showWarnings={showWarnings}
        onShowSuggestionsChange={setShowSuggestions}
        onShowWarningsChange={setShowWarnings}
      />

      <PlanetDetailModal
        colony={modalColony}
        open={modalOpen}
        onOpenChange={setModalOpen}
        rateMode={rateMode}
        exportTaxRate={preferences.exportTaxRate}
        showSuggestions={showSuggestions}
        showWarnings={showWarnings}
        onConfigChange={async (input) => {
          await savePlanetConfig(input)
          refreshAll()
        }}
      />
    </div>
  )
}
