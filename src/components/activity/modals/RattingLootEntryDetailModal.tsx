'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatISK } from '@/lib/utils'

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
        </DialogHeader>
        <div className="space-y-2">
          <div className="text-xs text-zinc-400">Recorded at: {entry.date}</div>
          <div className="text-xs text-zinc-400">Total: {formatISK(entry.amount || 0)}</div>
          <div className="max-h-[320px] overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/40 p-2 space-y-1">
            {(entry.items || []).map((item: any, idx: number) => (
              <div key={idx} className="grid grid-cols-5 gap-2 text-xs py-1 border-b border-zinc-800/60 last:border-0">
                <span className="col-span-2 text-zinc-300">{item.name}</span>
                <span className="text-zinc-500">{item.quantity}</span>
                <span className="font-mono text-emerald-300">{formatISK(item.unitPrice || 0)}</span>
                <span className="font-mono text-emerald-400">{formatISK(item.totalValue || 0)}</span>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

