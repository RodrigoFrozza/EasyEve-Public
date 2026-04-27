'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Gem } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MiningValuableOres } from '../MiningValuableOres'

interface MiningBestOresModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialMiningType?: string
  space?: string
}

export function MiningBestOresModal({ open, onOpenChange, initialMiningType, space }: MiningBestOresModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] bg-zinc-950 border-zinc-800 text-zinc-100 p-0 overflow-hidden">
        <div className="bg-gradient-to-b from-amber-500/10 to-transparent p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tighter">
              <div className="h-8 w-8 rounded-lg bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
                <Gem className="h-5 w-5 text-amber-300" />
              </div>
              Ore market (Jita)
            </DialogTitle>
          </DialogHeader>

          <MiningValuableOres initialType={initialMiningType || 'Ore'} space={space} lockCategory={!!initialMiningType} />
        </div>

        <div className="p-4 bg-zinc-900/30 border-t border-white/5 flex justify-end">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-[10px] uppercase font-black tracking-widest text-zinc-500 hover:text-white"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
