'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatISK } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { Info, Package, TrendingUp, MapPin } from 'lucide-react'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { formatNumber } from '@/lib/utils'

interface ExplorationLogDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  log: any
}

export function ExplorationLogDetailsModal({ 
  open, 
  onOpenChange, 
  log 
}: ExplorationLogDetailsModalProps) {
  const { t } = useTranslations()
  const [mounted, setMounted] = useState(false)
  const [resolvedIds, setResolvedIds] = useState<Record<string, number>>({})

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!log?.items || !open) return

    const itemsToResolve = log.items
      .filter((item: any) => !item.typeId)
      .map((item: any) => item.name.trim())

    if (itemsToResolve.length === 0) return

    const resolve = async () => {
      try {
        const res = await fetch('/api/market/appraisal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: itemsToResolve })
        })
        if (res.ok) {
          const data = await res.json()
          const newResolvedIds: Record<string, number> = {}
          Object.entries(data.appraisal || {}).forEach(([name, info]: [string, any]) => {
            newResolvedIds[name.toLowerCase().trim()] = info.id
          })
          setResolvedIds(prev => ({ ...prev, ...newResolvedIds }))
        }
      } catch (e) {
        console.error('Failed to resolve type IDs:', e)
      }
    }
    resolve()
  }, [log, open])

  if (!log) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-[#0a0a0f] border-zinc-800 shadow-2xl p-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-indigo-500" />
        
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-500">
               Exploration Log Detail
            </span>
            <span className="text-[10px] font-black text-zinc-500">
               <FormattedDate date={log.date} mode="datetime" />
            </span>
          </div>
          <DialogTitle className="text-xl font-black text-white flex items-center gap-2">
            <MapPin className="h-5 w-5 text-indigo-400" />
            {log.siteName}
          </DialogTitle>
          <DialogDescription className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">
             Space Type: <span className="text-zinc-300">{log.spaceType}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
           {/* Summary Bar */}
           <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-zinc-900/40 border border-white/[0.02] rounded-xl">
                 <p className="text-[8px] text-zinc-500 uppercase font-black mb-1">Total Items</p>
                 <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-zinc-400" />
                    <span className="text-sm font-black text-white">
                       {log.items?.reduce((sum: number, i: any) => sum + i.quantity, 0) || 0}
                    </span>
                 </div>
              </div>
              <div className="p-3 bg-zinc-900/40 border border-white/[0.02] rounded-xl">
                 <p className="text-[8px] text-zinc-500 uppercase font-black mb-1">Estimated Value</p>
                 <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm font-black text-emerald-400">
                       {formatISK(log.value)}
                    </span>
                 </div>
              </div>
           </div>

           {/* Items Table */}
           <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-950/30">
              <div className="grid grid-cols-[1fr_80px_100px] gap-2 px-4 py-2 bg-zinc-900/50 border-b border-zinc-800">
                 <span className="text-[8px] font-black uppercase text-zinc-500 tracking-widest">Item</span>
                 <span className="text-[8px] font-black uppercase text-zinc-500 tracking-widest text-right">Quantity</span>
                 <span className="text-[8px] font-black uppercase text-zinc-500 tracking-widest text-right">Total Value</span>
              </div>
              <ScrollArea className="h-[300px]">
                 <div className="divide-y divide-zinc-900">
                    {log.items?.map((item: any, idx: number) => (
                        <div key={idx} className="grid grid-cols-[1fr_80px_100px] gap-2 px-4 py-2 hover:bg-white/[0.02] transition-colors items-center">
                           <div className="flex items-center gap-3 min-w-0">
                              <div className="h-8 w-8 shrink-0 rounded-lg bg-zinc-900 flex items-center justify-center border border-white/[0.03]">
                                {(() => {
                                  const id = item.typeId || item.type_id || item.id || resolvedIds[item.name.toLowerCase().trim()];
                                  return (
                                    <Image 
                                      src={`https://images.evetech.net/types/${id || 0}/icon?size=32`} 
                                      alt={item.name}
                                      width={24}
                                      height={24}
                                      className="rounded bg-zinc-900 border border-white/5 shadow-sm group-hover/item:scale-110 transition-transform"
                                      unoptimized
                                    />
                                  );
                                })()}
                              </div>
                              <span className="text-xs font-bold text-zinc-200 truncate">{item.name}</span>
                           </div>
                           <span className="text-xs font-mono text-zinc-400 text-right">
                              {formatNumber(item.quantity)}
                           </span>
                           <span className="text-xs font-mono text-emerald-400 text-right font-black">
                              {formatISK(item.total)}
                           </span>
                        </div>
                    ))}
                    {(!log.items || log.items.length === 0) && (
                       <div className="py-10 text-center">
                          <Info className="h-8 w-8 text-zinc-800 mx-auto mb-2" />
                          <p className="text-xs text-zinc-600 font-bold uppercase">{t('global.noItemDataForSite')}</p>
                       </div>
                    )}
                 </div>
              </ScrollArea>
           </div>
        </div>

        <div className="p-4 bg-zinc-950/80 border-t border-zinc-900/50 flex justify-end">
           <button 
              onClick={() => onOpenChange(false)}
              className="text-[10px] font-black uppercase text-zinc-500 hover:text-white transition-colors tracking-widest"
           >
              Close Record
           </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
