'use client'

import { Lock, Crown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

interface PremiumOverlayProps {
  title: string
  description: string
}

export function PremiumOverlay({ title, description }: PremiumOverlayProps) {
  const router = useRouter()

  return (
    <div className="relative min-h-[400px] w-full flex items-center justify-center rounded-2xl border border-eve-accent/10 bg-eve-panel/20 backdrop-blur-md overflow-hidden">
      {/* Background Glow */}
      <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-eve-accent/5 blur-[100px]" />
      <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-eve-accent/5 blur-[100px]" />

      <div className="z-10 text-center space-y-6 max-w-md px-6">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mx-auto w-20 h-20 rounded-full bg-eve-dark border border-eve-accent/20 flex items-center justify-center shadow-[0_0_30px_rgba(0,255,255,0.1)]"
        >
          <Lock className="h-10 w-10 text-eve-accent animate-pulse" />
        </motion.div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
            <Crown className="h-5 w-5 text-eve-accent2 fill-eve-accent2" />
            {title}
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            {description}
          </p>
        </div>

        <div className="pt-4">
          <Button 
            onClick={() => router.push('/dashboard/subscription')}
            className="bg-eve-accent text-black hover:bg-eve-accent/80 font-bold px-8 py-6 rounded-xl group transition-all"
          >
            Upgrade to Premium
            <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
          <p className="mt-4 text-[10px] uppercase font-black tracking-widest text-zinc-600">
            Exclusive Tactical Features
          </p>
        </div>
      </div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
    </div>
  )
}
