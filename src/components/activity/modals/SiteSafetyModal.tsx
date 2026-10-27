'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { checkSiteSafety, type SiteSafetyResult } from '@/lib/utils'
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { ExplorationThemedDialog, explorationModalTheme } from './exploration/ExplorationThemedDialog'
import { ExplorationSiteSearch } from './exploration/ExplorationSiteSearch'

interface SiteSafetyModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function safetyStyles(safety: SiteSafetyResult['safety']) {
  switch (safety) {
    case 'safe':
      return {
        panel: 'border-sky-400/30 bg-sky-500/[0.08]',
        title: 'text-sky-300',
        icon: ShieldCheck,
        iconClass: 'text-sky-400',
      }
    case 'not_safe':
      return {
        panel: 'border-red-400/30 bg-red-500/[0.08]',
        title: 'text-red-300',
        icon: ShieldAlert,
        iconClass: 'text-red-400',
      }
    case 'warning':
      return {
        panel: 'border-amber-400/30 bg-amber-500/[0.08]',
        title: 'text-amber-300',
        icon: AlertTriangle,
        iconClass: 'text-amber-400',
      }
  }
}

export function SiteSafetyModal({ open, onOpenChange }: SiteSafetyModalProps) {
  const { t } = useTranslations()
  const theme = explorationModalTheme
  const [siteName, setSiteName] = useState('')
  const [result, setResult] = useState<SiteSafetyResult | null>(null)
  const [refGuideOpen, setRefGuideOpen] = useState(false)

  useEffect(() => {
    if (!open) {
      setSiteName('')
      setResult(null)
      setRefGuideOpen(false)
    }
  }, [open])

  const runCheck = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setSiteName(trimmed)
    setResult(checkSiteSafety(trimmed))
  }

  const statusLabel = (safety: SiteSafetyResult['safety']) => {
    switch (safety) {
      case 'safe':
        return t('activity.exploration.modals.siteSafety.statusSecure')
      case 'not_safe':
        return t('activity.exploration.modals.siteSafety.statusHostile')
      case 'warning':
        return t('activity.exploration.modals.siteSafety.statusCaution')
    }
  }

  const typeLabel = (type: SiteSafetyResult['type']) => {
    const key = `activity.exploration.modals.siteSafety.types.${type}`
    const label = t(key)
    return label === key ? t('activity.exploration.modals.siteSafety.types.unknown') : label
  }

  const styles = result ? safetyStyles(result.safety) : null
  const ResultIcon = styles?.icon ?? Shield

  const refEntries = [
    { color: 'bg-sky-400', key: 'secureRuined' },
    { color: 'bg-red-400', key: 'hostileUnsecured' },
    { color: 'bg-red-400', key: 'hostileSleeper' },
    { color: 'bg-red-400', key: 'hostileDrone' },
  ] as const

  return (
    <ExplorationThemedDialog
      open={open}
      onOpenChange={onOpenChange}
      badge={t('activity.exploration.modals.siteSafety.badge')}
      title={t('activity.exploration.modals.siteSafety.title')}
      description={t('activity.exploration.modals.siteSafety.description')}
      maxWidth="md"
      scrollable
      footer={
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenChange(false)}
          className={cn(
            'h-9 w-full rounded-lg border font-mono text-[10px] font-bold uppercase tracking-wide',
            theme.chip
          )}
        >
          {t('activity.exploration.modals.common.close')}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <ExplorationSiteSearch
            label={t('activity.exploration.modals.siteSafety.siteLabel')}
            placeholder={t('activity.exploration.modals.siteSafety.sitePlaceholder')}
            value={siteName}
            onValueChange={(v) => {
              setSiteName(v)
              setResult(null)
            }}
            onSelect={runCheck}
            emptyMessage={t('activity.exploration.modals.siteSafety.noMatches')}
          />
          <p className={cn('text-[9px] leading-snug', theme.textMuted)}>
            {t('activity.exploration.modals.siteSafety.searchEnterHint')}
          </p>
        </div>

        {result && styles ? (
          <div className={cn('rounded-xl border p-3.5 backdrop-blur-sm', styles.panel)}>
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/25',
                  styles.iconClass
                )}
              >
                <ResultIcon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn('text-base font-bold', styles.title)}>{statusLabel(result.safety)}</p>
                <p className="mt-0.5 text-xs text-orange-200/60">
                  {result.name} · {typeLabel(result.type)}
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
              <div className="flex items-center justify-between gap-2">
                <span className={cn('text-[10px] font-bold uppercase tracking-wide', theme.textMuted)}>
                  {t('activity.exploration.modals.siteSafety.threatLevel')}
                </span>
                <div className="flex gap-0.5" aria-label={`${result.difficulty}/5`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'h-3 w-1 rounded-full',
                        i < result.difficulty ? 'bg-orange-400' : 'bg-white/10'
                      )}
                    />
                  ))}
                </div>
              </div>

              {result.warnings.length > 0 ? (
                <ul className="space-y-1.5">
                  <li className={cn('text-[10px] font-bold uppercase tracking-wide', theme.textMuted)}>
                    {t('activity.exploration.modals.siteSafety.warnings')}
                  </li>
                  {result.warnings.map((warning, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-xs leading-relaxed text-orange-100/85"
                    >
                      {warning}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center',
              theme.logEmpty
            )}
          >
            <Shield className={cn('mb-2 h-8 w-8 opacity-40', theme.textMuted)} />
            <p className={cn('text-xs leading-relaxed', theme.textMuted)}>
              {t('activity.exploration.modals.siteSafety.emptyHint')}
            </p>
          </div>
        )}

        <div className={cn('rounded-lg border', theme.panel)}>
          <Button
            type="button"
            variant="ghost"
            className={cn(
              'flex h-9 w-full items-center justify-between rounded-lg px-3 text-[10px] font-bold uppercase tracking-wide',
              theme.textMuted,
              'hover:bg-orange-500/10 hover:text-orange-100'
            )}
            onClick={() => setRefGuideOpen((v) => !v)}
          >
            {refGuideOpen
              ? t('activity.exploration.modals.siteSafety.hideRefGuide')
              : t('activity.exploration.modals.siteSafety.showRefGuide')}
            <ChevronDown
              className={cn('h-3.5 w-3.5 transition-transform', refGuideOpen && 'rotate-180')}
            />
          </Button>
          {refGuideOpen ? (
            <div className="grid gap-2 border-t border-orange-400/10 p-3 sm:grid-cols-2">
              {refEntries.map(({ color, key }) => (
                <div
                  key={key}
                  className="flex items-center gap-2 rounded-lg border border-orange-400/15 bg-black/20 px-2.5 py-1.5"
                >
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', color)} />
                  <span className="text-[10px] leading-snug text-orange-200/70">
                    {t(`activity.exploration.modals.siteSafety.ref.${key}`)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </ExplorationThemedDialog>
  )
}
