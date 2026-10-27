'use client'

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, ChevronRight, Factory, Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { cn, formatISK, formatNumber } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TimeAgo } from '@/components/time-ago'
import { RecipeNode } from './RecipeNode'

/** Seconds → compact "1d 2h 3m" (drops zero parts; shows seconds only under a minute). */
function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s}s`
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return [d ? `${d}d` : '', h ? `${h}h` : '', m ? `${m}m` : ''].filter(Boolean).join(' ')
}

interface HubQuote {
  hubId: string
  hubName: string
  unitPrice: number
  cost: number
  sufficient: boolean
  noOrders: boolean
  stale: boolean
}

interface MaterialLine {
  typeId: number
  name: string
  requiredQuantity: number
  owned: number
  toBuy: number
  quotes: HubQuote[]
  cheapestHubId: string | null
  buyCost: number
  manufacturable?: boolean
}

interface HubTotal {
  hubId: string
  hubName: string
  total: number
  anyMissing: boolean
}

interface JobCost {
  total: number
  sccSurcharge: number
  facilityTax: number
}

interface OwnedBlueprint {
  characterId: number
  characterName: string
  materialEfficiency: number
  timeEfficiency: number
  runs: number
  isCopy: boolean
}

interface CostResult {
  runs: number
  me: number
  sellHubName: string
  activity: 'manufacturing' | 'reaction'
  rigApplied: boolean
  rigUnavailable: boolean
  reactorRigNote: boolean
  factoryName: string | null
  materials: MaterialLine[]
  totalMaterialCost: number
  hubTotals: HubTotal[]
  productName: string
  outputQuantity: number
  revenueImmediate: number
  revenueListed: number
  outputNoOrders: boolean
  profit: number
  margin: number
  anyStale: boolean
  anyThin: boolean
  anyNoPrice: boolean
  jobCost: JobCost | null
  jobCostSource: 'everef' | 'local_approx' | null
  jobCostUnavailable: boolean
  netRevenueListed: number | null
  revenueTaxPct: number | null
  netProfit: number
  netMargin: number
  buildTimeSeconds: number | null
  buildTimeSource: 'everef' | 'local_approx' | null
  iskPerHour: number | null
  skillMeta: {
    characterId: number
    characterName: string
    industry: number
    advancedIndustry: number
    capturedAt: string
    applied: boolean
  } | null
  ownedBlueprints: OwnedBlueprint[]
  ownedBestMe: number | null
  ownedBestTe: number | null
  te: number
}

export interface CalculatorPreset {
  typeId: number
  name: string
  /** Bumped each time so re-selecting the same item still triggers a load. */
  nonce: number
}

export function IndustryCalculator({
  configVersion = 0,
  preset = null,
}: {
  configVersion?: number
  preset?: CalculatorPreset | null
}) {
  const { t } = useTranslations()
  const [query, setQuery] = useState('')
  const [product, setProduct] = useState('')
  const [productTypeId, setProductTypeId] = useState(0)
  const [suggestions, setSuggestions] = useState<{ typeId: number; name: string }[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [runs, setRuns] = useState(1)
  const [me, setMe] = useState(0)
  const [te, setTe] = useState(0)
  const [owned, setOwned] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CostResult | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const recalc = useCallback(
    async (name: string, ownedMap: Record<number, number>) => {
      if (!name.trim()) return
      setLoading(true)
      try {
        const res = await fetch('/api/industry/blueprint-cost', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productTypeId: productTypeId || undefined, productName: name, runs, me, te, owned: ownedMap }),
        })
        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error ?? t('industry.genericError'))
          setResult(null)
          return
        }
        setResult(data as CostResult)
      } catch {
        toast.error(t('industry.genericError'))
      } finally {
        setLoading(false)
      }
    },
    [runs, me, te, t, productTypeId]
  )

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2 || q === product) {
      setSuggestions([])
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      fetch(`/api/industry/product-search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d) => !cancelled && (setSuggestions(d.items ?? []), setShowSuggestions(true)))
        .catch(() => undefined)
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, product])

  // Recompute when the product, params, owned, or saved config change.
  useEffect(() => {
    if (!product) return
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => void recalc(product, owned), 400)
    return () => {
      if (debounce.current) clearTimeout(debounce.current)
    }
  }, [product, runs, me, te, owned, configVersion, recalc])

  const search = (typeId = 0, name = query.trim()) => {
    if (!name) {
      toast.error(t('industry.emptyError'))
      return
    }
    setOwned({})
    setProductTypeId(typeId)
    setQuery(name)
    setProduct(name)
    setShowSuggestions(false)
  }

  // Load the item when opened from the scanner (nonce changes even for the same id).
  useEffect(() => {
    if (!preset) return
    setOwned({})
    setProductTypeId(preset.typeId)
    setQuery(preset.name)
    setProduct(preset.name)
    setShowSuggestions(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset?.nonce])

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500">{t('industry.subtitle')}</p>

      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="relative">
          <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-2">
            <Search className="h-4 w-4 shrink-0 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setProductTypeId(0)
              }}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder={t('industry.itemPlaceholder')}
              className="h-9 w-full bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
            />
            <Button onClick={() => search()} size="sm" disabled={loading} className="gap-1.5">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Factory className="h-3.5 w-3.5" />}
              {t('industry.calculate')}
            </Button>
          </div>
          {showSuggestions && suggestions.length > 0 ? (
            <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-zinc-800 bg-zinc-950 py-1 shadow-xl">
              {suggestions.map((s) => (
                <li key={s.typeId}>
                  <button
                    type="button"
                    onClick={() => search(s.typeId, s.name)}
                    className="block w-full truncate px-3 py-1.5 text-left text-sm text-zinc-300 hover:bg-violet-500/10 hover:text-violet-100"
                  >
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-zinc-500">
            {t('industry.runs')}
            <Input
              type="number"
              min={1}
              max={10000}
              value={runs}
              onChange={(e) => setRuns(Math.max(1, Number(e.target.value) || 1))}
              className="h-8 w-20 border-zinc-800 bg-zinc-950 text-xs"
            />
          </label>
          {result?.activity === 'reaction' ? (
            <span className="text-xs text-zinc-500">{t('industry.reactionNoMe')}</span>
          ) : (
            <>
              <label className="flex items-center gap-2 text-xs text-zinc-500">
                {t('industry.me')}
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={me}
                  onChange={(e) => setMe(Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
                  className="h-8 w-16 border-zinc-800 bg-zinc-950 text-xs"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-500">
                {t('industry.te')}
                <Input
                  type="number"
                  min={0}
                  max={20}
                  value={te}
                  onChange={(e) => setTe(Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
                  className="h-8 w-16 border-zinc-800 bg-zinc-950 text-xs"
                />
              </label>
            </>
          )}
        </div>
      </div>

      {result ? (
        <CostResultView result={result} owned={owned} setOwned={setOwned} me={me} setMe={setMe} te={te} setTe={setTe} />
      ) : null}
    </div>
  )
}

function CostResultView({
  result,
  owned,
  setOwned,
  me,
  setMe,
  te,
  setTe,
}: {
  result: CostResult
  owned: Record<number, number>
  setOwned: (o: Record<number, number>) => void
  me: number
  setMe: (me: number) => void
  te: number
  setTe: (te: number) => void
}) {
  const { t } = useTranslations()
  const netProfitPositive = (result.netRevenueListed != null ? result.netProfit : result.profit) >= 0
  const multiHub = result.hubTotals.length > 1
  const cheapestTotal = Math.min(...result.hubTotals.map((h) => h.total).filter((n) => n > 0))
  const fullColSpan = multiHub ? 6 : 5
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [fillingFromAssets, setFillingFromAssets] = useState(false)
  const toggleExpand = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const fillFromAssets = useCallback(async () => {
    setFillingFromAssets(true)
    try {
      const res = await fetch('/api/industry/assets-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error ?? t('industry.genericError'))
        return
      }
      const stock: Record<number, number> = data.stock ?? {}
      const next = { ...owned }
      for (const m of result.materials) {
        next[m.typeId] = stock[m.typeId] ?? 0
      }
      setOwned(next)
      if (Array.isArray(data.failed) && data.failed.length > 0) {
        toast.warning(t('industry.assetsPartial', { count: data.failed.length }))
      }
      if (data.stale) {
        toast.warning(t('industry.assetsStale'))
      }
    } catch {
      toast.error(t('industry.genericError'))
    } finally {
      setFillingFromAssets(false)
    }
  }, [owned, result.materials, setOwned, t])

  return (
    <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="flex items-center gap-2 font-semibold text-eve-text">
        {result.productName}
        <span
          className={cn(
            'rounded-full border px-2 py-0.5 text-[10px] font-normal uppercase tracking-wider',
            result.activity === 'reaction'
              ? 'border-sky-500/30 bg-sky-500/10 text-sky-300'
              : 'border-zinc-700 bg-zinc-800/60 text-zinc-400'
          )}
        >
          {result.activity === 'reaction' ? t('industry.activityReaction') : t('industry.activityManufacturing')}
        </span>
        <span className="text-xs font-normal text-zinc-500">
          ×{formatNumber(result.outputQuantity)} · {t('industry.me')} {result.me} · {t('industry.sellAt')} {result.sellHubName}
          {result.rigApplied ? (
            <span className="ml-1 text-emerald-400">· {t('industry.rigApplied', { factory: result.factoryName ?? '' })}</span>
          ) : null}
        </span>
      </h2>

      {result.rigUnavailable ? (
        <p className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {t('industry.rigUnavailable')}
        </p>
      ) : null}

      {result.reactorRigNote ? (
        <p className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {t('industry.reactorRigNote')}
        </p>
      ) : null}

      {result.anyStale || result.anyThin || result.anyNoPrice ? (
        <p className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {t('industry.dataWarning')}
        </p>
      ) : null}

      {result.ownedBlueprints.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">{t('industry.ownedBlueprints')}</span>
          {result.ownedBlueprints.map((bp) => (
            <button
              key={`${bp.characterId}-${bp.isCopy}-${bp.materialEfficiency}-${bp.runs}`}
              type="button"
              // ME/TE research doesn't exist for reactions — clicking a chip must not
              // set meaningless efficiencies on a reaction result.
              onClick={
                result.activity === 'reaction'
                  ? undefined
                  : () => {
                      setMe(bp.materialEfficiency)
                      setTe(bp.timeEfficiency)
                    }
              }
              disabled={result.activity === 'reaction'}
              className={cn(
                'rounded-full border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[11px] text-zinc-300',
                result.activity === 'reaction' ? 'cursor-default opacity-70' : 'hover:border-violet-500/40 hover:text-violet-200'
              )}
            >
              {bp.isCopy
                ? t('industry.ownedChipCopy', { runs: bp.runs, me: bp.materialEfficiency, character: bp.characterName })
                : t('industry.ownedChipOriginal', {
                    me: bp.materialEfficiency,
                    te: bp.timeEfficiency,
                    character: bp.characterName,
                  })}
            </button>
          ))}
          {result.activity !== 'reaction' && result.ownedBestMe != null && result.ownedBestMe !== me ? (
            <button
              type="button"
              onClick={() => setMe(result.ownedBestMe!)}
              className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] text-violet-300 hover:bg-violet-500/20"
            >
              {t('industry.ownedBestHint', { me: result.ownedBestMe })}
            </button>
          ) : null}
          {result.activity !== 'reaction' && result.ownedBestTe != null && result.ownedBestTe !== te ? (
            <button
              type="button"
              onClick={() => setTe(result.ownedBestTe!)}
              className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] text-violet-300 hover:bg-violet-500/20"
            >
              {t('industry.ownedBestTeHint', { te: result.ownedBestTe })}
            </button>
          ) : null}
        </div>
      ) : null}

      {result.materials.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={fillingFromAssets}
            onClick={() => void fillFromAssets()}
            className="h-7 text-xs"
          >
            {fillingFromAssets ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : null}
            {t('industry.fillFromAssets')}
          </Button>
          <span className="text-[11px] text-zinc-500">{t('industry.assetsHint')}</span>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
              <th className="py-1.5 text-left font-semibold">{t('industry.material')}</th>
              <th className="py-1.5 text-right font-semibold">{t('industry.required')}</th>
              <th className="py-1.5 text-right font-semibold">{t('industry.owned')}</th>
              <th className="py-1.5 text-right font-semibold">{t('industry.toBuy')}</th>
              {multiHub ? <th className="py-1.5 text-right font-semibold">{t('industry.bestHub')}</th> : null}
              <th className="py-1.5 text-right font-semibold">{t('industry.cost')}</th>
            </tr>
          </thead>
          <tbody>
            {result.materials.map((m) => {
              const best = m.quotes.find((q) => q.hubId === m.cheapestHubId)
              const isOpen = expanded.has(m.typeId)
              return (
                <Fragment key={m.typeId}>
                  <tr className="border-b border-zinc-900">
                    <td className="py-1.5 pr-2 text-zinc-200">
                      {m.manufacturable ? (
                        <button
                          type="button"
                          onClick={() => toggleExpand(m.typeId)}
                          title={t('industry.tree.expand')}
                          className="flex items-center gap-1 text-left hover:text-violet-200"
                        >
                          <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform', isOpen && 'rotate-90')} />
                          {m.cheapestHubId === null && m.toBuy > 0 ? <AlertTriangle className="h-3 w-3 shrink-0 text-amber-400" /> : null}
                          {m.name}
                        </button>
                      ) : (
                        <span className="flex items-center gap-1.5 pl-[18px]">
                          {m.cheapestHubId === null && m.toBuy > 0 ? <AlertTriangle className="h-3 w-3 shrink-0 text-amber-400" /> : null}
                          {m.name}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-zinc-300">{formatNumber(m.requiredQuantity)}</td>
                    <td className="py-1.5 text-right">
                      <input
                        type="number"
                        min={0}
                        value={owned[m.typeId] ?? 0}
                        onChange={(e) => setOwned({ ...owned, [m.typeId]: Math.max(0, Number(e.target.value) || 0) })}
                        className="h-7 w-24 rounded border border-zinc-800 bg-zinc-950 px-2 text-right text-xs tabular-nums text-zinc-200 outline-none focus:border-violet-500/40"
                      />
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-zinc-300">{formatNumber(m.toBuy)}</td>
                    {multiHub ? (
                      <td className="py-1.5 text-right text-[11px] text-violet-300">
                        {m.cheapestHubId === null ? t('industry.noOrders') : best?.hubName}
                      </td>
                    ) : null}
                    <td className="py-1.5 text-right tabular-nums text-zinc-200">
                      {m.cheapestHubId === null && m.toBuy > 0 ? t('industry.noOrders') : formatISK(m.buyCost)}
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr>
                      <td colSpan={fullColSpan} className="bg-zinc-950/40 px-2 pb-2">
                        <RecipeNode typeId={m.typeId} name={m.name} quantity={m.requiredQuantity} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-3 text-left font-semibold text-zinc-300" colSpan={multiHub ? 5 : 4}>
                {multiHub ? t('industry.optimizedCost') : t('industry.totalMaterialCost')}
              </td>
              <td className="pt-3 text-right font-semibold tabular-nums text-zinc-100">{formatISK(result.totalMaterialCost)}</td>
            </tr>
            {result.jobCost ? (
              <Fragment>
                <tr>
                  <td className="pt-1 text-left text-xs text-zinc-400" colSpan={multiHub ? 5 : 4}>
                    {t('industry.jobCost')}
                    <span
                      className={cn(
                        'ml-1.5 text-[10px]',
                        result.jobCostSource === 'local_approx' ? 'text-amber-400' : 'text-zinc-500'
                      )}
                    >
                      {result.jobCostSource === 'everef'
                        ? t('industry.jobCostSourceEveref')
                        : t('industry.jobCostSourceLocal')}
                    </span>
                  </td>
                  <td className="pt-1 text-right text-xs tabular-nums text-zinc-300">{formatISK(result.jobCost.total)}</td>
                </tr>
                <tr>
                  <td className="pt-1 text-left text-xs font-semibold text-zinc-200" colSpan={multiHub ? 5 : 4}>
                    {t('industry.totalCost')}
                  </td>
                  <td className="pt-1 text-right text-xs font-semibold tabular-nums text-zinc-100">
                    {formatISK(result.totalMaterialCost + result.jobCost.total)}
                  </td>
                </tr>
              </Fragment>
            ) : result.jobCostUnavailable ? (
              <tr>
                <td colSpan={fullColSpan} className="pt-1 text-left text-[10px] text-amber-400">
                  {t('industry.jobCostUnavailable')}
                </td>
              </tr>
            ) : null}
          </tfoot>
        </table>
      </div>

      {multiHub ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">{t('industry.hubComparison')}</p>
          <div className="space-y-1">
            {result.hubTotals.map((h) => (
              <div key={h.hubId} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-zinc-400">
                  {h.hubName}
                  {h.anyMissing ? <span className="ml-1 text-amber-500">{t('industry.someMissing')}</span> : null}
                </span>
                <span className={cn('tabular-nums', h.total === cheapestTotal ? 'font-semibold text-emerald-300' : 'text-zinc-300')}>
                  {formatISK(h.total)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-zinc-600">{t('industry.optimizedHint')}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            {result.netRevenueListed != null ? t('industry.netRevenueListed') : t('industry.revenueListed')}
          </p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-zinc-100">
            {formatISK(result.netRevenueListed ?? result.revenueListed)}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-600">
            {t('industry.revenueImmediate')}: {formatISK(result.revenueImmediate)}
            {result.netRevenueListed != null
              ? ` · ${t('industry.netRevenueHint', { pct: (result.revenueTaxPct ?? 0).toFixed(1) })}`
              : ''}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            {result.netRevenueListed != null ? t('industry.netProfit') : t('industry.profit')}
          </p>
          <p className={cn('mt-1 text-sm font-bold tabular-nums', netProfitPositive ? 'text-emerald-300' : 'text-red-300')}>
            {formatISK(result.netRevenueListed != null ? result.netProfit : result.profit)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            {result.netRevenueListed != null ? t('industry.netMargin') : t('industry.margin')}
          </p>
          <p className={cn('mt-1 text-sm font-bold tabular-nums', netProfitPositive ? 'text-emerald-300' : 'text-red-300')}>
            {((result.netRevenueListed != null ? result.netMargin : result.margin) * 100).toFixed(1)}%
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
            {t('industry.iskPerHour')}
            {result.buildTimeSource === 'everef' ? (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-px text-[9px] normal-case text-emerald-300">
                {t('industry.timeSourceEveref')}
              </span>
            ) : result.buildTimeSource === 'local_approx' ? (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-px text-[9px] normal-case text-amber-300">
                {t('industry.timeSourceLocal')}
              </span>
            ) : null}
          </p>
          {result.iskPerHour != null ? (
            <p
              className={cn(
                'mt-1 text-sm font-bold tabular-nums',
                result.iskPerHour >= 0 ? 'text-emerald-300' : 'text-red-300'
              )}
            >
              {formatISK(result.iskPerHour)}/h
            </p>
          ) : (
            <p className="mt-1 text-sm font-semibold text-zinc-600">—</p>
          )}
          {result.buildTimeSeconds != null ? (
            <p className="mt-0.5 text-[10px] text-zinc-600">
              {t('industry.buildTime')}: {formatDuration(result.buildTimeSeconds)}
            </p>
          ) : (
            <p className="mt-0.5 text-[10px] text-zinc-600">{t('industry.buildTimeUnknown')}</p>
          )}
          {result.skillMeta ? (
            <p className="mt-0.5 text-[10px] text-zinc-600">
              {result.skillMeta.applied
                ? t('industry.skillsFrom', { character: result.skillMeta.characterName })
                : t('industry.skillsNotApplied')}{' '}
              · <TimeAgo date={result.skillMeta.capturedAt} className="text-zinc-600" />
            </p>
          ) : (
            <p className="mt-0.5 text-[10px] text-zinc-600">{t('industry.skillsNone')}</p>
          )}
        </div>
      </div>

      <p className="text-[10px] text-zinc-600">{t('industry.exclusionsHint')}</p>
      {!result.jobCost && !result.jobCostUnavailable ? (
        <p className="text-[10px] text-zinc-600">{t('industry.jobCostExcludedHint')}</p>
      ) : null}
    </div>
  )
}
