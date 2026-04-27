'use client'

import { useEffect, useState } from 'react'
import { formatISK } from '@/lib/utils'
import { MiningPriceConfidence } from '@/components/activity/MiningPriceConfidence'
import type { MiningValuableOreRow } from '@/components/activity/MiningValuableOres'
import { TooltipProvider } from '@/components/ui/tooltip'

interface MiningSetupValuableOresPreviewProps {
  space?: string
  miningType?: string
}

export function MiningSetupValuableOresPreview({ space, miningType }: MiningSetupValuableOresPreviewProps) {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<MiningValuableOreRow[]>([])

  useEffect(() => {
    if (!miningType) {
      setRows([])
      return
    }
    setLoading(true)
    const q = new URLSearchParams({ type: miningType })
    if (space) q.set('space', space)
    fetch(`/api/sde/mining-types?${q.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setRows(Array.isArray(data) ? (data as MiningValuableOreRow[]).slice(0, 12) : [])
      })
      .finally(() => setLoading(false))
  }, [space, miningType])

  if (!miningType) {
    return (
      <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-tight">
        Select a mining category to preview the most valuable ores for Jita pricing.
      </p>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 space-y-2">
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Most valuable ores (preview)</p>
        {loading ? (
          <div className="animate-pulse h-16 bg-zinc-900 rounded-lg" />
        ) : rows.length === 0 ? (
          <p className="text-[10px] text-zinc-600">No SDE types matched this combination.</p>
        ) : (
          <ul className="space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
            {rows.map((r, i) => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-[10px]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-zinc-600 font-mono w-4 shrink-0">{i + 1}</span>
                  <MiningPriceConfidence confidence={r.priceConfidence} basis={r.priceBasis} />
                  <span className="text-zinc-300 font-bold truncate">{r.name}</span>
                </div>
                <span className="font-mono text-amber-200/90 shrink-0">{r.buy > 0 ? formatISK(r.buy) : '—'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </TooltipProvider>
  )
}
