'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Factory, Loader2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { useSession } from '@/lib/session-client'
import { usePiV2Portfolio } from '@/lib/hooks/use-pi-v2-portfolio'
import { usePiV2Shopping } from '@/lib/hooks/use-pi-v2-shopping'
import { usePiV2ViewPrefs } from '@/lib/hooks/use-pi-v2-view-prefs'
import { groupColoniesByCharacter } from '@/lib/pi-v2/grouping'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PortfolioColony } from '@/lib/pi-v2/portfolio'
import type { ColonyPnlEntry } from '@/lib/pi-v2/shopping-types'
import type { ColonyBucket } from '@/lib/pi-v2/urgency'
import { PortfolioCounters } from './PortfolioCounters'
import { PortfolioNetSummary } from './PortfolioNetSummary'
import { ColonyCard } from './ColonyCard'
import { CharacterGroup } from './CharacterGroup'
import { ColonyDetail } from './ColonyDetail'
import { ShoppingView } from './ShoppingView'
import { DeliveryView } from './DeliveryView'
import { WarehouseView } from './WarehouseView'

const ALL = '__all__'
/** Poll silencioso: reprojeta sobre a ESI já cacheada, sem chamada nova. */
const POLL_MS = 60_000

/**
 * Portfólio do PI v2 — a resposta à pergunta 1.
 *
 * A lista já vem ordenada por urgência do servidor: a ordem é regra de negócio,
 * não preferência de tela. Aqui só se filtra e se agrupa.
 */
