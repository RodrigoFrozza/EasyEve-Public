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
      <div className="max-w-md w-full bg-zinc-900/40 border border-zinc-800 rounded-md p-10 text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
          <XCircle className="w-8 h-8 text-red-500" />
        </div>
        
        <h2 className="text-xl font-bold text-white mb-2">
          {moduleName} Unavailable
        </h2>
        
        <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
          {message}
        </p>
        
        <Button 
          asChild
          className="bg-white text-black hover:bg-zinc-200 px-6 py-2 rounded-md font-bold h-10"
        >
          <Link href="/dashboard">
            Return to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  )
}
