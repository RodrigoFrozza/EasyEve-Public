'use client'

import { Download, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/i18n/hooks'
import { cn } from '@/lib/utils'
import type { ActivityThemeClasses } from '@/lib/activity/activity-theme'
import { SESSION_MODAL_SURFACE } from '@/lib/activity/session-modal-surface'

interface ActivityToolbarProps {
  onExportCSV: () => void
  isPremium?: boolean
  exportDisabled?: boolean
  theme?: ActivityThemeClasses
}

export function ActivityToolbar({
  onExportCSV,
  isPremium = false,
  exportDisabled = false,
  theme,
}: ActivityToolbarProps) {
  const { t } = useTranslations()
  const accentIcon = theme?.headerIcon ?? 'text-eve-accent'

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-b border-white/10 px-3 py-3',
        SESSION_MODAL_SURFACE.toolbar
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg border',
            theme ? theme.headerIconBox : SESSION_MODAL_SURFACE.kpiCard
          )}
        >
          <svg
            className={cn('h-4 w-4', accentIcon)}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <div className="flex flex-col">
          <h3 className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-white">
            {t('common.session.sessionDetailsTitle')}
          </h3>
          <p className="mt-1 font-mono text-[9px] font-black uppercase tracking-widest text-zinc-400">
            {t('common.session.sessionDetailsSubtitle')}
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        type="button"
        disabled={exportDisabled && isPremium}
        className={cn(
          'h-8 gap-2 rounded-none border border-white/15 px-4 font-mono text-[10px] font-black uppercase tracking-[0.2em] transition-none text-zinc-300 hover:bg-white/5 hover:text-zinc-100',
          !theme && 'hover:text-eve-accent hover:bg-eve-accent/5',
          exportDisabled && isPremium && 'cursor-not-allowed opacity-50'
        )}
        onClick={onExportCSV}
        aria-label={t('common.session.exportCSV')}
        title={
          !isPremium
            ? t('activity.summary.exportPremiumOnly')
            : exportDisabled
              ? t('activity.summary.exportNoLogs')
              : t('common.session.exportCSV')
        }
      >
        {isPremium ? (
          <Download className={cn('h-3.5 w-3.5 shrink-0', accentIcon)} aria-hidden />
        ) : (
          <Lock className="h-3.5 w-3.5 shrink-0 text-zinc-600" aria-hidden />
        )}
        <span className="hidden sm:inline">{t('common.session.exportCSV')}</span>
      </Button>
    </div>
  )
}