export function PiV2Portfolio() {
  const { t } = useTranslations()
  const { data: session } = useSession()
  const characters = session?.user?.characters ?? []

  const [characterId, setCharacterId] = useState(ALL)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filter, setFilter] = useState<ColonyBucket | null>(null)
  const [selected, setSelected] = useState<PortfolioColony | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [view, setView] = useState<'planets' | 'shopping' | 'delivery' | 'warehouse'>('planets')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const params = useMemo(
    () => ({ characterId: characterId === ALL ? undefined : Number.parseInt(characterId, 10) }),
    [characterId]
  )
  const { data, loading, refreshing, error, unavailable, refetch, backgroundPoll } =
    usePiV2Portfolio(params)
  const {
    groupByCharacter,
    setGroupByCharacter,
    shoppingPeriodHrs,
    setShoppingPeriodHrs,
    baseHub,
    hubs,
    setBaseHub,
    setHubs,
    warehouseContainers,
    setWarehouseContainers,
    seedFromLegacy,
    rememberContract,
    recallContract,
  } = usePiV2ViewPrefs()

  /**
   * A economia (lista de compra + P&L) vive num fetch só, elevado até aqui.
   *
   * Duas telas consomem o mesmo resultado: a lista de compra e o P&L do detalhe,
   * mais o NET agregado do topo. Buscar duas vezes gastaria orçamento de ESI para
   * produzir os mesmos números — e, pior, poderia mostrar dois totais diferentes
   * se os books chegassem em instantes distintos.
   *
   * Diferente do portfólio, **não há poll aqui**: mercado não se repuxa a cada
   * 60s enquanto o jogador está lendo um número para decidir uma compra.
   */
  const economy = usePiV2Shopping({
    periodHours: shoppingPeriodHrs,
    base: baseHub,
    hubs,
    warehouseContainers,
    characterId: params.characterId,
  })

  const pnlByColony = useMemo(() => {
    const map = new Map<string, ColonyPnlEntry>()
    for (const entry of economy.data?.pnl ?? []) {
      map.set(`${entry.characterId}-${entry.planetId}`, entry)
    }
    return map
  }, [economy.data])

  useEffect(() => {
    // Pausado com a aba escondida: aba em segundo plano gera zero tráfego.
    let timer: ReturnType<typeof setInterval> | null = null
    const start = () => {
      if (timer == null) timer = setInterval(() => void backgroundPoll(), POLL_MS)
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
        void backgroundPoll()
        start()
      }
    }
    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [backgroundPoll])

  const visibleColonies = useMemo(() => {
    if (!data) return []
    const query = debouncedSearch.trim().toLowerCase()
    return data.colonies.filter((colony) => {
      if (filter && colony.urgency.bucket !== filter) return false
      if (!query) return true
      return [
        colony.planetName ?? '',
        colony.solarSystemName,
        colony.characterName,
        colony.planetTypeLabel,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
  }, [data, debouncedSearch, filter])

  const characterGroups = useMemo(
    () => groupColoniesByCharacter(visibleColonies),
    [visibleColonies]
  )

  const openDetail = useCallback((colony: PortfolioColony) => {
    setSelected(colony)
    setDetailOpen(true)
  }, [])

  // O detalhe segue o dado fresco do poll: reabrir a mesma colônia não pode
  // mostrar um estado congelado no instante em que o modal abriu.
  const detailColony = useMemo(() => {
    if (!selected || !data) return selected
    return (
      data.colonies.find(
        (c) => c.planetId === selected.planetId && c.characterId === selected.characterId
      ) ?? selected
    )
  }, [selected, data])

  if (unavailable) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm text-zinc-400">
          {t('piV2.unavailable')}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-400/10">
            <Factory className="h-5 w-5 text-violet-300" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-eve-text">{t('piV2.title')}</h1>
            <p className="text-xs text-zinc-500">{t('piV2.subtitle')}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={refreshing}>
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : t('piV2.refresh')}
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {data && data.charactersWithoutScope.length > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          {t('piV2.warnings.missingScope', { count: data.charactersWithoutScope.length })}
        </div>
      ) : null}

      {data && (data.charactersFailed.length > 0 || data.planetsFailed.length > 0) ? (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-200">
          {t('piV2.warnings.partialFailure', {
            count: data.charactersFailed.length + data.planetsFailed.length,
          })}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-violet-300" />
        </div>
      ) : null}

      {data ? (
        <>
          <PortfolioCounters
            counters={data.counters}
            activeFilter={filter}
            onFilterChange={setFilter}
          />

          {/* Quanto o PI rende, somando as colônias. É a resposta que o jogador
              vem buscar, então fica antes das listas. */}
          <PortfolioNetSummary
            totals={economy.data?.pnlTotals}
            loading={economy.loading}
            error={economy.error}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
              <TabsList className="border border-zinc-800 bg-zinc-900">
                <TabsTrigger value="planets">{t('piV2.views.planets')}</TabsTrigger>
                <TabsTrigger value="shopping">{t('piV2.views.shopping')}</TabsTrigger>
                <TabsTrigger value="delivery">{t('piV2.views.delivery')}</TabsTrigger>
                <TabsTrigger value="warehouse">{t('piV2.views.warehouse')}</TabsTrigger>
              </TabsList>
            </Tabs>

            {characters.length > 0 ? (
              <Select value={characterId} onValueChange={setCharacterId}>
                <SelectTrigger className="w-[190px] border-zinc-800 bg-zinc-900">
                  <SelectValue placeholder={t('piV2.filters.character')} />
                </SelectTrigger>
                <SelectContent className="border-zinc-800 bg-zinc-900">
                  <SelectItem value={ALL}>{t('piV2.filters.allCharacters')}</SelectItem>
                  {characters.map((char) => (
                    <SelectItem key={char.id} value={String(char.id)}>
                      {char.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            {view === 'planets' ? (
              <>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('piV2.filters.search')}
                  className="max-w-xs border-zinc-800 bg-zinc-950"
                />
                <Button
                  variant="outline"
                  size="sm"
                  aria-pressed={groupByCharacter}
                  onClick={() => setGroupByCharacter(!groupByCharacter)}
                  className={cn(
                    'gap-1.5',
                    groupByCharacter && 'border-violet-400/40 text-violet-200'
                  )}
                >
                  <Users className="h-3.5 w-3.5" />
                  {t('piV2.filters.groupByCharacter')}
                </Button>
              </>
            ) : null}
          </div>

          {view === 'shopping' ? (
            <ShoppingView
              periodHours={shoppingPeriodHrs}
              baseHub={baseHub}
              hubs={hubs}
              economy={economy}
              onPeriodChange={setShoppingPeriodHrs}
              onBaseChange={setBaseHub}
              onHubsChange={setHubs}
              onSeedLegacy={seedFromLegacy}
              onRememberContract={rememberContract}
              onRecallContract={recallContract}
            />
          ) : null}

          {view === 'delivery' ? (
            // Mesmo resultado da economia, virado do avesso: por destino em vez
            // de por hub. Nenhuma busca nova — o `breakdown` já vem com a lista.
            <DeliveryView
              lines={economy.data?.lines ?? []}
              periodHours={shoppingPeriodHrs}
              loading={economy.loading}
              error={economy.error}
            />
          ) : null}

          {view === 'warehouse' ? (
            <WarehouseView
              data={economy.data?.warehouse}
              containers={warehouseContainers}
              baseHub={baseHub}
              loading={economy.loading}
              onContainersChange={setWarehouseContainers}
            />
          ) : null}

          {view !== 'planets' ? null : data.colonies.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">{t('piV2.empty.noColonies')}</p>
          ) : visibleColonies.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">{t('piV2.empty.noMatches')}</p>
          ) : groupByCharacter ? (
            // Agrupado: a ordem de logar (personagem mais urgente primeiro) e,
            // dentro de cada bloco, a ordem de atacar.
            <div className="space-y-5">
              {characterGroups.map((group) => (
                <CharacterGroup
                  key={group.characterId}
                  group={group}
                  onSelectColony={openDetail}
                />
              ))}
            </div>
          ) : (
            // Grid denso: 32+ colônias precisam caber numa tela sem rolagem infinita.
            <div className={cn('grid gap-2', 'sm:grid-cols-2 lg:grid-cols-3')}>
              {visibleColonies.map((colony) => (
                <ColonyCard
                  key={`${colony.characterId}-${colony.planetId}`}
                  colony={colony}
                  onClick={() => openDetail(colony)}
                />
              ))}
            </div>
          )}
        </>
      ) : null}

      <ColonyDetail
        colony={detailColony}
        pnl={
          detailColony
            ? pnlByColony.get(`${detailColony.characterId}-${detailColony.planetId}`)
            : undefined
        }
        sellHub={economy.data?.sellHub}
        economyLoading={economy.loading}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  )
}
