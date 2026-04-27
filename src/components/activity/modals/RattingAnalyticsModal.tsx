'use client'

import { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatISK } from '@/lib/utils'
import { Sparkline } from '@/components/ui/Sparkline'

interface RattingAnalyticsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  logs: any[]
}

export function RattingAnalyticsModal({ open, onOpenChange, logs }: RattingAnalyticsModalProps) {
  const [selectedCharacter, setSelectedCharacter] = useState<string>('all')

  const filteredLogs = useMemo(() => {
    if (selectedCharacter === 'all') return logs
    return logs.filter((log: any) => `${log.charId}` === selectedCharacter)
  }, [logs, selectedCharacter])

  const byType = useMemo(() => {
    const sums = {
      bounty: 0,
      ess: 0,
      loot: 0,
      salvage: 0,
      mtu: 0,
    }
    filteredLogs.forEach((log: any) => {
      if (log.type in sums) {
        sums[log.type as keyof typeof sums] += log.amount || 0
      }
    })
    sums.loot += sums.mtu
    return sums
  }, [filteredLogs])

  const byCharacter = useMemo(() => {
    const map = new Map<string, { name: string; total: number }>()
    filteredLogs.forEach((log: any) => {
      const key = `${log.charId || 0}`
      const current = map.get(key) || { name: log.charName || 'Unknown', total: 0 }
      current.total += log.amount || 0
      map.set(key, current)
    })
    return Array.from(map.entries()).map(([id, value]) => ({ id, ...value })).sort((a, b) => b.total - a.total)
  }, [filteredLogs])

  const timeline = useMemo(() => {
    const ordered = [...filteredLogs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    let acc = 0
    return ordered.map((entry) => {
      acc += entry.amount || 0
      return acc
    })
  }, [filteredLogs])

  const total = byType.bounty + byType.ess + byType.loot + byType.salvage
  const slices = [
    { label: 'Bounty', value: byType.bounty },
    { label: 'ESS', value: byType.ess },
    { label: 'Loot', value: byType.loot + byType.salvage },
  ].filter((slice) => slice.value > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-zinc-950 border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-sm uppercase tracking-wider">ISK/h Performance</DialogTitle>
        </DialogHeader>

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
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 lg:col-span-2">
            <p className="text-[10px] uppercase text-zinc-500 font-bold mb-2">Timeline (line)</p>
            <Sparkline data={timeline} width={560} height={120} color="#22d3ee" />
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
            <p className="text-[10px] uppercase text-zinc-500 font-bold mb-2">Composition (pie-style list)</p>
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
                      <div className="h-full bg-cyan-500" style={{ width: `${percent}%` }} />
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
                <span className="font-mono text-emerald-400">{formatISK(char.total)}</span>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

