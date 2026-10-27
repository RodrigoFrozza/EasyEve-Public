'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatISK, cn } from '@/lib/utils'
import { parseMiningScanBlock } from '@/lib/mining-scan-parse'
import type { MiningValuableOreRow, MiningPriceData } from '@/components/activity/MiningValuableOres'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useTranslations } from '@/i18n/hooks'
import { ClipboardCopy, Info, ScanSearch } from 'lucide-react'
import { MiningThemedDialog, miningModalTheme } from './mining/MiningThemedDialog'

interface MiningWismModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  miningCategory: string
  space?: string
}

type ResolvedRow = {
  scannedName: string
  quantity: number
  typeId: number
  resolvedName: string
  bestPrice: number
  bestAction: 'RAW' | 'COMP' | 'REF'
  unitVolume: number
  totalValue: number
  totalVolume: number
  iskPerM3: number
  priceBasis: MiningPriceData['basis']
}

function ActionBadge({ action }: { action: 'RAW' | 'COMP' | 'REF' }) {
  const styles = {
    RAW: 'border-cyan-300/30 bg-cyan-400/10 text-cyan-100',
    COMP: 'border-sky-400/35 bg-sky-500/15 text-sky-200',
    REF: 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200',
  }
  const labels = { RAW: 'Raw', COMP: 'Compress', REF: 'Refine' }
  return (
    <span
      className={cn(
        'shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
        styles[action]
      )}
    >
      {labels[action]}
    </span>
  )
}

