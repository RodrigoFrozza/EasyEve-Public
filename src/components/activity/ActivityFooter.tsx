'use client'

import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ActivityFooterProps {
  onDismiss: () => void
}

export function ActivityFooter({ onDismiss }: ActivityFooterProps) {
  return (
    <div className="bg-zinc-900/60 p-4 sm:p-5 border-t border-white/5 backdrop-blur-2xl">
      <Button 
        className="w-full bg-white/5 hover:bg-white/10 text-zinc-600 hover:text-white font-black uppercase text-[10px] tracking-[0.22em] h-10 rounded-lg border border-white/10 transition-all duration-300 font-outfit shadow-2xl group"
        onClick={onDismiss}
      >
        DISMISS BRIEFING <ChevronRight className="h-4 w-4 ml-2 text-zinc-800 group-hover:text-white transition-colors" />
      </Button>
    </div>
  )
}