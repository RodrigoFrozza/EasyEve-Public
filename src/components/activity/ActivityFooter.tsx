'use client'

import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ActivityFooterProps {
  onDismiss: () => void
}

export function ActivityFooter({ onDismiss }: ActivityFooterProps) {
  return (
    <div className="bg-black p-4 sm:p-5 border-t border-eve-border/30 backdrop-blur-none">
      <Button 
        className="w-full bg-black hover:bg-eve-accent/10 text-zinc-500 hover:text-eve-accent font-black uppercase text-[11px] tracking-[0.25em] h-10 rounded-none border border-eve-border/30 transition-none font-mono shadow-none group"
        onClick={onDismiss}
      >
        DISMISS_BRIEFER <ChevronRight className="h-4 w-4 ml-2 text-zinc-700 group-hover:text-eve-accent transition-none" />
      </Button>
    </div>
  )
}