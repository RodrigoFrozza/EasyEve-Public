'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Search, Trash2, X } from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PI_COMMODITY_NAMES } from '@/lib/pi/pi-static-data'
import type { PiPreferences, PiSellSource } from '@/lib/hooks/use-pi-config'
import { PiPricingModeHelp } from './PiRateModeHelp'

function SectionHeading({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-wider text-violet-300">{title}</h3>
  )
}

type StructureResult = { structureId: string; name: string }
type RefPrice = {
  typeId: number
  name: string
  price: number
  source: string | null
  confidence: string | null
  updatedAt: string
}

const SELL_SOURCES: PiSellSource[] = [
  'home_region',
  'jita_sell',
  'jita_buy',
  'jita_split',
  'structure',
]

function StructurePicker({
  label,
  currentId,
  currentName,
  onPick,
  onClear,
}: {
  label: string
  currentId: string | null | undefined
  currentName: string | null | undefined
  onPick: (s: StructureResult) => void
  onClear: () => void
}) {
  const { t } = useTranslations()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StructureResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) {
      setResults([])
      return
    }
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      fetch(`/api/pi/structures?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { structures: [] }))
        .then((d) => {
          if (!cancelled) setResults(Array.isArray(d.structures) ? d.structures : [])
        })
        .catch(() => undefined)
        .finally(() => !cancelled && setLoading(false))
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-zinc-300">{label}</label>
      {currentId ? (
        <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
          <span className="truncate text-zinc-200">{currentName ?? currentId}</span>
          <button type="button" onClick={onClear} aria-label="clear" className="text-zinc-500 hover:text-zinc-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('pi.sources.structureSearch')}
            className="border-zinc-800 bg-zinc-950 pl-8 text-sm"
          />
          {loading ? (
            <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-zinc-500" />
          ) : null}
        </div>
      )}
      {!currentId && results.length > 0 ? (
        <div className="max-h-40 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-900">
          {results.map((s) => (
            <button
              key={s.structureId}
              type="button"
              onClick={() => {
                onPick(s)
                setQuery('')
                setResults([])
              }}
              className="block w-full truncate px-3 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-800"
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ReferencePricesEditor() {
  const { t } = useTranslations()
  const [prices, setPrices] = useState<RefPrice[]>([])
  const [loading, setLoading] = useState(true)
  const [typeId, setTypeId] = useState('')
  const [price, setPrice] = useState('')
  const [source, setSource] = useState('')

  const commodityOptions = useMemo(
    () =>
      Object.entries(PI_COMMODITY_NAMES)
        .map(([id, name]) => ({ id: Number(id), name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    []
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/pi/reference-prices')
      const data = res.ok ? await res.json() : { prices: [] }
      setPrices(Array.isArray(data.prices) ? data.prices : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async (tid: number, p: number, src?: string | null) => {
    await fetch('/api/pi/reference-prices', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ typeId: tid, price: p, source: src ?? null }),
    })
    await load()
  }

  const remove = async (tid: number) => {
    await fetch(`/api/pi/reference-prices?typeId=${tid}`, { method: 'DELETE' })
    await load()
  }

  const add = async () => {
    const tid = Number(typeId)
    const p = Number(price)
    if (!Number.isInteger(tid) || tid <= 0 || !Number.isFinite(p) || p < 0) return
    await save(tid, p, source.trim() || null)
    setTypeId('')
    setPrice('')
    setSource('')
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-eve-text">{t('pi.sources.referenceTitle')}</h3>
        <p className="text-xs text-zinc-500">{t('pi.sources.referenceHint')}</p>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
        <div className="min-w-[180px] flex-1">
          <label className="text-[10px] uppercase text-zinc-500">{t('pi.shopping.item')}</label>
          <Select value={typeId} onValueChange={setTypeId}>
            <SelectTrigger className="h-8 border-zinc-800 bg-zinc-950 text-xs">
              <SelectValue placeholder={t('pi.sources.pickItem')} />
            </SelectTrigger>
            <SelectContent className="max-h-[300px] border-zinc-800 bg-zinc-900">
              {commodityOptions.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] uppercase text-zinc-500">{t('pi.sources.price')}</label>
          <Input
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="h-8 w-28 border-zinc-800 bg-zinc-950 text-xs"
          />
        </div>
        <div className="min-w-[140px] flex-1">
          <label className="text-[10px] uppercase text-zinc-500">{t('pi.sources.source')}</label>
          <Input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder={t('pi.sources.sourcePlaceholder')}
            className="h-8 border-zinc-800 bg-zinc-950 text-xs"
          />
        </div>
        <Button size="sm" onClick={add} disabled={!typeId || !price}>
          {t('pi.sources.add')}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
        </div>
      ) : prices.length === 0 ? (
        <p className="py-3 text-center text-xs text-zinc-500">{t('pi.sources.noReference')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
                <th className="py-1.5 text-left">{t('pi.shopping.item')}</th>
                <th className="py-1.5 text-right">{t('pi.sources.price')}</th>
                <th className="py-1.5 text-left">{t('pi.sources.source')}</th>
                <th className="py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {prices.map((p) => (
                <tr key={p.typeId} className="border-b border-zinc-900">
                  <td className="py-1.5 text-zinc-200">{p.name}</td>
                  <td className="py-1.5 text-right">
                    <Input
                      type="number"
                      min={0}
                      defaultValue={p.price}
                      key={p.price}
                      onBlur={(e) => {
                        const np = Number(e.target.value)
                        if (Number.isFinite(np) && np >= 0 && np !== p.price) {
                          void save(p.typeId, np, p.source)
                        }
                      }}
                      className="h-7 w-28 border-zinc-800 bg-zinc-950 text-right text-xs tabular-nums"
                    />
                  </td>
                  <td className="py-1.5 text-xs text-zinc-500">{p.source ?? '—'}</td>
                  <td className="py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => void remove(p.typeId)}
                      aria-label="delete"
                      className="text-zinc-600 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function PiAdvancedSettingsModal({
  open,
  onOpenChange,
  preferences,
  onSavePreferences,
  regions,
  showSuggestions,
  showWarnings,
  onShowSuggestionsChange,
  onShowWarningsChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  preferences: PiPreferences
  onSavePreferences: (patch: Partial<PiPreferences>) => Promise<void>
  regions: Array<{ id: number; name: string }>
  showSuggestions: boolean
  showWarnings: boolean
  onShowSuggestionsChange: (v: boolean) => void
  onShowWarningsChange: (v: boolean) => void
}) {
  const { t } = useTranslations()
  const sellSource = preferences.sellSource ?? 'home_region'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto border-zinc-800 bg-zinc-950">
        <DialogHeader>
          <DialogTitle>{t('pi.config.settingsTitle')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Price */}
          <div className="space-y-4">
            <SectionHeading title={t('pi.config.priceSection')} />

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-zinc-300">
                  {t('pi.config.pricingMode')}
                </label>
                <PiPricingModeHelp />
              </div>
              <Select
                value={preferences.pricingMode}
                onValueChange={(v) =>
                  void onSavePreferences({ pricingMode: v as typeof preferences.pricingMode })
                }
              >
                <SelectTrigger className="border-zinc-800 bg-zinc-950 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-zinc-800 bg-zinc-900">
                  <SelectItem value="import_buy_export_sell">
                    {t('pi.config.pricingImportBuyExportSell')}
                  </SelectItem>
                  <SelectItem value="mid_price">{t('pi.config.pricingMid')}</SelectItem>
                  <SelectItem value="pessimistic">{t('pi.config.pricingPessimistic')}</SelectItem>
                  <SelectItem value="realistic">{t('pi.config.pricingRealistic')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-0.5">
              <label className="text-xs text-zinc-500" htmlFor="pi-home-region">
                {t('pi.config.homeRegion')}
              </label>
              <Select
                value={preferences.homeRegionId != null ? String(preferences.homeRegionId) : 'jita'}
                onValueChange={(v) => {
                  const next = v === 'jita' ? null : Number.parseInt(v, 10)
                  if (next !== (preferences.homeRegionId ?? null)) {
                    void onSavePreferences({ homeRegionId: next })
                  }
                }}
              >
                <SelectTrigger
                  id="pi-home-region"
                  className="h-8 w-full border-zinc-800 bg-zinc-950 text-xs"
                >
                  <SelectValue placeholder="Jita (default)" />
                </SelectTrigger>
                <SelectContent className="max-h-[320px] border-zinc-800 bg-zinc-900">
                  <SelectItem value="jita">Jita (default)</SelectItem>
                  {regions.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-zinc-600">{t('pi.config.homeRegionHint')}</p>
            </div>

            {/* Sell source — where the produced output is valued for sale */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">{t('pi.sources.sellSource')}</label>
              <Select
                value={sellSource}
                onValueChange={(v) => void onSavePreferences({ sellSource: v as PiSellSource })}
              >
                <SelectTrigger className="border-zinc-800 bg-zinc-950 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-zinc-800 bg-zinc-900">
                  {SELL_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`pi.sources.sell.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-zinc-600">{t('pi.sources.sellSourceHint')}</p>
            </div>

            {sellSource === 'structure' ? (
              <StructurePicker
                label={t('pi.sources.sellStructure')}
                currentId={preferences.sellStructureId}
                currentName={preferences.sellStructureName}
                onPick={(s) =>
                  void onSavePreferences({ sellStructureId: s.structureId, sellStructureName: s.name })
                }
                onClear={() =>
                  void onSavePreferences({ sellStructureId: null, sellStructureName: null })
                }
              />
            ) : null}
          </div>

          {/* Sources */}
          <div className="border-t border-zinc-800 pt-5 space-y-4">
            <SectionHeading title={t('pi.sources.title')} />

            {/* Buy inputs */}
            <StructurePicker
              label={t('pi.sources.buyStructure')}
              currentId={preferences.buyStructureId}
              currentName={preferences.buyStructureName}
              onPick={(s) =>
                void onSavePreferences({ buyStructureId: s.structureId, buyStructureName: s.name })
              }
              onClear={() => void onSavePreferences({ buyStructureId: null, buyStructureName: null })}
            />
            <p className="-mt-2 text-[10px] text-zinc-600">{t('pi.sources.buyStructureHint')}</p>

            {/* Secondary buy structure (comparison only, Shopping List) */}
            <StructurePicker
              label={t('pi.sources.buyStructure2')}
              currentId={preferences.buyStructureId2}
              currentName={preferences.buyStructureName2}
              onPick={(s) =>
                void onSavePreferences({ buyStructureId2: s.structureId, buyStructureName2: s.name })
              }
              onClear={() =>
                void onSavePreferences({ buyStructureId2: null, buyStructureName2: null })
              }
            />
            <p className="-mt-2 text-[10px] text-zinc-600">{t('pi.sources.buyStructure2Hint')}</p>

            <div className="pt-1">
              <ReferencePricesEditor />
            </div>
          </div>

          {/* Taxes & operation */}
          <div className="border-t border-zinc-800 pt-5 space-y-4">
            <SectionHeading title={t('pi.config.taxesOpsSection')} />
            <div className="flex flex-wrap gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-zinc-500" htmlFor="pi-export-tax">
                    {t('pi.config.exportTaxRate')}
                  </label>
                  <Input
                    id="pi-export-tax"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    defaultValue={Math.round(preferences.exportTaxRate * 100)}
                    key={preferences.exportTaxRate}
                    onBlur={(e) => {
                      const pct = Number(e.target.value)
                      if (!Number.isFinite(pct)) return
                      const rate = Math.min(100, Math.max(0, pct)) / 100
                      if (Math.abs(rate - preferences.exportTaxRate) > 0.0001) {
                        void onSavePreferences({ exportTaxRate: rate })
                      }
                    }}
                    className="h-8 w-16 border-zinc-800 bg-zinc-950 text-xs"
                  />
                  <span className="text-xs text-zinc-500">%</span>
                </div>
                <p className="text-[10px] text-zinc-600">{t('pi.config.exportTaxHint')}</p>
              </div>

              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-zinc-500" htmlFor="pi-import-tax">
                    {t('pi.config.importTaxRate')}
                  </label>
                  <Input
                    id="pi-import-tax"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    defaultValue={Math.round(
                      (preferences.importTaxRate ?? preferences.exportTaxRate) * 100
                    )}
                    key={`${preferences.importTaxRate}-${preferences.exportTaxRate}`}
                    onBlur={(e) => {
                      const pct = Number(e.target.value)
                      if (!Number.isFinite(pct)) return
                      const rate = Math.min(100, Math.max(0, pct)) / 100
                      const current = preferences.importTaxRate ?? preferences.exportTaxRate
                      if (Math.abs(rate - current) > 0.0001) {
                        void onSavePreferences({ importTaxRate: rate })
                      }
                    }}
                    className="h-8 w-16 border-zinc-800 bg-zinc-950 text-xs"
                  />
                  <span className="text-xs text-zinc-500">%</span>
                </div>
                <p className="text-[10px] text-zinc-600">{t('pi.config.importTaxHint')}</p>
              </div>

              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-zinc-500" htmlFor="pi-visit-cadence">
                    {t('pi.config.visitCadence')}
                  </label>
                  <Input
                    id="pi-visit-cadence"
                    type="number"
                    min={1}
                    max={720}
                    step={1}
                    defaultValue={preferences.visitCadenceHrs ?? 24}
                    key={preferences.visitCadenceHrs ?? 24}
                    onBlur={(e) => {
                      const raw = e.target.value.trim()
                      // Empty clears back to the 24h default (null).
                      const next =
                        raw === '' ? null : Math.round(Math.min(720, Math.max(1, Number(raw))))
                      if (raw !== '' && !Number.isFinite(Number(raw))) return
                      const current = preferences.visitCadenceHrs ?? null
                      if (next !== current) {
                        void onSavePreferences({ visitCadenceHrs: next })
                      }
                    }}
                    className="h-8 w-16 border-zinc-800 bg-zinc-950 text-xs"
                  />
                  <span className="text-xs text-zinc-500">h</span>
                </div>
                <p className="text-[10px] text-zinc-600">{t('pi.config.visitCadenceHint')}</p>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-5 space-y-3">
            <SectionHeading title={t('pi.config.displaySection')} />
            <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
              <Switch checked={showSuggestions} onCheckedChange={onShowSuggestionsChange} />
              {t('pi.config.showSuggestions')}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
              <Switch checked={showWarnings} onCheckedChange={onShowWarningsChange} />
              {t('pi.config.showWarnings')}
            </label>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
