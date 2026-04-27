'use client'

import React from 'react'
import { XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import Link from 'next/link'

interface ModuleUnavailableProps {
  moduleName?: string
  message?: string
}

export function ModuleUnavailable({ 
  moduleName = 'Module', 
  message = 'This feature is currently disabled by administrators.' 
}: ModuleUnavailableProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-zinc-950/40 backdrop-blur-md border border-white/5 rounded-[40px] p-12 text-center shadow-2xl"
      >
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-red-500/20">
          <XCircle className="w-10 h-10 text-red-500" />
        </div>
        
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter font-accent mb-3">
          {moduleName} Unavailable
        </h2>
        
        <p className="text-gray-400 text-base mb-8 leading-relaxed">
          {message}
        </p>
        
        <Button 
          asChild
          className="bg-white text-black hover:bg-zinc-200 px-8 py-6 rounded-2xl font-black uppercase tracking-widest text-xs h-auto"
        >
          <Link href="/dashboard">
            Return to Dashboard
          </Link>
        </Button>
      </motion.div>
    </div>
  )
}
