'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  Clock,
  Copy,
  MapPin,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn, formatCompactNumber, formatISK, formatNumber } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { Switch } from '@/components/ui/switch'
import type { AppraisalLineItem, AppraisalRawEntry } from '@/lib/appraisal/types'

export interface AppraisalView {
  marketLabel: string
  items: AppraisalLineItem[]
  /** Pre-merge pasted lines, for the "stack" (separate lines) toggle. Empty/omitted
   * for appraisals saved before this existed — the toggle hides itself in that case. */
  rawEntries?: AppraisalRawEntry[]
  unresolvedNames: string[]
  totalBuy: number
  totalSell: number
  totalSplit: number
  createdAt?: string | Date
  itemsLocation?: string | null
  /** Creator's saved contract-price knob (% of priced value). Seeds the live control. */
  priceModifierPct?: number
  /** Free-text seller note, shown in the collapsed advanced card. */
  comments?: string | null
}

type PriceMode = 'total' | 'unit'

/** A display row: either an aggregated item (stack ON) or one pre-merge pasted
 * line re-priced from its type's aggregate unit prices (stack OFF). */
interface DisplayRow {
  key: string
  typeId: number
  name: string
  quantity: number
  volume: number | null
  groupName: string | null
  buyUnit: number
  sellUnit: number
  splitUnit: number
  buyTotal: number
  sellTotal: number
  splitTotal: number
  buyFilledQty: number
  sellFilledQty: number
  buySufficient: boolean
  sellSufficient: boolean
  stale: boolean
  noOrders: boolean
}

/** Copy an ISK value in the plain-integer form EVE's contract price field accepts
 * (no separators, no "ISK"). Rounds to whole ISK. */
function useCopyContractValue() {
  const { t } = useTranslations()
  return async (value: number) => {
    const rounded = Math.max(0, Math.round(value))
    try {
      await navigator.clipboard.writeText(String(rounded))
      toast.success(t('appraisal.copiedValue', { value: formatISK(rounded) }))
    } catch {
      toast.error(t('appraisal.copyFailed'))
    }
  }
}

/** A number the user can click to copy (contract format). */
function CopyValue({
  value,
  onCopy,
  className,
  children,
}: {
  value: number
  onCopy: (v: number) => void
  className?: string
  children: React.ReactNode
}) {
  const { t } = useTranslations()
  return (
    <button
      type="button"
      onClick={() => onCopy(value)}
      title={t('appraisal.clickToCopy')}
      className={cn(
        'group/copy inline-flex items-center gap-1 rounded px-1 -mx-1 text-right transition-colors hover:bg-eve-accent/10',
        className
      )}
    >
      {children}
      <Copy className="h-2.5 w-2.5 shrink-0 text-zinc-600 opacity-0 transition-opacity group-hover/copy:opacity-100" />
    </button>
  )
}

/** One stat tile in the header (Buy / Sell / Split / Volume). */
function StatTile({
  label,
  value,
  onCopy,
  emphasis,
  hint,
}: {
  label: string
  value: string
  onCopy?: () => void
  emphasis?: boolean
  hint?: string
}) {
  const content = (
    <span
      className={cn(
        'tabular-nums',
        emphasis ? 'text-lg font-bold text-violet-200' : 'text-lg font-semibold text-zinc-100'
      )}
    >
      {value}
    </span>
  )
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2" title={hint}>
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
        {hint ? <AlertTriangle className="h-2.5 w-2.5 text-amber-500" /> : null}
      </p>
      {onCopy ? (
        <button type="button" onClick={onCopy} className="group/copy flex items-center gap-1">
          {content}
          <Copy className="h-3 w-3 shrink-0 text-zinc-600 opacity-0 transition-opacity group-hover/copy:opacity-100" />
        </button>
      ) : (
        content
      )}
    </div>
  )
}

function PriceCell({
  total,
  unit,
  filledQty,
  quantity,
  sufficient,
  noOrders,
  mode,
  mult,
  onCopy,
  emphasis,
}: {
  total: number
  unit: number
  filledQty: number
  quantity: number
  sufficient: boolean
  noOrders: boolean
  mode: PriceMode
  mult: number
  onCopy: (v: number) => void
  emphasis?: boolean
}) {
  const { t } = useTranslations()
  if (noOrders) {
    return <span className="text-zinc-600">{t('appraisal.noOrders')}</span>
  }
  const shown = mode === 'unit' ? unit * mult : total * mult
  return (
    <div className="flex flex-col items-end leading-tight">
      <CopyValue value={shown} onCopy={onCopy}>
        <span className={cn('tabular-nums', emphasis ? 'font-medium text-zinc-100' : 'text-zinc-300')}>
          {formatISK(shown)}
        </span>
      </CopyValue>
      {!sufficient ? (
        <span className="flex items-center gap-0.5 text-[10px] text-amber-500" title={t('appraisal.thinBookHint')}>
          <AlertTriangle className="h-2.5 w-2.5" />
          {t('appraisal.partialFill', {
            filled: formatNumber(filledQty),
            total: formatNumber(quantity),
          })}
        </span>
      ) : null}
    </div>
  )
}

