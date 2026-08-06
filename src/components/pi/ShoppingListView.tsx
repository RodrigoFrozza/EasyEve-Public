'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  ShoppingCart,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  buildShoppingList,
  toMultibuyText,
  type ShoppingListItem,
  type ShoppingListPlanet,
} from '@/lib/pi/shopping-list'
import {
  isDeficientAtPrimary,
  findCheapestAndPriciest,
  type ShoppingPriceRow,
  type ShoppingPriceSourceKey,
} from '@/lib/pi/shopping-prices'
import { getCommodityVolume } from '@/lib/pi/pi-static-data'
import type { PiColonyAnalysis } from '@/lib/pi/types'
import { MarketHistoryChart } from '@/components/pi/MarketHistoryChart'

type Level = 'character' | 'total' | 'planet'

function useShoppingPrices(typeIds: number[]): {
  prices: Record<number, ShoppingPriceRow>
  loading: boolean
} {
  const [prices, setPrices] = useState<Record<number, ShoppingPriceRow>>({})
  const [loading, setLoading] = useState(false)
  const key = [...new Set(typeIds)].sort((a, b) => a - b).join(',')

  useEffect(() => {
    if (!key) {
      setPrices({})
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(`/api/pi/shopping-prices?typeIds=${key}`)
      .then((r) => (r.ok ? r.json() : { prices: {} }))
      .then((d) => {
        if (!cancelled) setPrices(d.prices ?? {})
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { prices, loading }
}

function PriceCell({
  source,
  signal,
}: {
  source?: { price: number; available: number; stale?: boolean }
  signal?: 'cheapest' | 'priciest'
}) {
  const { t } = useTranslations()
  if (!source) return <span className="text-zinc-700">—</span>
  return (
    <div className="flex flex-col items-end leading-tight">
      <span className="flex items-center gap-1">
        {source.stale ? (
          <AlertTriangle
            className="h-3 w-3 text-amber-400"
            aria-label={t('pi.shopping.staleData')}
          />
        ) : signal === 'cheapest' ? (
          <ArrowDown className="h-3 w-3 text-emerald-400" aria-label={t('pi.shopping.cheapest')} />
        ) : signal === 'priciest' ? (
          <ArrowUp className="h-3 w-3 text-red-400" aria-label={t('pi.shopping.priciest')} />
        ) : null}
        <span className={cn('tabular-nums', source.stale ? 'text-amber-300' : 'text-zinc-200')}>
          {source.price.toLocaleString()} {t('pi.shopping.iskUnit')}
        </span>
      </span>
      <span className="text-[10px] tabular-nums text-zinc-500">
        {source.available.toLocaleString()} {t('pi.shopping.unitsUnit')}
      </span>
      {source.stale ? (
        <span className="text-[9px] text-amber-500">{t('pi.shopping.staleData')}</span>
      ) : null}
    </div>
  )
}

function CopyMultibuyButton({ items, label }: { items: ShoppingListItem[]; label: string }) {
  const { t } = useTranslations()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toMultibuyText(items))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard blocked — ignore
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className="inline-flex items-center gap-1.5 rounded-md border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-500/20"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? t('pi.shopping.copied') : t('pi.shopping.copyMultibuy')}
    </button>
  )
}

type HubNames = { primary: string; secondary: string }

function csvCell(value: string | number): string {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Build a CSV of a shopping section with the primary/secondary hub prices and
 * per-item volume, so it can be taken into a spreadsheet for a buy run. */
function buildShoppingCsv(
  items: ShoppingListItem[],
  prices: Record<number, ShoppingPriceRow>,
  hubs: HubNames
): string {
  const header = [
    'item',
    'quantidade',
    'preco_unitario',
    'custo_total',
    'hub_primario',
    'preco_primario',
    'hub_secundario',
    'preco_secundario',
    'volume_m3',
  ]
  const rows = items.map((i) => {
    const row = prices[i.typeId]
    const primaryPrice = row?.primary?.price ?? 0
    const secondaryPrice = row?.secondary?.price ?? 0
    const jitaPrice = row?.jita?.price ?? 0
    // Unit cost basis = the primary hub you'd actually buy from, falling back to Jita.
    const unit = primaryPrice || jitaPrice
    const volume = getCommodityVolume(i.typeId) * i.quantity
    return [
      i.name,
      i.quantity,
      Math.round(unit),
      Math.round(unit * i.quantity),
      row?.primary ? hubs.primary : '',
      row?.primary ? Math.round(primaryPrice) : '',
      row?.secondary ? hubs.secondary : '',
      row?.secondary ? Math.round(secondaryPrice) : '',
      Math.round(volume * 100) / 100,
    ]
  })
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')
}

function safeFilename(label: string): string {
  return label.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'shopping'
}

function downloadCsv(filename: string, csv: string) {
  // Prefix a BOM so Excel reads accented item/hub names as UTF-8.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function ExportCsvButton({
  items,
  prices,
  hubs,
  label,
}: {
  items: ShoppingListItem[]
  prices: Record<number, ShoppingPriceRow>
  hubs: HubNames
  label: string
}) {
  const { t } = useTranslations()
  return (
    <button
      type="button"
      onClick={() =>
        downloadCsv(`pi-shopping-${safeFilename(label)}.csv`, buildShoppingCsv(items, prices, hubs))
      }
      aria-label={t('pi.shopping.exportCsv')}
      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/60 px-2.5 py-1 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700/60"
    >
      <Download className="h-3.5 w-3.5" />
      {t('pi.shopping.exportCsv')}
    </button>
  )
}

function ItemTable({
  items,
  prices,
  hasPriceData,
}: {
  items: ShoppingListItem[]
  prices: Record<number, ShoppingPriceRow>
  hasPriceData: boolean
}) {
  const { t } = useTranslations()
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
            <th className="py-1.5 text-left font-semibold">{t('pi.shopping.item')}</th>
            <th className="py-1.5 text-right font-semibold">{t('pi.shopping.perHour')}</th>
            <th className="py-1.5 text-right font-semibold">{t('pi.shopping.quantity')}</th>
            {hasPriceData ? (
              <>
                <th className="py-1.5 text-right font-semibold">{t('pi.shopping.primary')}</th>
                <th className="py-1.5 text-right font-semibold">{t('pi.shopping.secondary')}</th>
                <th className="py-1.5 text-right font-semibold">{t('pi.shopping.jita')}</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {items.map((i) => {
            const row = prices[i.typeId]
            const deficient = hasPriceData && isDeficientAtPrimary(row, i.quantity)
            const { cheapest, priciest } = findCheapestAndPriciest(row)
            const signalFor = (key: ShoppingPriceSourceKey) =>
              cheapest === key ? 'cheapest' : priciest === key ? 'priciest' : undefined
            return (
              <tr
                key={i.typeId}
                className={cn('border-b border-zinc-900', deficient && 'bg-red-500/10')}
              >
                <td className={cn('py-1.5', deficient ? 'text-red-300' : 'text-zinc-200')}>
                  <div className="flex items-center gap-1.5">
                    <span>{i.name}</span>
                    <MarketHistoryChart typeId={i.typeId} typeName={i.name} />
                  </div>
                </td>
                <td className="py-1.5 text-right tabular-nums text-zinc-500">
                  {i.perHour.toLocaleString()}
                </td>
                <td
                  className={cn(
                    'py-1.5 text-right font-medium tabular-nums',
                    deficient ? 'text-red-300' : 'text-zinc-100'
                  )}
                >
                  {i.quantity.toLocaleString()}
                </td>
                {hasPriceData ? (
                  <>
                    <td className="py-1.5">
                      <PriceCell source={row?.primary} signal={signalFor('primary')} />
                    </td>
                    <td className="py-1.5">
                      <PriceCell source={row?.secondary} signal={signalFor('secondary')} />
                    </td>
                    <td className="py-1.5">
                      <PriceCell source={row?.jita} signal={signalFor('jita')} />
                    </td>
                  </>
                ) : null}
              </tr>
            )
          })}
        </tbody>
      </table>
      {hasPriceData ? (
        <p className="mt-2 text-[10px] text-zinc-600">{t('pi.shopping.priceColumnsHint')}</p>
      ) : null}
    </div>
  )
}

/** perPlanet arrives pre-sorted by character then planet (shopping-list.ts) — this
 * just clusters the already-adjacent rows so the UI can render one character group
 * with its planets nested inside, instead of repeating the character name on every
 * planet section. */
function groupPlanetsByCharacter(
  perPlanet: ShoppingListPlanet[]
): { characterId: number; characterName: string; planets: ShoppingListPlanet[] }[] {
  const groups: { characterId: number; characterName: string; planets: ShoppingListPlanet[] }[] = []
  for (const planet of perPlanet) {
    const last = groups[groups.length - 1]
    if (last && last.characterId === planet.characterId) {
      last.planets.push(planet)
    } else {
      groups.push({ characterId: planet.characterId, characterName: planet.characterName, planets: [planet] })
    }
  }
  return groups
}

function ListSection({
  title,
  items,
  prices,
  hasPriceData,
  hubs,
  collapsed,
  onToggle,
}: {
  title: string
  items: ShoppingListItem[]
  prices: Record<number, ShoppingPriceRow>
  hasPriceData: boolean
  hubs: HubNames
  collapsed: boolean
  onToggle: () => void
}) {
  if (items.length === 0) return null
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className="flex min-w-0 items-center gap-1.5 font-semibold text-eve-text"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
          )}
          <span className="truncate">{title}</span>
          <span className="shrink-0 text-xs font-normal text-zinc-500">({items.length})</span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <ExportCsvButton items={items} prices={prices} hubs={hubs} label={title} />
          <CopyMultibuyButton items={items} label={title} />
        </div>
      </div>
      {collapsed ? null : (
        <div className="mt-2">
          <ItemTable items={items} prices={prices} hasPriceData={hasPriceData} />
        </div>
      )}
    </div>
  )
}

