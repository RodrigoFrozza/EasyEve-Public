'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatISK } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface RattingLootEntryDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: any | null
}

export function RattingLootEntryDetailModal({ open, onOpenChange, entry }: RattingLootEntryDetailModalProps) {
  if (!entry) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-zinc-950 border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-sm uppercase tracking-wider">Loot Entry Details</DialogTitle>
          <DialogDescription className="sr-only">
            Detailed breakdown of items in this loot entry.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="text-xs text-zinc-400">Recorded at: {entry.date}</div>
          <div className="text-xs text-zinc-400">Total: {formatISK(entry.amount || 0)}</div>
          <div className="max-h-[320px] overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/40 p-2 space-y-1">
            <div className="grid grid-cols-5 gap-2 text-[10px] text-zinc-500 uppercase font-bold px-2 py-1">
              <span className="col-span-2">Item</span>
              <span>Qty</span>
              <span className="text-right">Unit</span>
              <span className="text-right">Total</span>
            </div>
            {(entry.items || []).map((item: any, idx: number) => (
              <div key={idx} className="grid grid-cols-5 gap-2 text-xs py-1.5 px-2 border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/30 rounded">
                <div className="col-span-2 flex items-center gap-2 min-w-0">
                  <Avatar className="h-5 w-5 shrink-0 rounded">
                    <AvatarImage src={`https://images.evetech.net/types/${item.typeId || 0}/icon?size=32`} />
                    <AvatarFallback className="text-[6px] bg-zinc-800">?</AvatarFallback>
                  </Avatar>
                  <span className="text-zinc-300 truncate">{item.name}</span>
                </div>
                <span className="text-zinc-400">{item.quantity}</span>
                <span className="text-right font-mono text-zinc-300">{formatISK(item.unitPrice || 0)}</span>
                <span className="text-right font-mono text-red-400">{formatISK(item.totalValue || 0)}</span>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

