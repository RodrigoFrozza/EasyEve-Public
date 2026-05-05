'use client'

import { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatISK, formatNumber, formatCompactNumber, formatCurrencyValue } from '@/lib/utils'
import { Sparkline } from '@/components/ui/Sparkline'

interface MiningAnalyticsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activity: any
}

const ORE_PALETTE = ['#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#fb7185', '#22d3ee', '#818cf8']

export function MiningAnalyticsModal({ open, onOpenChange, activity }: MiningAnalyticsModalProps) {
  const [selectedCharacter, setSelectedCharacter] = useState<string>('all')

  const logs = useMemo(() => ((activity?.data as any)?.logs || []) as any[], [activity?.data])
  const oreBreakdown = useMemo(() => ((activity?.data as any)?.oreBreakdown || {}) as Record<string, any>, [activity?.data])
  const participantBreakdown = useMemo(
    () => ((activity?.data as any)?.participantBreakdown || {}) as Record<string, any>,
    [activity?.data]
  )

  const byCharacter = useMemo(() => {
    const entries = Object.entries(participantBreakdown || {})
    if (entries.length > 0) {
      return entries
        .map(([id, row]: [string, any]) => ({
          id,
          name: row.characterName || 'Unknown',
          isk: Number(row.estimatedValue || 0),
          vol: Number(row.volumeValue || 0),
        }))
        .sort((a, b) => b.isk - a.isk)
    }
    const map = new Map<string, { name: string; isk: number; vol: number }>()
    for (const log of logs) {
      const id = `${log.characterId || 0}`
      const cur = map.get(id) || { name: log.characterName || 'Unknown', isk: 0, vol: 0 }
      cur.isk += Number(log.estimatedValue || 0)
      cur.vol += Number(log.volumeValue || 0)
      map.set(id, cur)
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.isk - a.isk)
  }, [participantBreakdown, logs])

  const byOre = useMemo(() => {
    return Object.entries(oreBreakdown)
      .map(([typeId, row]) => ({
        typeId,
        name: row.name || `Type ${typeId}`,
        isk: Number(row.estimatedValue || 0),
        vol: Number(row.volumeValue || 0),
        qty: Number(row.quantity || 0),
      }))
      .sort((a, b) => b.isk - a.isk)
  }, [oreBreakdown])

  const filteredLogs = useMemo(() => {
    if (selectedCharacter === 'all') return logs
    return logs.filter((l) => `${l.characterId}` === selectedCharacter)
  }, [logs, selectedCharacter])

  const multiTimeline = useMemo(() => {
    const ordered = [...filteredLogs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    
    // Top 5 ores for the chart to keep it clean
    const topOres = byOre.slice(0, 5)
    const datasets: { label: string; data: number[]; color: string }[] = []
    
    // Total cumulative
    let totalAcc = 0
    const totalData: number[] = []
    
    // Ore specific accumulators
    const oreAccs: Record<string, number> = {}
    const oreData: Record<string, number[]> = {}
    
    topOres.forEach((ore) => {
      oreAccs[ore.typeId] = 0
      oreData[ore.typeId] = []
    })

    ordered.forEach((log) => {
      totalAcc += Number(log.estimatedValue || 0)
      totalData.push(totalAcc)
      
      topOres.forEach((ore) => {
        if (String(log.typeId) === String(ore.typeId)) {
          oreAccs[ore.typeId] += Number(log.estimatedValue || 0)
        }
        oreData[ore.typeId].push(oreAccs[ore.typeId])
      })
    })

    topOres.forEach((ore, idx) => {
      datasets.push({ 
        label: ore.name, 
        data: oreData[ore.typeId], 
        color: ORE_PALETTE[idx % ORE_PALETTE.length] 
      })
    })

    // Add total last so it renders on top
    datasets.push({ label: 'Total', data: totalData, color: '#fbbf24' })

    return datasets
  }, [filteredLogs, byOre])

  const pieOre = useMemo(() => {
    const total = byOre.reduce((s, o) => s + o.isk, 0)
    return byOre.slice(0, 8).map((o, idx) => ({
      label: o.name,
      value: o.isk,
      pct: total > 0 ? (o.isk / total) * 100 : 0,
      color: ORE_PALETTE[idx % ORE_PALETTE.length]
    }))
  }, [byOre])

  const topMinerIsk = byCharacter[0]
  const topMinerVol = [...byCharacter].sort((a, b) => b.vol - a.vol)[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-zinc-950 border-zinc-800 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm uppercase tracking-wider">Mining performance</DialogTitle>
          <DialogDescription className="sr-only">
            Statistical analysis of mining yield and value breakdown by character and ore type.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
            <p className="text-zinc-500 font-bold uppercase mb-1">Top ISK</p>
            <p className="text-white font-black">{topMinerIsk?.name || '—'}</p>
            <p className="font-mono text-emerald-300">{topMinerIsk ? formatISK(topMinerIsk.isk) : formatISK(0)}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
            <p className="text-zinc-500 font-bold uppercase mb-1">Top volume (m³)</p>
            <p className="text-white font-black">{topMinerVol?.name || '—'}</p>
            <p className="font-mono text-cyan-300">{topMinerVol ? formatCompactNumber(Math.round(topMinerVol.vol)) : '0'} m³</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={selectedCharacter === 'all' ? 'default' : 'outline'} onClick={() => setSelectedCharacter('all')}>
            All characters
          </Button>
          {byCharacter.map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant={selectedCharacter === c.id ? 'default' : 'outline'}
              onClick={() => setSelectedCharacter(c.id)}
            >
              {c.name}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 lg:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase text-zinc-500 font-bold">Cumulative ISK (line)</p>
              <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 ml-4">
                {multiTimeline.map((ds, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ds.color }} />
                    <span className="text-[8px] text-zinc-400 whitespace-nowrap">{ds.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <Sparkline 
              datasets={multiTimeline.length ? multiTimeline : [{ data: [0, 0], color: '#fbbf24' }]} 
              width={560} 
              height={120} 
            />
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
            <p className="text-[10px] uppercase text-zinc-500 font-bold mb-2">By ore (share)</p>
            <div className="space-y-2">
              {pieOre.map((slice) => (
                <div key={slice.label}>
                  <div className="flex justify-between text-xs gap-2">
                    <span className="truncate max-w-[140px]">{slice.label}</span>
                    <span>{slice.pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded bg-zinc-800 overflow-hidden">
                    <div className="h-full" style={{ width: `${Math.min(100, slice.pct)}%`, backgroundColor: slice.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 max-h-[200px] overflow-y-auto">
            <p className="text-[10px] uppercase text-zinc-500 font-bold mb-2">Characters</p>
            <div className="space-y-1">
              {byCharacter.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-xs gap-2">
                  <span className="text-zinc-300 truncate">{c.name}</span>
                  <span className="font-mono text-zinc-500 shrink-0">{formatCompactNumber(Math.round(c.vol))} m³</span>
                  <span className="font-mono text-emerald-400 shrink-0">{formatCurrencyValue(c.isk)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 max-h-[200px] overflow-y-auto">
            <p className="text-[10px] uppercase text-zinc-500 font-bold mb-2">Ore types</p>
            <div className="space-y-1">
              {byOre.map((o) => (
                <div key={o.typeId} className="grid grid-cols-[1fr_60px_80px] items-center text-xs gap-2">
                  <span className="text-zinc-300 truncate">{o.name}</span>
                  <span className="font-mono text-zinc-500 text-right">{formatCompactNumber(o.qty)} u</span>
                  <span className="font-mono text-amber-200 text-right">{formatCurrencyValue(o.isk)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
