'use client'

import { useMemo } from 'react'
import {
  ActivityEnhanced,
  isMiningActivity,
  isRattingActivity,
  isAbyssalActivity,
  isExplorationActivity,
  isSalvagingActivity,
  isEscalationsActivity,
} from '@/types/domain'
import {
  ExpandableSection,
  SESSION_SECTION_LABEL,
  SESSION_SECTION_VALUE,
} from '../shared/ExpandableSection'
import { FinancialBreakdownBar } from '../shared/FinancialBreakdownBar'
import { getActivityFinancialMetrics } from '@/lib/activities/activity-metrics'
import { Receipt, Info, Box } from 'lucide-react'
import { formatISK, cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import type { ActivityThemeClasses } from '@/lib/activity/activity-theme'

interface FinancialBreakdownSectionProps {
  activity: ActivityEnhanced
  theme?: ActivityThemeClasses
  onOpenMTU?: () => void
}

export function FinancialBreakdownSection({
  activity,
  theme,
  onOpenMTU,
}: FinancialBreakdownSectionProps) {
  const { t } = useTranslations()
  const metrics = useMemo(() => getActivityFinancialMetrics(activity), [activity])

  const segments = useMemo(() => {
    const s = []

    if (isRattingActivity(activity)) {
      if (metrics.bounties > 0)
        s.push({
          id: 'bounty',
          label: t('activity.summary.bounties'),
          value: metrics.bounties,
          color: 'bg-red-500',
        })
      if (metrics.ess > 0)
        s.push({
          id: 'ess',
          label: t('activity.summary.essPayment'),
          value: metrics.ess,
          color: 'bg-rose-400',
        })
      if (metrics.additionalBounties > 0)
        s.push({
          id: 'additional',
          label: t('activity.summary.additional'),
          value: metrics.additionalBounties,
          color: 'bg-orange-500',
        })
      if (metrics.loot > 0)
        s.push({
          id: 'loot',
          label: t('activity.summary.loot'),
          value: metrics.loot,
          color: 'bg-amber-500',
        })
      if (metrics.salvage > 0)
        s.push({
          id: 'salvage',
          label: t('activity.summary.salvage'),
          value: metrics.salvage,
          color: 'bg-zinc-400',
        })
      if (metrics.escalations > 0)
        s.push({
          id: 'escalations',
          label: t('activity.summary.escalations'),
          value: metrics.escalations,
          color: 'bg-orange-500',
        })
    } else if (isEscalationsActivity(activity)) {
      if (metrics.bounties > 0)
        s.push({
          id: 'bounty',
          label: t('activity.summary.bounties'),
          value: metrics.bounties,
          color: 'bg-orange-500',
        })
      if (metrics.ess > 0)
        s.push({
          id: 'ess',
          label: t('activity.summary.essPayment'),
          value: metrics.ess,
          color: 'bg-amber-400',
        })
      if (metrics.escalations > 0)
        s.push({
          id: 'escLoot',
          label: t('activity.escalations.loot'),
          value: metrics.escalations,
          color: 'bg-emerald-500',
        })
    } else if (isMiningActivity(activity)) {
      s.push({
        id: 'mining',
        label: t('activity.summary.oreValue'),
        value: metrics.miningValue,
        color: 'bg-cyan-500',
      })
    } else if (isAbyssalActivity(activity)) {
      s.push({
        id: 'loot',
        label: t('activity.summary.totalLoot'),
        value: metrics.totalLootValue,
        color: 'bg-purple-500',
      })
    } else if (isExplorationActivity(activity) || isSalvagingActivity(activity)) {
      s.push({
        id: 'loot',
        label: t('activity.summary.totalLoot'),
        value: metrics.totalLootValue,
        color: isSalvagingActivity(activity) ? 'bg-lime-500' : 'bg-orange-500',
      })
    }

    return s
  }, [activity, metrics, t])

  const grossValue = segments.reduce((sum, s) => sum + s.value, 0)
  const accent = theme?.headerIcon ?? 'text-eve-accent'
  const netBorder = theme?.chipActive ?? 'border-eve-accent/30'
  const netText = theme?.revenuePositive ?? 'text-eve-accent'

  return (
    <ExpandableSection
      title={t('activity.summary.financialBreakdown')}
      icon={<Receipt className="h-3.5 w-3.5" />}
      variant="accent"
      accentClassName={accent}
      borderClassName={theme ? cn(theme.panel, 'border') : undefined}
      summary={
        <div className="mt-0.5 flex items-center gap-3">
          <div className="h-1 w-24 overflow-hidden rounded-none bg-zinc-900">
            <div
              className={cn('h-full transition-none', theme?.accentBar ?? 'bg-eve-accent/50')}
              style={{
                width: `${Math.min(100, (metrics.net / Math.max(1, grossValue)) * 100)}%`,
              }}
            />
          </div>
          <span
            className={cn(
              'font-mono text-[10px] font-black uppercase tracking-[0.2em]',
              netText
            )}
          >
            {formatISK(metrics.net)} {t('activity.summary.netProfit')}
          </span>
        </div>
      }
    >
      <div className="space-y-6 py-1">
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4
              className={cn(
                'flex items-center gap-1.5 font-mono text-[10px] font-black uppercase tracking-[0.2em]',
                SESSION_SECTION_LABEL
              )}
            >
              {t('activity.summary.incomeSources')}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger type="button">
                    <Info className={cn('h-3 w-3 text-zinc-600 transition-none', accent)} />
                  </TooltipTrigger>
                  <TooltipContent className="rounded-none border border-eve-border/50 bg-black px-2 py-1 font-mono text-[10px] font-bold uppercase text-white">
                    <p>{t('activity.summary.incomeDistribution')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </h4>
            <span
              className={cn(
                'font-mono text-[10px] font-black uppercase tracking-widest',
                SESSION_SECTION_VALUE
              )}
            >
              {t('activity.summary.gross')}: {formatISK(grossValue)}
            </span>
          </div>
          <FinancialBreakdownBar segments={segments} total={grossValue} />
        </div>

        <div className="space-y-3">
          <h4
            className={cn(
              'font-mono text-[10px] font-black uppercase tracking-[0.2em]',
              SESSION_SECTION_LABEL
            )}
          >
            {t('activity.summary.accountingDetails')}
          </h4>
          <div className="space-y-1.5">
            {segments.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-none border border-white/10 bg-[#151c28]/70 px-3 py-2.5"
              >
                <span
                  className={cn(
                    'font-mono text-[10px] font-black uppercase tracking-[0.2em]',
                    SESSION_SECTION_LABEL
                  )}
                >
                  {s.label}
                </span>
                <span
                  className={cn(
                    'font-mono text-xs font-black tracking-widest',
                    SESSION_SECTION_VALUE
                  )}
                >
                  {formatISK(s.value)}
                </span>
              </div>
            ))}

            {metrics.taxes > 0 && (
              <div className="mt-2 flex items-center justify-between rounded-none border border-red-500/20 bg-red-500/5 px-3 py-2.5">
                <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-red-400">
                  {t('activity.summary.automaticTaxes')}
                </span>
                <span className="font-mono text-xs font-black tracking-widest text-red-400">
                  -{formatISK(metrics.taxes)}
                </span>
              </div>
            )}

            {isRattingActivity(activity) && metrics.expenses > 0 && (
              <div className="flex items-center justify-between rounded-none border border-rose-500/20 bg-rose-500/5 px-3 py-2.5">
                <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-rose-400">
                  {t('activity.summary.expenses')}
                </span>
                <span className="font-mono text-xs font-black tracking-widest text-rose-400">
                  -{formatISK(metrics.expenses)}
                </span>
              </div>
            )}

            {isRattingActivity(activity) && onOpenMTU && (
              <div className="mt-3">
                <Button
                  variant="outline"
                  type="button"
                  onClick={onOpenMTU}
                  className={cn(
                    'h-10 w-full gap-2.5 rounded-none border bg-black font-mono text-[11px] font-black uppercase tracking-[0.25em] transition-none',
                    theme?.metricShell ??
                      'border-white/15 text-zinc-300 hover:bg-white/5 hover:text-zinc-100'
                  )}
                >
                  <Box className="h-3.5 w-3.5" />
                  {t('activity.summary.mtuRegistryHub')}
                </Button>
              </div>
            )}

            <div
              className={cn(
                'mt-3 flex items-center justify-between rounded-none border bg-zinc-900/90 px-3 py-3',
                netBorder
              )}
            >
              <span className="font-mono text-xs font-black uppercase tracking-[0.3em] text-zinc-200">
                {t('activity.summary.netProfit')}
              </span>
              <span
                className={cn(
                  'font-mono text-base font-black tracking-widest text-zinc-50',
                  netText
                )}
              >
                {formatISK(metrics.net)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </ExpandableSection>
  )
}
