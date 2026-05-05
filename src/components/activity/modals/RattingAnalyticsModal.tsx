'use client'

import { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatISK } from '@/lib/utils'
import { Sparkline } from '@/components/ui/Sparkline'

interface RattingAnalyticsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  logs: any[]
  activity?: any
}

export function RattingAnalyticsModal({ open, onOpenChange, logs }: RattingAnalyticsModalProps) {
  const [selectedCharacter, setSelectedCharacter] = useState<string>('all')

  const filteredLogs = useMemo(() => {
    if (selectedCharacter === 'all') return logs
    return logs.filter((log: any) => `${log.charId}` === selectedCharacter)
  }, [logs, selectedCharacter])

  const byType = useMemo(() => {
    const sums: Record<string, number> = {
      bounty: 0,
      ess: 0,
      loot: 0,  // includes salvage and mtu
    }
    filteredLogs.forEach((log: any) => {
      const type = log.type === 'mtu' || log.type === 'salvage' ? 'loot' : log.type
      if (type in sums) {
        sums[type] = (sums[type] || 0) + (log.amount || 0)
      }
    })
    return sums
  }, [filteredLogs])

  const byCharacter = useMemo(() => {
    const map = new Map<string, { name: string; total: number; logs: any[] }>()
    filteredLogs.forEach((log: any) => {
      const key = `${log.charId || 0}`
      const current = map.get(key) || { name: log.charName || 'Unknown', total: 0, logs: [] as any[] }
      current.total += log.amount || 0
      current.logs.push(log)
      map.set(key, current)
    })
    return Array.from(map.entries()).map(([id, value]) => {
      const sortedLogs = value.logs.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      const firstDate = new Date(sortedLogs[0]?.date)
      const lastDate = new Date(sortedLogs[sortedLogs.length - 1]?.date)
      const hours = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60) || 1
      const iskPerHour = value.total / hours
      return { id, name: value.name, total: value.total, iskPerHour }
    }).sort((a, b) => b.total - a.total)
  }, [filteredLogs])

  const topIsk = byCharacter[0]
  const topIskPerHour = [...byCharacter].sort((a, b) => b.iskPerHour - a.iskPerHour)[0]

  const timelines = useMemo(() => {
    const ordered = [...filteredLogs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    
    const result = {
      bounty: { data: [] as number[], color: '#22c55e' },  // green
      ess: { data: [] as number[], color: '#eab308' },      // yellow
      loot: { data: [] as number[], color: '#3b82f6' }      // blue
    }
    
    let accBounty = 0, accEss = 0, accLoot = 0
    
    ordered.forEach((entry) => {
      const type = entry.type === 'mtu' || entry.type === 'salvage' ? 'loot' : entry.type
      if (type === 'bounty') accBounty += entry.amount || 0
      if (type === 'ess') accEss += entry.amount || 0
      if (type === 'loot') accLoot += entry.amount || 0
      
      result.bounty.data.push(accBounty)
      result.ess.data.push(accEss)
      result.loot.data.push(accLoot)
    })
    
    return result
  }, [filteredLogs])

  const total = byType.bounty + byType.ess + byType.loot
  const slices = [
    { label: 'Bounty', value: byType.bounty, color: '#22c55e' },
    { label: 'ESS', value: byType.ess, color: '#eab308' },
    { label: 'Loot', value: byType.loot, color: '#3b82f6' },
  ].filter((slice) => slice.value > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl bg-zinc-950 border-red-500/30 text-white">
        <DialogHeader>
          <DialogTitle className="text-sm uppercase tracking-wider">ISK/h Performance</DialogTitle>
          <DialogDescription className="sr-only">
            Analysis of ISK per hour performance including bounty, loot, and salvage breakdown.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
            <p className="text-zinc-500 font-bold uppercase mb-1">Top ISK</p>
            <p className="text-white font-black">{topIsk?.name || '—'}</p>
            <p className="font-mono text-emerald-300">{topIsk ? formatISK(topIsk.total) : formatISK(0)}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
            <p className="text-zinc-500 font-bold uppercase mb-1">Top ISK/h</p>
            <p className="text-white font-black">{topIskPerHour?.name || '—'}</p>
            <p className="font-mono text-cyan-300">{topIskPerHour ? formatISK(topIskPerHour.iskPerHour) : formatISK(0)}/h</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={selectedCharacter === 'all' ? 'default' : 'outline'} onClick={() => setSelectedCharacter('all')}>
            All Characters
          </Button>
          {byCharacter.map((char) => (
            <Button key={char.id} size="sm" variant={selectedCharacter === char.id ? 'default' : 'outline'} onClick={() => setSelectedCharacter(char.id)}>
              {char.name}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 lg:col-span-2 min-w-0">
              <p className="text-[10px] uppercase text-zinc-500 font-bold mb-2">Timeline (line)</p>
              <div className="w-full overflow-hidden">
                <Sparkline 
                  datasets={[
                    { data: timelines.bounty.data, color: '#22c55e' },
                    { data: timelines.ess.data, color: '#eab308' },
                    { data: timelines.loot.data, color: '#3b82f6' },
                  ]} 
                  width={560} 
                  height={120} 
                />
              </div>
              {/* Legend */}
              <div className="flex gap-4 mt-2">
                {slices.map((slice) => (
                  <div key={slice.label} className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: slice.color }} />
                    <span className="text-[10px]">{slice.label}</span>
                  </div>
                ))}
              </div>
            </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 min-w-0">
            <p className="text-[10px] uppercase text-zinc-500 font-bold mb-2">Composition</p>
            <div className="space-y-2">
              {slices.map((slice) => {
                const percent = total > 0 ? (slice.value / total) * 100 : 0
                return (
                  <div key={slice.label}>
                    <div className="flex justify-between text-xs">
                      <span>{slice.label}</span>
                      <span>{percent.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 rounded bg-zinc-800 overflow-hidden">
                      <div className="h-full" style={{ width: `${percent}%`, backgroundColor: slice.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 max-h-[220px] overflow-y-auto">
          <p className="text-[10px] uppercase text-zinc-500 font-bold mb-2">By Character</p>
          <div className="space-y-1">
            {byCharacter.map((char) => (
              <div key={char.id} className="flex items-center justify-between text-xs">
                <span className="text-zinc-300">{char.name}</span>
                  <span className="font-mono text-red-400">{formatISK(char.total)}</span>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

