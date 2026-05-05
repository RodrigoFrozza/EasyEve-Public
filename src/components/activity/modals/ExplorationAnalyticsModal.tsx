'use client'

import { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatISK, formatNumber } from '@/lib/utils'
import { Sparkline } from '@/components/ui/Sparkline'
import { useTranslations } from '@/i18n/hooks'

interface ExplorationAnalyticsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  logs: any[]
  activity?: any
}

export function ExplorationAnalyticsModal({ open, onOpenChange, logs, activity }: ExplorationAnalyticsModalProps) {
  const { t } = useTranslations()
  const [selectedCharacter, setSelectedCharacter] = useState<string>('all')

  const filteredLogs = useMemo(() => {
    if (selectedCharacter === 'all') return logs
    return logs.filter((log: any) => `${log.charId}` === selectedCharacter)
  }, [logs, selectedCharacter])

  const byType = useMemo(() => {
    const sums: Record<string, number> = {
      relic: 0,
      data: 0,
      ghost: 0,
      sleeper: 0,
      other: 0,
    }
    filteredLogs.forEach((log: any) => {
      // logs from exploration can have spaceType or type
      const spaceType = log.spaceType?.toLowerCase() || ''
      let category = 'other'
      
      if (spaceType.includes('relic')) category = 'relic'
      else if (spaceType.includes('data')) category = 'data'
      else if (spaceType.includes('ghost')) category = 'ghost'
      else if (spaceType.includes('sleeper')) category = 'sleeper'
      
      if (category in sums) {
        sums[category] += (log.value || log.amount || 0)
      } else {
        sums.other += (log.value || log.amount || 0)
      }
    })
    return sums
  }, [filteredLogs])

  const byCharacter = useMemo(() => {
    const map = new Map<string, { name: string; total: number; logs: any[] }>()
    filteredLogs.forEach((log: any) => {
      const key = `${log.charId || 0}`
      const current = map.get(key) || { name: log.charName || 'Unknown', total: 0, logs: [] as any[] }
      current.total += (log.value || log.amount || 0)
      current.logs.push(log)
      map.set(key, current)
    })
    
    return Array.from(map.entries()).map(([id, value]) => {
      const sortedLogs = value.logs.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      const startTime = activity?.startTime ? new Date(activity.startTime).getTime() : new Date(sortedLogs[0]?.date).getTime()
      const endTime = activity?.endTime ? new Date(activity.endTime).getTime() : Date.now()
      const hours = Math.max(0.1, (endTime - startTime) / (1000 * 60 * 60))
      const iskPerHour = value.total / hours
      return { id, name: value.name, total: value.total, iskPerHour }
    }).sort((a, b) => b.total - a.total)
  }, [filteredLogs, activity])

  const topIsk = byCharacter[0]
  const topIskPerHour = [...byCharacter].sort((a, b) => b.iskPerHour - a.iskPerHour)[0]

  const timelines = useMemo(() => {
    const ordered = [...filteredLogs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    
    const result = {
      relic: { data: [] as number[], color: '#ef4444' }, // red
      data: { data: [] as number[], color: '#3b82f6' },  // blue
      total: { data: [] as number[], color: '#10b981' } // emerald
    }
    
    let accRelic = 0, accData = 0, accTotal = 0
    
    ordered.forEach((entry) => {
      const spaceType = entry.spaceType?.toLowerCase() || ''
      const value = entry.value || entry.amount || 0
      
      if (spaceType.includes('relic')) accRelic += value
      if (spaceType.includes('data')) accData += value
      accTotal += value
      
      result.relic.data.push(accRelic)
      result.data.data.push(accData)
      result.total.data.push(accTotal)
    })
    
    return result
  }, [filteredLogs])

  const totalValue = Object.values(byType).reduce((a, b) => a + b, 0)
  const slices = [
    { label: 'Relic', value: byType.relic, color: '#ef4444' },
    { label: 'Data', value: byType.data, color: '#3b82f6' },
    { label: 'Ghost/Sleeper', value: byType.ghost + byType.sleeper, color: '#eab308' },
    { label: 'Other', value: byType.other, color: '#71717a' },
  ].filter((slice) => slice.value > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-zinc-950 border-white/5 text-white rounded-[32px]">
        <DialogHeader>
          <DialogTitle className="text-sm uppercase font-black tracking-[0.3em] font-outfit text-zinc-400">
            {t('activity.exploration.analytics')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Exploration performance analysis and ISK/h breakdown.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
            <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px] mb-2">{t('activity.summary.topContributor')}</p>
            <p className="text-white font-black text-lg font-outfit uppercase truncate">{topIsk?.name || '—'}</p>
            <p className="font-mono text-emerald-400 font-bold">{topIsk ? formatISK(topIsk.total) : formatISK(0)}</p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
            <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px] mb-2">{t('activity.summary.topEfficiency')}</p>
            <p className="text-white font-black text-lg font-outfit uppercase truncate">{topIskPerHour?.name || '—'}</p>
            <p className="font-mono text-cyan-400 font-bold">{topIskPerHour ? formatISK(topIskPerHour.iskPerHour) : formatISK(0)}/h</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-white/5 bg-white/5 p-6">
            <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500 mb-6">{t('activity.summary.revenueTimeline')}</p>
            <div className="h-[160px] w-full" suppressHydrationWarning>
              <Sparkline 
                datasets={[
                  { data: timelines.total.data, color: '#10b981' },
                  { data: timelines.relic.data, color: '#ef4444' },
                  { data: timelines.data.data, color: '#3b82f6' },
                ]} 
                width={680} 
                height={160} 
                strokeWidth={3}
              />
            </div>
            <div className="flex gap-6 mt-6">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[#10b981]" />
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Total</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[#ef4444]" />
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Relic</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[#3b82f6]" />
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Data</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-white/5 bg-white/5 p-6">
              <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500 mb-6">{t('activity.summary.yieldComposition')}</p>
              <div className="space-y-4">
                {slices.map((slice) => {
                  const percent = totalValue > 0 ? (slice.value / totalValue) * 100 : 0
                  return (
                    <div key={slice.label} className="group">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[11px] font-black uppercase text-zinc-300 tracking-wider">{slice.label}</span>
                        <span className="text-[11px] font-mono font-black text-white">{percent.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-1000" 
                          style={{ width: `${percent}%`, backgroundColor: slice.color }} 
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/5 p-6 max-h-[280px] overflow-y-auto custom-scrollbar">
              <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500 mb-6">{t('activity.summary.personnelPerformance')}</p>
              <div className="space-y-3">
                {byCharacter.map((char) => (
                  <div key={char.id} className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/[0.02]">
                    <span className="text-[11px] font-black text-zinc-300 uppercase truncate max-w-[140px] font-outfit">{char.name}</span>
                    <div className="text-right">
                      <p className="font-mono text-[11px] font-black text-emerald-400">{formatISK(char.total)}</p>
                      <p className="text-[9px] text-zinc-600 font-black uppercase mt-0.5">{formatISK(char.iskPerHour)}/h</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