type ShoppingPrefs = { level: Level; collapsed: Record<string, boolean> }
const SHOPPING_PREFS_KEY = 'pi:shoppingPrefs'
const SHOPPING_DEFAULTS: ShoppingPrefs = { level: 'character', collapsed: {} }

function readShoppingPrefs(): ShoppingPrefs {
  if (typeof window === 'undefined') return SHOPPING_DEFAULTS
  try {
    const raw = window.localStorage.getItem(SHOPPING_PREFS_KEY)
    if (!raw) return SHOPPING_DEFAULTS
    const parsed = JSON.parse(raw) as Partial<ShoppingPrefs>
    return {
      level: parsed.level ?? SHOPPING_DEFAULTS.level,
      collapsed: parsed.collapsed ?? {},
    }
  } catch {
    return SHOPPING_DEFAULTS
  }
}

export function ShoppingListView({
  colonies,
  rateMode,
  buyStructureName,
  buyStructureName2,
}: {
  colonies: PiColonyAnalysis[]
  rateMode: 'potential' | 'current'
  buyStructureName?: string | null
  buyStructureName2?: string | null
}) {
  const { t } = useTranslations()
  const [periodHours, setPeriodHours] = useState(24)
  // Level tab + per-section collapse persist to localStorage (client-only display
  // state, same pattern as use-pi-view-prefs). Start from defaults so SSR and the
  // first client render agree; hydrate right after mount.
  const [prefs, setPrefs] = useState<ShoppingPrefs>(SHOPPING_DEFAULTS)
  useEffect(() => setPrefs(readShoppingPrefs()), [])

  const persist = useCallback((next: ShoppingPrefs) => {
    setPrefs(next)
    try {
      window.localStorage.setItem(SHOPPING_PREFS_KEY, JSON.stringify(next))
    } catch {
      // ignore storage failures (private mode, quota) — state still applies this session
    }
  }, [])

  const level = prefs.level
  const setLevel = (l: Level) => persist({ ...prefs, level: l })
  const isCollapsed = (key: string) => prefs.collapsed[key] ?? false
  const toggleCollapsed = (key: string) =>
    persist({ ...prefs, collapsed: { ...prefs.collapsed, [key]: !isCollapsed(key) } })

  const hubs: HubNames = {
    primary: buyStructureName || t('pi.shopping.primary'),
    secondary: buyStructureName2 || t('pi.shopping.secondary'),
  }

  const list = useMemo(
    () => buildShoppingList(colonies, Math.max(1, periodHours), rateMode),
    [colonies, periodHours, rateMode]
  )

  const totalTypeIds = useMemo(() => list.total.map((i) => i.typeId), [list.total])
  const { prices } = useShoppingPrices(totalTypeIds)
  const hasPriceData = totalTypeIds.length > 0

  const empty = list.total.length === 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-violet-300" />
          <span className="text-sm font-semibold text-eve-text">{t('pi.shopping.title')}</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500" htmlFor="pi-shopping-period">
            {t('pi.shopping.period')}
          </label>
          <Input
            id="pi-shopping-period"
            type="number"
            min={1}
            max={720}
            value={periodHours}
            onChange={(e) => setPeriodHours(Number(e.target.value) || 1)}
            className="h-8 w-20 border-zinc-800 bg-zinc-950 text-xs"
          />
          <span className="text-xs text-zinc-500">{t('pi.shopping.hours')}</span>
        </div>
        <Tabs value={level} onValueChange={(v) => setLevel(v as Level)}>
          <TabsList className="border border-zinc-800 bg-zinc-900">
            <TabsTrigger value="character">{t('pi.shopping.byCharacter')}</TabsTrigger>
            <TabsTrigger value="total">{t('pi.shopping.total')}</TabsTrigger>
            <TabsTrigger value="planet">{t('pi.shopping.byPlanet')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <p className="text-xs text-zinc-500">{t('pi.shopping.hint')}</p>

      {empty ? (
        <p className={cn('py-12 text-center text-sm text-zinc-500')}>{t('pi.shopping.empty')}</p>
      ) : level === 'total' ? (
        <ListSection
          title={t('pi.shopping.total')}
          items={list.total}
          prices={prices}
          hasPriceData={hasPriceData}
          hubs={hubs}
          collapsed={isCollapsed('total')}
          onToggle={() => toggleCollapsed('total')}
        />
      ) : level === 'character' ? (
        <div className="space-y-4">
          {list.perCharacter.map((c) => (
            <ListSection
              key={c.characterId}
              title={c.characterName}
              items={c.items}
              prices={prices}
              hasPriceData={hasPriceData}
              hubs={hubs}
              collapsed={isCollapsed(`char-${c.characterId}`)}
              onToggle={() => toggleCollapsed(`char-${c.characterId}`)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {groupPlanetsByCharacter(list.perPlanet).map((group) => (
            <div key={group.characterId} className="space-y-3">
              <h2 className="text-sm font-semibold text-violet-200">{group.characterName}</h2>
              <div className="space-y-4 border-l border-zinc-800 pl-4">
                {group.planets.map((p) => (
                  <ListSection
                    key={`${p.characterId}-${p.planetId}`}
                    title={p.planetLabel}
                    items={p.items}
                    prices={prices}
                    hasPriceData={hasPriceData}
                    hubs={hubs}
                    collapsed={isCollapsed(`planet-${p.characterId}-${p.planetId}`)}
                    onToggle={() => toggleCollapsed(`planet-${p.characterId}-${p.planetId}`)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