export function AppraisalResultTable({ view }: { view: AppraisalView }) {
  const { t } = useTranslations()
  const onCopy = useCopyContractValue()

  const savedPct = view.priceModifierPct ?? 100
  const [pct, setPct] = useState<number>(savedPct)
  const mult = (Number.isFinite(pct) ? pct : 100) / 100
  const modified = Math.abs(pct - 100) > 0.001

  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [priceMode, setPriceMode] = useState<PriceMode>('total')

  const hasRawEntries = (view.rawEntries?.length ?? 0) > 0
  const [stacked, setStacked] = useState(true)

  const rows: DisplayRow[] = useMemo(() => {
    if (stacked || !hasRawEntries) {
      return view.items.map((i) => ({ ...i, key: String(i.typeId) }))
    }
    const byType = new Map(view.items.map((i) => [i.typeId, i]))
    const out: DisplayRow[] = []
    view.rawEntries!.forEach((entry, index) => {
      const priced = byType.get(entry.typeId)
      if (!priced) return
      out.push({
        key: `${entry.typeId}-${index}`,
        typeId: entry.typeId,
        name: entry.name,
        quantity: entry.quantity,
        volume: priced.volume,
        groupName: priced.groupName,
        buyUnit: priced.buyUnit,
        sellUnit: priced.sellUnit,
        splitUnit: priced.splitUnit,
        buyTotal: priced.buyUnit * entry.quantity,
        sellTotal: priced.sellUnit * entry.quantity,
        splitTotal: priced.splitUnit * entry.quantity,
        // Book-depth signals are per TYPE (the aggregate quantity), reused as-is on
        // each split line — a thin book for the type is thin for every line of it.
        buyFilledQty: priced.buyFilledQty,
        sellFilledQty: priced.sellFilledQty,
        buySufficient: priced.buySufficient,
        sellSufficient: priced.sellSufficient,
        stale: priced.stale,
        noOrders: priced.noOrders,
      })
    })
    return out
  }, [stacked, hasRawEntries, view.items, view.rawEntries])

  const anyStale = rows.some((r) => r.stale)

  const itemsWithVolume = view.items.filter((i) => i.volume != null)
  const totalVolume = itemsWithVolume.reduce((sum, i) => sum + (i.volume ?? 0) * i.quantity, 0)
  const hasIncompleteVolume = view.items.length > 0 && itemsWithVolume.length < view.items.length

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-md border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">{t('appraisal.pricedAt')}</span>
            <span className="font-semibold text-violet-200">{view.marketLabel}</span>
          </div>
          {view.createdAt ? (
            <span className="flex items-center gap-1 text-xs text-zinc-500">
              <Clock className="h-3 w-3" />
              {new Date(view.createdAt).toLocaleString()}
            </span>
          ) : null}
        </div>

        {view.itemsLocation ? (
          <div className="flex items-center gap-1.5 text-sm text-zinc-300">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-violet-300" />
            <span className="text-zinc-500">{t('appraisal.location')}:</span>
            <span className="font-medium">{view.itemsLocation}</span>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile
            label={t('appraisal.buy')}
            value={formatISK(view.totalBuy * mult)}
            onCopy={() => onCopy(view.totalBuy * mult)}
          />
          <StatTile
            label={t('appraisal.sell')}
            value={formatISK(view.totalSell * mult)}
            onCopy={() => onCopy(view.totalSell * mult)}
          />
          <StatTile
            label={t('appraisal.split')}
            value={formatISK(view.totalSplit * mult)}
            onCopy={() => onCopy(view.totalSplit * mult)}
            emphasis
          />
          <StatTile
            label={t('appraisal.totalVolume')}
            value={`${formatCompactNumber(totalVolume)} m³`}
            hint={hasIncompleteVolume ? t('appraisal.volumeIncomplete') : undefined}
          />
        </div>
      </div>

      <div className="rounded-md border border-zinc-800 bg-zinc-900/20">
        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-200"
        >
          <span className="flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {t('appraisal.advanced')}
          </span>
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', advancedOpen ? 'rotate-180' : '')} />
        </button>

        {advancedOpen ? (
          <div className="space-y-4 border-t border-zinc-800 px-3 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <label htmlFor="price-modifier" className="text-xs font-medium text-zinc-400">
                {t('appraisal.priceModifier')}
              </label>
              <div className="flex items-center gap-1">
                <input
                  id="price-modifier"
                  type="range"
                  min={1}
                  max={200}
                  step={1}
                  value={Math.min(pct, 200)}
                  onChange={(e) => setPct(Number(e.target.value))}
                  className="h-1 w-32 cursor-pointer accent-violet-500"
                />
                <div className="flex items-center rounded border border-zinc-800 bg-zinc-950">
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={pct}
                    onChange={(e) => setPct(Number(e.target.value))}
                    className="h-7 w-16 bg-transparent px-2 text-right text-sm tabular-nums text-zinc-200 outline-none"
                  />
                  <span className="pr-2 text-sm text-zinc-500">%</span>
                </div>
              </div>
              {modified ? (
                <button
                  type="button"
                  onClick={() => setPct(100)}
                  className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
                >
                  <RotateCcw className="h-3 w-3" />
                  {t('appraisal.resetModifier')}
                </button>
              ) : null}
              <span className="ml-auto text-[11px] text-zinc-600">{t('appraisal.copyHint')}</span>
            </div>

            {hasRawEntries ? (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-zinc-400">{t('appraisal.stackToggle')}</p>
                  <p className="text-[11px] text-zinc-600">{t('appraisal.stackToggleHint')}</p>
                </div>
                <Switch checked={stacked} onCheckedChange={setStacked} />
              </div>
            ) : null}

            {view.comments ? (
              <div>
                <p className="mb-1 text-xs font-medium text-zinc-400">{t('appraisal.comments')}</p>
                <p className="whitespace-pre-wrap text-sm text-zinc-300">{view.comments}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {anyStale ? (
        <p className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {t('appraisal.staleWarning')}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <span className="text-[11px] text-zinc-600">{t('appraisal.displayMode')}</span>
        <div className="flex overflow-hidden rounded-md border border-zinc-800">
          <button
            type="button"
            onClick={() => setPriceMode('total')}
            className={cn(
              'px-2 py-1 text-[11px] transition-colors',
              priceMode === 'total' ? 'bg-violet-500/20 text-violet-100' : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200'
            )}
          >
            {t('appraisal.stackTotal')}
          </button>
          <button
            type="button"
            onClick={() => setPriceMode('unit')}
            className={cn(
              'px-2 py-1 text-[11px] transition-colors',
              priceMode === 'unit' ? 'bg-violet-500/20 text-violet-100' : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200'
            )}
          >
            {t('appraisal.unitPrice')}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
              <th className="py-1.5 text-left font-semibold">{t('appraisal.item')}</th>
              <th className="py-1.5 text-right font-semibold">{t('appraisal.quantity')}</th>
              <th className="py-1.5 text-right font-semibold">{t('appraisal.buy')}</th>
              <th className="py-1.5 text-right font-semibold">{t('appraisal.sell')}</th>
              <th className="py-1.5 text-right font-semibold">{t('appraisal.split')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-zinc-900">
                <td className="py-1.5 pr-2 text-zinc-200">
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://images.evetech.net/types/${r.typeId}/icon?size=32`}
                      alt=""
                      width={24}
                      height={24}
                      className="h-6 w-6 shrink-0 rounded-sm"
                    />
                    <div className="min-w-0">
                      <span className="flex items-center gap-1.5 truncate">
                        {r.stale ? (
                          <AlertTriangle
                            className="h-3 w-3 shrink-0 text-amber-400"
                            aria-label={t('appraisal.stale')}
                          />
                        ) : null}
                        {r.name}
                      </span>
                      {r.groupName ? (
                        <span className="block truncate text-[10px] text-zinc-500">{r.groupName}</span>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="py-1.5 text-right tabular-nums text-zinc-400">{formatNumber(r.quantity)}</td>
                <td className="py-1.5 pl-3">
                  <PriceCell
                    total={r.buyTotal}
                    unit={r.buyUnit}
                    filledQty={r.buyFilledQty}
                    quantity={r.quantity}
                    sufficient={r.buySufficient}
                    noOrders={r.noOrders}
                    mode={priceMode}
                    mult={mult}
                    onCopy={onCopy}
                  />
                </td>
                <td className="py-1.5 pl-3">
                  <PriceCell
                    total={r.sellTotal}
                    unit={r.sellUnit}
                    filledQty={r.sellFilledQty}
                    quantity={r.quantity}
                    sufficient={r.sellSufficient}
                    noOrders={r.noOrders}
                    mode={priceMode}
                    mult={mult}
                    onCopy={onCopy}
                  />
                </td>
                <td className="py-1.5 pl-3">
                  <PriceCell
                    total={r.splitTotal}
                    unit={r.splitUnit}
                    filledQty={Math.min(r.buyFilledQty, r.sellFilledQty)}
                    quantity={r.quantity}
                    sufficient={r.buySufficient && r.sellSufficient}
                    noOrders={r.noOrders}
                    mode={priceMode}
                    mult={mult}
                    onCopy={onCopy}
                    emphasis
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {view.unresolvedNames.length > 0 ? (
        <div className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2">
          <p className="text-xs font-medium text-zinc-400">
            {t('appraisal.unresolvedTitle', { count: view.unresolvedNames.length })}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">{view.unresolvedNames.join(', ')}</p>
        </div>
      ) : null}
    </div>
  )
}
