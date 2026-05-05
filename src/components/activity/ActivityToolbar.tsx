'use client'

import { Download, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/i18n/hooks'

interface ActivityToolbarProps {
  onExportCSV: () => void
  isPremium?: boolean
}

export function ActivityToolbar({ onExportCSV, isPremium = false }: ActivityToolbarProps) {
  const { t } = useTranslations()
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-4 gap-3">
      <div className="flex items-center gap-3">
         <div className="p-2 bg-white/5 rounded-lg border border-white/10">
            <svg className="h-4 w-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
         </div>
         <div>
           <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-300 font-outfit">{t('common.session.sessionDetailsTitle')}</h3>
           <p className="text-[10px] text-zinc-600 font-bold uppercase mt-1 font-outfit tracking-[0.08em]">{t('common.session.sessionDetailsSubtitle')}</p>
         </div>
      </div>
      <Button 
        variant="ghost" 
        size="lg" 
        type="button"
        className="h-9 px-3 gap-2 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400 hover:text-white hover:bg-zinc-900 border border-white/5 hover:border-white/20 rounded-lg font-outfit transition-all shadow-xl"
        onClick={onExportCSV}
        aria-label={t('common.session.exportCSV')}
        title={isPremium ? t('common.session.exportCSV') : t('activity.summary.exportPremiumOnly')}
      >
        {isPremium ? (
          <Download className="h-3.5 w-3.5 text-cyan-500 shrink-0" aria-hidden />
        ) : (
          <Lock className="h-3.5 w-3.5 text-amber-500 shrink-0" aria-hidden />
        )}
        <span className="hidden sm:inline">{t('common.session.exportCSV')}</span>
      </Button>
    </div>
  )
}