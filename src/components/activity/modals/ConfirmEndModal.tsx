'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, StopCircle, X } from 'lucide-react'

interface ConfirmEndModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  activityName?: string
}

export function ConfirmEndModal({ open, onOpenChange, onConfirm }: ConfirmEndModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px] bg-zinc-950 border-zinc-900 text-zinc-100 p-6 rounded-2xl overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500/50 to-transparent" />
        
        <DialogHeader className="pt-2">
          <DialogTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-wider text-white">
            <div className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            End Activity?
          </DialogTitle>
          <DialogDescription className="text-zinc-400 text-sm mt-4 font-medium leading-relaxed">
            Are you sure you want to end this activity? This operation will be finalized and recorded.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-8 gap-3 flex flex-row sm:justify-end">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="flex-1 h-11 bg-zinc-900/50 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 font-bold uppercase text-[10px] tracking-widest transition-all rounded-xl"
          >
            Cancel
          </Button>
          <Button 
            onClick={onConfirm}
            className="flex-1 h-11 bg-red-600 hover:bg-red-500 text-white font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-red-950/20 rounded-xl"
          >
            <StopCircle className="h-4 w-4 mr-2" />
            End Activity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}