export function MiningWismModal({ open, onOpenChange, miningCategory, space }: MiningWismModalProps) {
  const { t } = useTranslations()
  const theme = miningModalTheme
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<ResolvedRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const canRun = useMemo(() => text.trim().length > 0 && !busy, [text, busy])

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      const parsed = parseMiningScanBlock(text)
      if (parsed.length === 0) {
        setRows([])
        setError(t('activity.mining.modals.wism.noLinesParsed'))
        setBusy(false)
        return
      }

      const uniqueNames = [...new Set(parsed.map((p) => p.name))].slice(0, 80)
      const resolveRes = await fetch('/api/sde/resolve-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: uniqueNames }),
      })
      if (!resolveRes.ok) throw new Error(t('activity.mining.modals.wism.resolveFailed'))
      const nameMapping = (await resolveRes.json()) as Record<string, { id: number; name: string }>
      const nameMap = new Map<string, { id: number; name: string }>()
      for (const [key, value] of Object.entries(nameMapping)) {
        nameMap.set(key.toLowerCase(), value)
        nameMap.set(value.name.toLowerCase(), value)
      }

      const q = new URLSearchParams({ type: miningCategory })
      if (space) q.set('space', space)
      const marketRes = await fetch(`/api/sde/mining-types?${q.toString()}`)
      if (!marketRes.ok) throw new Error(t('activity.mining.modals.wism.marketFailed'))
      const marketData = (await marketRes.json()) as (MiningValuableOreRow & { unitRatio: number })[]
      const marketMap = new Map(marketData.map((m) => [m.id, m]))

      const built: ResolvedRow[] = []
      for (const p of parsed) {
        const hit = nameMap.get(p.name.toLowerCase()) || nameMapping[p.name]
        if (!hit) continue

        const m = marketMap.get(hit.id)
        if (!m) continue

        const pRaw = m.raw.price
        const pComp = m.compressed.price
        const pRef = m.refined.price

        let bestPrice = pRaw
        let bestAction: 'RAW' | 'COMP' | 'REF' = 'RAW'
        let basis = m.raw.basis

        if (pComp > bestPrice) {
          bestPrice = pComp
          bestAction = 'COMP'
          basis = m.compressed.basis
        }
        if (pRef > bestPrice) {
          bestPrice = pRef
          bestAction = 'REF'
          basis = m.refined.basis
        }

        const unitVolume = m.volume || 0
        const totalValue = bestPrice * p.quantity
        const totalVolume = unitVolume * p.quantity
        const iskPerM3 = unitVolume > 0 ? bestPrice / unitVolume : 0

        built.push({
          scannedName: p.name,
          quantity: p.quantity,
          typeId: hit.id,
          resolvedName: m.name,
          bestPrice,
          bestAction,
          unitVolume,
          totalValue,
          totalVolume,
          iskPerM3,
          priceBasis: basis,
        })
      }

      built.sort((a, b) => b.iskPerM3 - a.iskPerM3)
      setRows(built)

      if (built.length === 0) {
        setError(t('activity.mining.modals.wism.noMatches'))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('activity.mining.modals.wism.analysisFailed'))
      setRows([])
    } finally {
      setBusy(false)
    }
  }

  const textareaClass = cn(
    'min-h-[140px] resize-y rounded-lg border bg-black/30 text-xs leading-relaxed backdrop-blur-sm sm:text-sm',
    'border-cyan-300/25 text-cyan-50 placeholder:text-cyan-200/35',
    'focus-visible:border-cyan-200/50 focus-visible:ring-1 focus-visible:ring-cyan-300/30'
  )

  return (
    <MiningThemedDialog
      open={open}
      onOpenChange={onOpenChange}
      badge={t('activity.mining.modals.wism.badge')}
      title={t('activity.mining.modals.wism.title')}
      description={t('activity.mining.modals.wism.description')}
      maxWidth="4xl"
      scrollable
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className={cn(
              'h-10 rounded-lg font-mono text-[10px] font-bold uppercase tracking-wide text-cyan-200/70 hover:text-cyan-50',
              'hover:bg-cyan-400/10'
            )}
          >
            {t('activity.mining.modals.common.close')}
          </Button>
          <Button
            type="button"
            disabled={!canRun}
            onClick={() => void run()}
            className={cn(
              'h-10 rounded-lg border px-6 font-mono text-[10px] font-bold uppercase tracking-wide',
              'border-cyan-200/50 bg-cyan-300/25 text-cyan-50 hover:bg-cyan-300/35',
              'disabled:opacity-40'
            )}
          >
            <ScanSearch className="mr-2 h-4 w-4" />
            {busy ? t('activity.mining.modals.wism.running') : t('activity.mining.modals.wism.run')}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div
          className={cn(
            'flex gap-3 rounded-lg border px-3 py-3',
            'border-cyan-300/20 bg-cyan-400/[0.06]'
          )}
        >
          <Info className={cn('mt-0.5 h-4 w-4 shrink-0', theme.text)} />
          <p className="text-xs leading-relaxed text-cyan-100/80">
            {t('activity.mining.modals.wism.pasteHint')}
          </p>
        </div>

        <div className="space-y-2">
          <label className={cn('text-[10px] font-bold uppercase tracking-wide', theme.textMuted)}>
            {t('activity.mining.modals.wism.scanLabel')}
          </label>
          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setError(null)
            }}
            placeholder={t('activity.mining.modals.wism.placeholder')}
            className={textareaClass}
          />
          <p className="flex items-center gap-1.5 text-[10px] text-cyan-300/65">
            <ClipboardCopy className="h-3 w-3 shrink-0" />
            {t('activity.mining.modals.wism.scanSubhint')}
          </p>
        </div>

        {error ? (
          <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {error}
          </p>
        ) : null}

        {rows.length > 0 ? (
          <div className={cn('relative overflow-hidden rounded-xl border', theme.panel)}>
            <div aria-hidden className={cn('pointer-events-none absolute inset-0 opacity-60', theme.panelWash)} />
            <div className="relative p-1 sm:p-2">
              <div className={cn('mb-3 px-3 pt-2', theme.panelDivider)}>
                <span className={cn('text-[10px] font-bold uppercase tracking-wide', theme.text)}>
                  {t('activity.mining.modals.wism.results')}
                </span>
              </div>
              <div className="max-h-[min(340px,50vh)] overflow-auto custom-scrollbar rounded-lg border border-cyan-300/20">
                <TooltipProvider delayDuration={200}>
                  <table className="w-full min-w-[520px] text-xs">
                    <thead className="sticky top-0 z-10 border-b border-cyan-300/25 bg-cyan-950/80 backdrop-blur-md">
                      <tr className={cn('text-[10px] uppercase tracking-wide', theme.textMuted)}>
                        <th className="px-4 py-3 text-left font-bold">
                          {t('activity.mining.modals.wism.colItem')}
                        </th>
                        <th className="px-4 py-3 text-right font-bold">
                          {t('activity.mining.modals.wism.colQty')}
                        </th>
                        <th className="px-4 py-3 text-right font-bold">
                          {t('activity.mining.modals.wism.colValue')}
                        </th>
                        <th className="px-4 py-3 text-right font-bold text-cyan-200">
                          {t('activity.mining.modals.wism.colEfficiency')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cyan-300/10">
                      {rows.map((r, i) => {
                        const isTop = i < Math.max(1, Math.ceil(rows.length / 4))
                        return (
                          <tr
                            key={`${r.typeId}-${i}`}
                            className={cn(
                              'transition-colors',
                              isTop ? 'bg-cyan-400/[0.08]' : 'hover:bg-cyan-400/[0.04]'
                            )}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <ActionBadge action={r.bestAction} />
                                <span
                                  className={cn(
                                    'font-medium',
                                    isTop ? 'text-cyan-50' : 'text-cyan-100/75'
                                  )}
                                >
                                  {r.resolvedName}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-cyan-200/60">
                              {r.quantity.toLocaleString()}
                            </td>
                            <td className={cn('px-4 py-3 text-right font-semibold tabular-nums', theme.revenuePositive)}>
                              {formatISK(r.totalValue)}
                            </td>
                            <td
                              className={cn(
                                'px-4 py-3 text-right font-bold tabular-nums',
                                isTop ? 'text-cyan-200' : 'text-cyan-300/70'
                              )}
                            >
                              {r.iskPerM3.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                              <span className="ml-1 text-[9px] font-normal opacity-60">ISK/m³</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </TooltipProvider>
              </div>
              <p className={cn('mt-3 px-3 pb-2 text-[10px] leading-relaxed', theme.textMuted)}>
                {t('activity.mining.modals.wism.footnote')}
              </p>
              <div className="flex flex-wrap gap-4 px-3 pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-300" />
                  <span className="text-[10px] text-cyan-200/70">{t('activity.mining.modals.wism.legendRaw')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-sky-400" />
                  <span className="text-[10px] text-cyan-200/70">{t('activity.mining.modals.wism.legendComp')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-[10px] text-cyan-200/70">{t('activity.mining.modals.wism.legendRef')}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          !error && (
            <div
              className={cn(
                'flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-10 text-center',
                theme.logEmpty
              )}
            >
              <ScanSearch className={cn('mb-3 h-10 w-10 opacity-40', theme.textMuted)} />
              <p className={cn('text-xs', theme.textMuted)}>{t('activity.mining.modals.wism.emptyHint')}</p>
            </div>
          )
        )}
      </div>
    </MiningThemedDialog>
  )
}
