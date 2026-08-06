'use client'

import { cn } from '@/lib/utils'

export function EnvBanner() {
  const isDev = process.env.NEXT_PUBLIC_APP_ENV === 'development'

  if (!isDev) return null

  return (
    <div 
      id="dev-environment-banner"
      className={cn(
        "fixed top-0 left-0 right-0 z-[9999] h-8",
        "bg-amber-500 flex items-center justify-center shadow-md border-b border-amber-600"
      )}
    >
      <div className="flex items-center gap-3 px-4 py-1">
        <div className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-black"></span>
        </div>
        <p className="text-black text-[10px] font-black tracking-[0.2em] uppercase whitespace-nowrap">
          Base de Dados: Neutralizada — Ambiente de Desenvolvimento
        </p>
        <div className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-black"></span>
        </div>
      </div>
    </div>
  )
}
