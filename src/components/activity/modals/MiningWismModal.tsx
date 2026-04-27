'use client'

import { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatISK } from '@/lib/utils'
import { parseMiningScanBlock } from '@/lib/mining-scan-parse'
import type { MiningValuableOreRow } from '@/components/activity/MiningValuableOres'
import { MiningPriceConfidence } from '@/components/activity/MiningPriceConfidence'
import { TooltipProvider } from '@/components/ui/tooltip'

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
  unitPrice: number
  lineValue: number
  priceBasis: MiningValuableOreRow['priceBasis']
  priceConfidence: MiningValuableOreRow['priceConfidence']
}

export function MiningWismModal({ open, onOpenChange, miningCategory, space }: MiningWismModalProps) {
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
        setError('No lines parsed. Use formats like "12345 Veldspar" or "Veldspar\t12345".')
        setBusy(false)
        return
      }

      const names = [...new Set(parsed.map((p) => p.name))].slice(0, 80)
      const res = await fetch('/api/sde/resolve-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names }),
      })
      if (!res.ok) throw new Error('Name resolve failed')
      const nameHit = (await res.json()) as Record<string, { id: number; name: string }>

      const q = new URLSearchParams({ type: miningCategory })
      if (space) q.set('space', space)
      const mtRes = await fetch(`/api/sde/mining-types?${q.toString()}`)
      if (!mtRes.ok) throw new Error('Market snapshot failed')
      const market = (await mtRes.json()) as MiningValuableOreRow[]
      const byId = new Map(market.map((m) => [m.id, m]))

      const lookupResolved = (scanName: string) => {
        const direct = nameHit[scanName]
        if (direct) return direct
        const lower = scanName.toLowerCase()
        const key = Object.keys(nameHit).find((k) => k.toLowerCase() === lower)
        return key ? nameHit[key] : undefined
      }

      const built: ResolvedRow[] = []
      for (const p of parsed) {
        const hit = lookupResolved(p.name)
        if (!hit) continue
        const m = byId.get(hit.id)
        const unit = m?.buy || 0
        built.push({
          scannedName: p.name,
          quantity: p.quantity,
          typeId: hit.id,
          resolvedName: m?.name || hit.name,
          unitPrice: unit,
          lineValue: unit * p.quantity,
          priceBasis: m?.priceBasis || 'none',
          priceConfidence: m?.priceConfidence || 'none',
        })
      }

      built.sort((a, b) => b.lineValue - a.lineValue)
      setRows(built)
      if (built.length === 0) {
        setError('No scanned lines matched SDE type names. Check spelling.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
      setRows([])
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-zinc-950 border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-sm uppercase tracking-wider">What I Should Mine (WISM)</DialogTitle>
        </DialogHeader>
        <p className="text-[10px] text-zinc-500 leading-relaxed">
          Paste scanned ore lines (overview / survey). Parsed rows are ranked by total ISK using the same Jita fallback chain as the market table.
        </p>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'12345 Veldspar\n6789 Scordite'}
          className="min-h-[120px] bg-zinc-900 border-zinc-800 font-mono text-xs"
        />
        {error && <p className="text-[10px] text-red-400 font-bold">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" size="sm" disabled={!canRun} onClick={() => void run()}>
            {busy ? 'Analyzing…' : 'Analyze'}
          </Button>
        </div>
        {rows.length > 0 && (
          <TooltipProvider delayDuration={200}>
            <div className="rounded-lg border border-zinc-800 max-h-[220px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-[10px]">
                <thead className="text-zinc-500 uppercase sticky top-0 bg-zinc-950">
                  <tr>
                    <th className="text-left p-2">Ore</th>
                    <th className="text-right p-2">Qty</th>
                    <th className="text-right p-2">Unit</th>
                    <th className="text-right p-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`${r.typeId}-${r.scannedName}`} className="border-t border-white/[0.03]">
                      <td className="p-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <MiningPriceConfidence confidence={r.priceConfidence} basis={r.priceBasis} />
                          <span className="truncate text-zinc-200 font-bold">{r.resolvedName}</span>
                        </div>
                      </td>
                      <td className="p-2 text-right font-mono text-zinc-400">{r.quantity.toLocaleString()}</td>
                      <td className="p-2 text-right font-mono text-amber-200/90">{r.unitPrice > 0 ? formatISK(r.unitPrice) : '—'}</td>
                      <td className="p-2 text-right font-mono text-emerald-300">{r.lineValue > 0 ? formatISK(r.lineValue) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TooltipProvider>
        )}
      </DialogContent>
    </Dialog>
  )
}
