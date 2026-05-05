'use client'

import { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatISK } from '@/lib/utils'
import { parseMiningScanBlock } from '@/lib/mining-scan-parse'
import type { MiningValuableOreRow, MiningPriceData } from '@/components/activity/MiningValuableOres'
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
  bestPrice: number
  bestAction: 'RAW' | 'COMP' | 'REF'
  unitVolume: number
  totalValue: number
  totalVolume: number
  iskPerM3: number
  priceBasis: MiningPriceData['basis']
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
        setError('No lines parsed. Paste a scan result from EVE (Overview, Survey, or Mining Scanner).')
        setBusy(false)
        return
      }

      // 1. Resolve names to IDs
      const uniqueNames = [...new Set(parsed.map((p) => p.name))].slice(0, 80)
      const resolveRes = await fetch('/api/sde/resolve-types', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ names: uniqueNames }),
      })
      if (!resolveRes.ok) throw new Error('Name resolution failed')
       const nameMapping = (await resolveRes.json()) as Record<string, { id: number; name: string }>
       const nameMap = new Map<string, { id: number; name: string }>()
       for (const [key, value] of Object.entries(nameMapping)) {
         nameMap.set(key.toLowerCase(), value)
         nameMap.set(value.name.toLowerCase(), value)
       }

       // 2. Fetch all market data for this category
       const q = new URLSearchParams({ type: miningCategory })
       if (space) q.set('space', space)
       const marketRes = await fetch(`/api/sde/mining-types?${q.toString()}`)
       if (!marketRes.ok) throw new Error('Market snapshot failed')
       const marketData = (await marketRes.json()) as (MiningValuableOreRow & { unitRatio: number })[]
       const marketMap = new Map(marketData.map((m) => [m.id, m]))

       const built: ResolvedRow[] = []
       for (const p of parsed) {
         const hit = nameMap.get(p.name.toLowerCase()) || nameMapping[p.name]
        if (!hit) continue

        const m = marketMap.get(hit.id)
        if (!m) continue

        // Calculate normalized prices (already per 1 unit of raw ore from API)
        const pRaw = m.raw.price
        const pComp = m.compressed.price
        const pRef = m.refined.price

        // Find best option
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

      // Sort by Efficiency (ISK/m3)
      built.sort((a, b) => b.iskPerM3 - a.iskPerM3)
      setRows(built)
      
      if (built.length === 0) {
        setError('No scanned lines matched known market items.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
      setRows([])
    } finally {
      setBusy(false)
    }
  }

  const getActionBadge = (action: 'RAW' | 'COMP' | 'REF') => {
    const colors = {
      RAW: 'bg-zinc-800 text-zinc-400 border-zinc-700',
      COMP: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      REF: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    }
    return (
      <span className={`text-[8px] font-black px-1 rounded border ${colors[action]}`}>
        {action}
      </span>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-zinc-950 border-zinc-800 text-white p-0 overflow-hidden">
        <div className="p-6 bg-gradient-to-b from-blue-500/10 to-transparent">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
              <span className="text-blue-400">WISM</span> Analysis
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Paste your scan result. We&apos;ll find the most efficient path (Sell Raw, Compress, or Refine) for each rock.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'Dark Glitter\t226\t226.000 m3...'}
              className="min-h-[140px] bg-zinc-900/50 border-zinc-800 font-mono text-xs focus:ring-blue-500/20 transition-all"
            />

            <div className="flex justify-between items-center">
              {error ? (
                <p className="text-[10px] text-red-400 font-bold flex items-center gap-1">
                  <span className="h-1 w-1 rounded-full bg-red-400 animate-pulse" />
                  {error}
                </p>
              ) : <div />}
              
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  disabled={!canRun} 
                  onClick={() => void run()}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] uppercase font-black tracking-widest px-6 shadow-lg shadow-blue-900/20"
                >
                  {busy ? 'Crunching Numbers...' : 'Analyze Scan'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {rows.length > 0 && (
          <div className="border-t border-white/5 bg-zinc-900/20 p-6">
            <div className="rounded-xl border border-zinc-800/50 overflow-hidden">
              <div className="max-h-[340px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-[10px]">
                  <thead className="bg-zinc-950/80 backdrop-blur-sm text-zinc-500 uppercase sticky top-0 z-10 border-b border-zinc-800">
                    <tr>
                      <th className="text-left px-4 py-3 font-black tracking-widest">Ore / Action</th>
                      <th className="text-right px-4 py-3 font-black tracking-widest">Quantity</th>
                      <th className="text-right px-4 py-3 font-black tracking-widest">Total ISK</th>
                      <th className="text-right px-4 py-3 font-black tracking-widest bg-blue-500/5 text-blue-300">Efficiency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {rows.map((r, i) => {
                      const isTop = i < rows.length / 4
                      return (
                        <tr key={`${r.typeId}-${i}`} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {getActionBadge(r.bestAction)}
                              <span className={`font-bold ${isTop ? 'text-white' : 'text-zinc-400'}`}>
                                {r.resolvedName}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-zinc-500">
                            {r.quantity.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-400 font-bold">
                            {formatISK(r.totalValue)}
                          </td>
                          <td className={`px-4 py-3 text-right font-mono font-black text-xs ${isTop ? 'text-blue-300 bg-blue-500/5' : 'text-zinc-500'}`}>
                            {r.iskPerM3.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                            <span className="text-[8px] opacity-40 ml-1">ISK/m³</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="mt-4 flex items-center justify-between px-2">
              <span className="text-[9px] text-zinc-500 italic">
                * Efficiency ranked by ISK per volume. Action indicates the most profitable state for Jita market.
              </span>
              <div className="flex gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500/20 border border-emerald-500/40" />
                  <span className="text-[9px] text-zinc-400 uppercase font-bold tracking-tighter">Refine</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-500/20 border border-blue-500/40" />
                  <span className="text-[9px] text-zinc-400 uppercase font-bold tracking-tighter">Compress</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

