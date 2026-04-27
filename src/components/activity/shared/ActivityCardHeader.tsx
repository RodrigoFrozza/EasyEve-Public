'use client'

import { LayoutGrid, AlignJustify, Activity as ActivityIcon, Settings2 } from 'lucide-react'
import { CardHeader } from '@/components/ui/card'

import { ACTIVITY_UI_MAPPING } from '@/lib/constants/activity-ui'
import { useTranslations } from '@/i18n/hooks'

interface ActivityCardHeaderProps {
  activity: any
  index: number
  displayMode: 'compact' | 'expanded'
  setDisplayMode: (mode: 'compact' | 'expanded') => void
  elapsed: string
  mounted: boolean
  typeLabel: string
}

export function ActivityCardHeader({ 
  activity, 
  index, 
  displayMode, 
  setDisplayMode, 
  elapsed, 
  mounted,
  typeLabel
}: ActivityCardHeaderProps) {
  const { t } = useTranslations()
  const isAbyssal = activity.type === 'abyssal'
  const headerTitle = isAbyssal ? 'ABYSSAL OPERATIONS' : (activity.item?.name || activity.data?.siteName || t('activity.activeOperations'))
  const statusDotClass = activity.isPaused
    ? 'bg-amber-500 shadow-amber-500/40'
    : (isAbyssal ? 'bg-fuchsia-500 shadow-fuchsia-500/40' : 'bg-emerald-500 shadow-emerald-500/40')
  const pulseClass = isAbyssal ? 'bg-fuchsia-500' : 'bg-emerald-500'
  const elapsedDotClass = activity.isPaused
    ? 'bg-amber-500'
    : (isAbyssal ? 'bg-fuchsia-400 animate-pulse shadow-[0_0_10px_rgba(232,121,249,0.55)]' : 'bg-blue-400 animate-pulse shadow-[0_0_10px_rgba(96,165,250,0.5)]')
  const elapsedTextClass = isAbyssal ? 'text-fuchsia-300' : 'text-blue-400'

  return (
    <CardHeader className="py-5 px-8 bg-zinc-950/40 border-b border-white/5 relative z-10 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="h-14 w-14 rounded-2xl bg-zinc-900/60 border border-white/5 flex items-center justify-center shadow-inner group-hover/card:border-blue-500/30 transition-all duration-500">
              {(() => {
                const ui = ACTIVITY_UI_MAPPING[activity.type]
                const Icon = ui?.icon || ActivityIcon
                const iconColor = ui?.color || 'text-emerald-400'
                return <Icon className={`h-6 w-6 ${iconColor}`} />
              })()}
            </div>
            <div className={`absolute -bottom-1.5 -right-1.5 h-5 w-5 rounded-full border-4 border-zinc-950 shadow-2xl transition-all duration-500 ${statusDotClass}`}>
              {!activity.isPaused && (
                <div className={`absolute inset-0 ${pulseClass} rounded-full animate-ping opacity-25`} />
              )}
            </div>
          </div>
          
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 font-outfit">
                {t('activity.fleet')} #{String(index + 1).padStart(2, '0')} • {typeLabel}
              </span>
            </div>
            <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2 font-outfit uppercase">
              <span className="truncate max-w-[220px]">{headerTitle}</span>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-1.5 bg-black/40 rounded-2xl p-1.5 border border-white/5 shadow-inner backdrop-blur-xl">
            <button
              onClick={() => setDisplayMode('compact')}
              className={`p-2 rounded-xl transition-all duration-500 ${
                displayMode === 'compact' ? "bg-white/10 text-white shadow-xl" : "text-zinc-600 hover:text-zinc-400 hover:bg-white/5"
              }`}
              title={t('activity.compactView')}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setDisplayMode('expanded')}
              className={`p-2 rounded-xl transition-all duration-500 ${
                displayMode === 'expanded' ? "bg-white/10 text-white shadow-xl" : "text-zinc-600 hover:text-zinc-400 hover:bg-white/5"
              }`}
              title={t('activity.detailedView')}
            >
              <AlignJustify className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-3 bg-zinc-900/60 px-4 py-2.5 rounded-2xl border border-white/5 shadow-inner backdrop-blur-md">
            <div className={`h-2 w-2 rounded-full ${elapsedDotClass}`} />
            <span className={`text-sm font-black font-inter ${elapsedTextClass} tracking-tighter tabular-nums leading-none`} suppressHydrationWarning>
              {mounted ? elapsed : '00:00:00'}
            </span>
          </div>

        </div>
      </div>
    </CardHeader>
  )
}