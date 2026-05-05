'use client'

import { useMemo } from 'react'
import { ActivityEnhanced, isMiningActivity, isRattingActivity, isAbyssalActivity, isExplorationActivity } from '@/types/domain'
import { ExpandableSection } from '../shared/ExpandableSection'
import { FinancialBreakdownBar } from '../shared/FinancialBreakdownBar'
import { getActivityFinancialMetrics } from '@/lib/activities/activity-metrics'
import { Receipt, Info, Box } from 'lucide-react'
import { formatISK, cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'

interface FinancialBreakdownSectionProps {
  activity: ActivityEnhanced
  onOpenMTU?: () => void
}

export function FinancialBreakdownSection({ activity, onOpenMTU }: FinancialBreakdownSectionProps) {
  const { t } = useTranslations()
  const metrics = useMemo(() => getActivityFinancialMetrics(activity), [activity])

  const segments = useMemo(() => {
    const s = []
    
    if (isRattingActivity(activity)) {
      if (metrics.bounties > 0) s.push({ id: 'bounty', label: t('activity.summary.bounties'), value: metrics.bounties, color: 'bg-emerald-500' })
      if (metrics.ess > 0) s.push({ id: 'ess', label: t('activity.summary.essPayment'), value: metrics.ess, color: 'bg-blue-500' })
      if (metrics.additionalBounties > 0) s.push({ id: 'additional', label: t('activity.summary.additional'), value: metrics.additionalBounties, color: 'bg-cyan-500' })
      if (metrics.loot > 0) s.push({ id: 'loot', label: t('activity.summary.loot'), value: metrics.loot, color: 'bg-amber-500' })
      if (metrics.salvage > 0) s.push({ id: 'salvage', label: t('activity.summary.salvage'), value: metrics.salvage, color: 'bg-rose-500' })
    } else if (isMiningActivity(activity)) {
      s.push({ id: 'mining', label: t('activity.summary.oreValue'), value: metrics.miningValue, color: 'bg-blue-500' })
    } else if (isAbyssalActivity(activity) || isExplorationActivity(activity)) {
      s.push({ id: 'loot', label: t('activity.summary.totalLoot'), value: metrics.totalLootValue, color: 'bg-emerald-500' })
    }

    return s
  }, [activity, metrics, t])

  const grossValue = segments.reduce((sum, s) => sum + s.value, 0)

  return (
    <ExpandableSection
      title={t('activity.summary.financialBreakdown')}
      icon={<Receipt className="w-4 h-4" />}
      variant="accent"
      summary={
        <div className="flex items-center gap-3 mt-1">
          <div className="h-1.5 w-32 rounded-full bg-white/5 overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-1000" 
              style={{ width: `${Math.min(100, (metrics.net / Math.max(1, grossValue)) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">
            {formatISK(metrics.net)} {t('activity.summary.netProfit')}
          </span>
        </div>
      }
    >
      <div className="space-y-8 py-2">
        {/* Visual Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              {t('activity.summary.incomeSources')}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-3 h-3 text-zinc-600" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-[10px]">{t('activity.summary.incomeDistribution')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </h4>
            <span className="text-[10px] font-black text-zinc-400 font-mono">
              {t('activity.summary.gross')}: {formatISK(grossValue)}
            </span>
          </div>
          <FinancialBreakdownBar segments={segments} total={grossValue} />
        </div>

        {/* Detailed Table */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
            {t('activity.summary.accountingDetails')}
          </h4>
          <div className="space-y-1">
            {segments.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3 bg-white/5 border border-white/5 rounded-xl">
                <span className="text-xs font-black text-zinc-400 uppercase tracking-wider">{s.label}</span>
                <span className="text-sm font-black text-zinc-200 font-mono">{formatISK(s.value)}</span>
              </div>
            ))}
            
            {metrics.taxes > 0 && (
              <div className="flex items-center justify-between px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl mt-4">
                <span className="text-xs font-black text-rose-400 uppercase tracking-wider">{t('activity.summary.automaticTaxes')}</span>
                <span className="text-sm font-black text-rose-400 font-mono">-{formatISK(metrics.taxes)}</span>
              </div>
            )}

            {isRattingActivity(activity) && onOpenMTU && (
              <div className="mt-4">
                <Button
                  variant="outline"
                  onClick={onOpenMTU}
                  className="w-full h-12 bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 text-[10px] font-black uppercase tracking-[0.2em] gap-3 rounded-xl transition-all font-outfit"
                >
                  <Box className="h-4 w-4" />
                  {t('activity.summary.mtuRegistryHub')}
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between px-4 py-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mt-4">
              <span className="text-sm font-black text-emerald-400 uppercase tracking-widest">{t('activity.summary.netProfit')}</span>
              <span className="text-lg font-black text-emerald-400 font-mono">{formatISK(metrics.net)}</span>
            </div>
          </div>
        </div>
      </div>
    </ExpandableSection>
  )
}
