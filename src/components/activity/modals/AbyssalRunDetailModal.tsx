'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Package, X, ArrowUpRight, ArrowDownRight, Zap } from 'lucide-react'
import { formatISK, cn } from '@/lib/utils'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ABYSSAL_TIERS, ABYSSAL_WEATHER } from '@/lib/constants/activity-data'

interface Item {
  name: string
  quantity: number
  value?: number
}

interface AbyssalRunDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  run: {
    id: string
    startTime: string
    endTime?: string
    tier?: string
    weather?: string
    ship?: string
    lootValue?: number
    lootItems?: Item[]
    consumedItems?: Item[]
  } | null
}

export function AbyssalRunDetailModal({ open, onOpenChange, run }: AbyssalRunDetailModalProps) {
  if (!run) return null

  const tierIcon = ABYSSAL_TIERS.find(t => t.label === run.tier)?.iconPath
  const weatherIcon = ABYSSAL_WEATHER.find(w => w.label === run.weather)?.iconPath
  const netProfit = run.lootValue || 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-zinc-950 border-zinc-800 text-white p-0 overflow-hidden max-h-[90vh]">
        <div className="h-1.5 w-full bg-gradient-to-r from-fuchsia-600 via-purple-600 to-red-600" />
        
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {tierIcon && (
                  <Avatar className="h-8 w-8 rounded border border-zinc-800">
                    <AvatarImage src={tierIcon} />
                    <AvatarFallback>T</AvatarFallback>
                  </Avatar>
                )}
                {weatherIcon && (
                  <Avatar className="h-8 w-8 rounded border border-zinc-800">
                    <AvatarImage src={weatherIcon} />
                    <AvatarFallback>W</AvatarFallback>
                  </Avatar>
                )}
              </div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">
                  Run Details
                </DialogTitle>
                <DialogDescription className="text-zinc-500 text-[10px]">
                  <FormattedDate date={run.startTime} mode="datetime" />
                </DialogDescription>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Net Profit</p>
              <p className={cn("text-lg font-mono font-black", netProfit >= 0 ? "text-emerald-400" : "text-red-400")}>
                {Math.abs(netProfit) >= 1000000 ? `${(netProfit / 1000000).toFixed(3)}M ISK` : formatISK(netProfit)}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                <ArrowUpRight className="h-3 w-3" />
                Loot Obtained
              </h4>
              <ScrollArea className="h-[250px] rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-3">
                <div className="space-y-1.5">
                  {run.lootItems && run.lootItems.length > 0 ? (
                    run.lootItems.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-300 truncate max-w-[150px]">{item.name} x{item.quantity}</span>
                        <span className="text-emerald-400/80 font-mono">{formatISK(item.value || 0)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] text-zinc-600 italic py-4 text-center">No loot registered</p>
                  )}
                </div>
              </ScrollArea>
            </div>

            <div className="space-y-2">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-red-400 flex items-center gap-2">
                <ArrowDownRight className="h-3 w-3" />
                Items Consumed
              </h4>
              <ScrollArea className="h-[250px] rounded-xl border border-red-500/10 bg-red-500/5 p-3">
                <div className="space-y-1.5">
                  {run.consumedItems && run.consumedItems.length > 0 ? (
                    run.consumedItems.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-300 truncate max-w-[150px]">{item.name} x{item.quantity}</span>
                        <span className="text-red-400/80 font-mono">-{formatISK(item.value || 0)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] text-zinc-600 italic py-4 text-center">No consumption registered</p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-[9px] text-zinc-500 uppercase font-black">Ship</p>
                <p className="text-xs font-bold text-zinc-300">{run.ship || 'Undefined'}</p>
              </div>
              <div className="h-6 w-px bg-zinc-800" />
              <div>
                <p className="text-[9px] text-zinc-500 uppercase font-black">Tier</p>
                <p className="text-xs font-bold text-zinc-300">{run.tier || 'Undefined'}</p>
              </div>
              <div className="h-6 w-px bg-zinc-800" />
              <div>
                <p className="text-[9px] text-zinc-500 uppercase font-black">Weather</p>
                <p className="text-xs font-bold text-zinc-300">{run.weather || 'Undefined'}</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 bg-zinc-900/50 border-t border-zinc-800">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-zinc-500 hover:text-white uppercase font-black text-[10px]">
            <X className="h-3 w-3 mr-2" />
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
